import {checkSSDG} from './check-ssdg.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const debugPort=process.env.CDP_PORT;
const attach=debugPort!==undefined;
const profile=attach?null:mkdtempSync(join(tmpdir(),'practices-browser-'));
const headed=process.env.HEADED==='1';
const browser=attach?null:spawn(process.env.CHROMIUM||'chromium',[
 ...process.argv.slice(2),...(headed?[]:['--headless']),'--disable-gpu','--remote-debugging-pipe',
 '--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,
],{stdio:['ignore','ignore','inherit','pipe','pipe']});
const closed=browser?new Promise(resolve=>browser.once('close',resolve)):null;
const requests=new Map(),errors=[],failures=[],openedTargets=new Set();
let sequence=0,buffer='',session,socket=null,connected=false,targetId;
function receive(message){
 const request=requests.get(message.id);
 if(request){
  requests.delete(message.id);
  if(message.error)request.reject(Error(`${request.method}: ${message.error.message} (code ${message.error.code})`));
  else request.resolve(message.result);
 }else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
 else if(message.method==='Page.screencastFrame'&&connected&&(!socket||socket.readyState===WebSocket.OPEN)){
  send({id:++sequence,method:'Page.screencastFrameAck',params:{sessionId:message.params.sessionId},sessionId:message.sessionId});
 }
}
function disconnected(){
 connected=false;
 for(const request of requests.values())request.reject(Error(`Cannot complete ${request.method}; the Chromium debug connection closed before replying.`));
 requests.clear();
}
if(browser){
 browser.stdio[4].setEncoding('utf8');
 browser.stdio[4].on('data',chunk=>{
  buffer+=chunk;
  let end;
  while((end=buffer.indexOf('\0'))>=0){
   receive(JSON.parse(buffer.slice(0,end)));
   buffer=buffer.slice(end+1);
  }
 });
 browser.on('exit',disconnected);
}
function call(method,params={},sessionId=session){
 if(!connected)return Promise.reject(Error('The Chromium debug connection is not open.'));
 return new Promise((resolve,reject)=>{
  const id=++sequence;
  requests.set(id,{resolve,reject,method});
  send({id,method,params,sessionId:sessionId??undefined});
 });
}
function send(message){
 const encoded=JSON.stringify(message);
 if(socket)socket.send(encoded);else browser.stdio[3].write(encoded+'\0');
}
async function evaluate(expression){
 const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
 return result.result.value;
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const nextFrames=()=>evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
async function waitFor(expression){
 const end=Date.now()+5000;
 do{
  if(await evaluate(expression))return;
  await delay(30);
 }while(Date.now()<end);
 const state=await evaluate(`({
  document:document.readyState,visibility:document.visibilityState,
  graphBusy:document.querySelector('#graph')?.getAttribute('aria-busy'),
  status:document.querySelector('#status')?.textContent,
 })`);
 const failures=errors.slice(-3).map(error=>error.exception?.description?.slice(0,300)||error.text);
 throw Error(`Browser check timed out waiting for ${expression}; page=${JSON.stringify(state)}; runtime errors=${JSON.stringify(failures)}`);
}
const waitReady=()=>waitFor(`!!document.querySelector('#graph') &&
 getComputedStyle(document.querySelector('#graph')).visibility==='visible' &&
 document.querySelector('#graph').getAttribute('aria-busy')==='false'`);
async function loadPage(url){
 await call('Page.navigate',{url:'about:blank'});
 await waitFor(`!document.querySelector('#graph')`);
 await call('Page.navigate',{url});
 await waitReady();
}
const snapshot=()=>evaluate(`({
 positions:cy.nodes().map(node=>({id:node.id(),...node.position()})),
 zoom:cy.zoom(),pan:cy.pan(),nodes:cy.nodes().length,edges:cy.edges().length,
})`);
const centerOf=selector=>evaluate(`(()=>{
  const bounds=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
  return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
 })()`);
async function click(selector){
 const point=await centerOf(selector);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
}
async function tap(selector){
 const point=await centerOf(selector);
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1,radiusX:1,radiusY:1,force:1}]});
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function pressKey(key,code,windowsVirtualKeyCode){
 await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
}
const deadline=setTimeout(()=>{if(browser)browser.kill();else socket?.close();},30000);
try{
 if(attach){
  const port=Number(debugPort);
  assert.ok(Number.isInteger(port)&&port>0&&port<=65535,'CDP_PORT must be a localhost port between 1 and 65535.');
  assert.equal(typeof WebSocket,'function','Attaching to CDP_PORT requires Node.js 22 or newer.');
  const version=await(await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(5000)})).json();
  socket=new WebSocket(version.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>receive(JSON.parse(event.data)));
  socket.addEventListener('close',disconnected);
  await new Promise((resolve,reject)=>{
   socket.addEventListener('open',resolve,{once:true});
   socket.addEventListener('error',reject,{once:true});
   socket.addEventListener('close',()=>reject(Error('The Chromium debug connection closed while opening.')),{once:true});
  });
 }else await once(browser,'spawn');
 connected=true;
 ({targetId}=await call('Target.createTarget',{url:'about:blank',background:attach}));
 openedTargets.add(targetId);
 ({sessionId:session}=await call('Target.attachToTarget',{targetId,flatten:true}));
 if(attach&&!headed)await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 else await call('Target.activateTarget',{targetId});
 await call('Page.enable');
 if(attach&&!headed){
  // Capture keeps frames running in a minimized window; discard each image
  // after acknowledging it. Only this temporary tab is captured.
  await call('Page.startScreencast',{format:'jpeg',quality:10,maxWidth:128,maxHeight:128,everyNthFrame:1});
 }
 await call('Runtime.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.loadFrames=[];
 document.addEventListener('DOMContentLoaded',()=>{
  const graph=document.querySelector('#graph');
  if(!graph)return;
  const view=()=>({positions:cy.nodes().map(node=>({id:node.id(),...node.position()})),zoom:cy.zoom(),pan:cy.pan(),width:cy.width(),height:cy.height()});
  let painted=null;
  const layouts=new Set();
  cy.on('layoutstart',event=>layouts.add(event.layout));
  cy.on('layoutstop',event=>layouts.delete(event.layout));
  cy.on('render',()=>{painted=JSON.stringify(view());});
  new MutationObserver(()=>{
   const current=view();
   window.loadFrames.push({
    visible:getComputedStyle(graph).visibility==='visible',busy:graph.getAttribute('aria-busy'),
    completed:layouts.size===0,painted:painted===JSON.stringify(current),
    distinct:new Set(current.positions.map(position=>position.x+','+position.y)).size===current.positions.length,
    fitted:current.positions.every(position=>{
     const x=position.x*current.zoom+current.pan.x,y=position.y*current.zoom+current.pan.y;
     return x>=0&&x<=current.width&&y>=0&&y<=current.height;
    }),
   });
  }).observe(graph,{attributes:true});
 });`});
 const pageURL=new URL('../docs/best-practices.html',import.meta.url).href;
 await call('Page.navigate',{url:pageURL});
 await waitReady();
 const initial=await snapshot();
 assert.equal(initial.nodes,await evaluate('nodes.length'));
 assert.equal(initial.edges,await evaluate('edges.length'));
 assert.ok(await evaluate(`window.loadFrames.some(frame=>frame.visible)&&
  window.loadFrames.every(frame=>!frame.visible||frame.busy==='false'&&frame.completed&&frame.painted&&frame.distinct&&frame.fitted)`));
 console.log('Initial graph appears after a fitted draw with every idea and connection.');

 const searchState={};
 await evaluate(`document.querySelector('#search').focus();document.querySelector('#search').value='a';document.querySelector('#search').dispatchEvent(new Event('input'))`);
 await pressKey('ArrowUp','ArrowUp',38);
 searchState.upStartsAtLast=await evaluate(`document.querySelector('#search').getAttribute('aria-activedescendant')===document.querySelector('#matches [role=option]:last-of-type').id`);
 await pressKey('Escape','Escape',27);
 searchState.escapePreservesQuery=await evaluate(`document.querySelector('#search').value==='a'`);
 await evaluate(`document.querySelector('#search').value='';document.querySelector('#search').dispatchEvent(new Event('input'))`);
 await pressKey('ArrowDown','ArrowDown',40);
 searchState.emptyHasNoActiveOption=await evaluate(`document.querySelector('#matches').hidden&&!document.querySelector('#search').hasAttribute('aria-activedescendant')`);
 await evaluate(`document.querySelector('#search').value='graph';document.querySelector('#search').dispatchEvent(new Event('input'))`);
 await pressKey('Tab','Tab',9);
 searchState.tabClosesPopup=await evaluate(`document.querySelector('#matches').hidden`);
 assert.deepEqual(searchState,{upStartsAtLast:true,escapePreservesQuery:true,emptyHasNoActiveOption:true,tabClosesPopup:true});
 assert.deepEqual(await snapshot(),initial);
 console.log('Search has coherent first-arrow, empty, Escape, and keyboard-dismissal states.');
 const concept=await evaluate('({id:nodes[0].id,title:nodes[0].title})');
 for(const method of ['pointer','keyboard']){
  await click('#search');
  await evaluate(`document.querySelector('#search').value=${JSON.stringify(concept.title)};document.querySelector('#search').dispatchEvent(new Event('input'))`);
  if(method==='pointer')await click(`[data-match="${concept.id}"]`);
  else{
   await pressKey('ArrowDown','ArrowDown',40);
   await pressKey('Enter','Enter',13);
  }
  assert.equal(await evaluate(`cy.nodes('.focused').first().id()`),concept.id);
  assert.equal(await evaluate(`document.activeElement.id`),'graph');
  assert.equal(await evaluate(`document.querySelector('#matches').hidden`),true);
 }
 console.log('Pointer and keyboard result selection complete without dismissal swallowing activation.');

 await evaluate(`document.querySelector('#overview').click();document.querySelector('#live-layout').click()`);
 await waitReady();
 assert.equal(await evaluate(`document.querySelector('#live-layout').getAttribute('aria-checked')`),'true');
 await evaluate(`document.querySelector('#live-layout').click()`);
 await evaluate(`(async()=>{
  document.querySelector('#overview').click();await new Promise(requestAnimationFrame);
  document.querySelector('#live-layout').click();
 })()`);
 await waitReady();
 await evaluate(`document.querySelector('#live-layout').click()`);
 const frozen=await snapshot();
 await delay(150);
 assert.deepEqual(await snapshot(),frozen);
 console.log('Live switching before computation or presentation preserves completion; switching off freezes positions.');

 await evaluate(`(async()=>{
  document.querySelector('#overview').click();await new Promise(requestAnimationFrame);
  document.querySelector('#overview').click();document.querySelector('#overview').click();
 })()`);
 await waitReady();
 const settled=await snapshot();
 await delay(150);
 assert.deepEqual(await snapshot(),settled);
 console.log('Repeated Overview replaces pending work without late position or camera changes.');

 const pendingControls=await evaluate(`(()=>{
 document.querySelector('#overview').click();
 document.querySelector('#search').value=${JSON.stringify(concept.title)};
 document.querySelector('#search').dispatchEvent(new Event('input'));
 document.querySelector('[data-match="${concept.id}"]').click();
 return {
  fitDisabled:document.querySelector('#fit').disabled,
  movementDisabled:[...document.querySelectorAll('[data-nudge]')].every(button=>button.disabled),
 };
 })()`);
 assert.deepEqual(pendingControls,{fitDisabled:true,movementDisabled:true});
 await waitReady();
 assert.equal(await evaluate(`document.querySelector('#info').hidden`),false);
 assert.equal(await evaluate(`cy.nodes('.focused').first().id()`),concept.id);
 assert.equal(await evaluate(`[...document.querySelectorAll('[data-nudge]')].every(button=>!button.disabled)`),true);
 console.log('Search during arrangement retains selection and restores movement controls.');

 const before=await snapshot();
 await click('#context > summary');
 await delay(200);
 assert.deepEqual(await snapshot(),before);
 await click('[data-nudge="right"]');
 const after=await snapshot();
 assert.equal(after.zoom,before.zoom);
 assert.deepEqual(after.pan,before.pan);
 assert.equal(after.positions.filter((position,index)=>
  position.x!==before.positions[index].x||position.y!==before.positions[index].y).length,1);
 console.log('Details preserve the camera and positions; the movement control changes only the selected node.');

 await click('#overview');
 await waitReady();
 const prior=await snapshot();
 const point=await evaluate(`(()=>{
  const node=cy.getElementById('${concept.id}'),bounds=document.querySelector('#graph').getBoundingClientRect(),position=node.renderedPosition();
  return {x:bounds.x+position.x,y:bounds.y+position.y};
 })()`);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
 await delay(200);
 assert.deepEqual(await snapshot(),prior);
 assert.equal(await evaluate(`document.querySelector('#info').hidden`),false);
 assert.equal(await evaluate(`cy.nodes('.focused').first().id()`),concept.id);
 assert.equal(await evaluate('document.activeElement.id'),'graph');
 console.log('Pointer selection opens details without hiding, rearranging, or reframing the graph.');

 const selectionView=await snapshot();
 await pressKey('Escape','Escape',27);
 await waitFor(`document.querySelector('#info').hidden`);
 await nextFrames();
 const dismissed=await snapshot();
 assert.equal(dismissed.positions.filter((position,index)=>
  position.x!==selectionView.positions[index].x||position.y!==selectionView.positions[index].y).length,0,'Dismissing details must preserve node positions.');
 assert.equal(dismissed.zoom,selectionView.zoom);
 assert.deepEqual(dismissed.pan,selectionView.pan);
 assert.equal(await evaluate('document.activeElement.id'),'graph');
 await pressKey('Escape','Escape',27);
 await nextFrames();
 assert.deepEqual(await snapshot(),dismissed);
 await evaluate(`location.hash='${concept.id}'`);
 await waitFor(`cy.nodes('.focused').first().id()==='${concept.id}'`);
 console.log('Escape dismisses selection without arranging, losing focus, or replaying work.');

 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 const nudged=await snapshot();
 assert.equal(nudged.positions.filter((position,index)=>
  position.x!==prior.positions[index].x||position.y!==prior.positions[index].y).length,1);
 assert.equal(nudged.zoom,prior.zoom);
 assert.deepEqual(nudged.pan,prior.pan);
 await evaluate(`document.querySelector('#live-layout').focus()`);
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 assert.equal(await evaluate(`document.querySelector('#live-layout').getAttribute('aria-checked')`),'true');
 const anchor=await evaluate(`(()=>{
  const node=cy.nodes().filter(node=>{
   const p=node.renderedPosition();return p.x>40&&p.x<cy.width()-40&&p.y>40&&p.y<cy.height()-40;
  })[0],bounds=document.querySelector('#graph').getBoundingClientRect(),p=node.renderedPosition();
  return {x:bounds.x+p.x,y:bounds.y+p.y};
 })()`);
 const moving=await snapshot();
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...anchor});
 for(let step=1;step<=5;step++){
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:anchor.x+step*8,y:anchor.y});
  await delay(25);
 }
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:anchor.x+40,y:anchor.y});
 const moved=await snapshot();
 assert.ok(moved.positions.filter((position,index)=>
  position.x!==moving.positions[index].x||position.y!==moving.positions[index].y).length>1);
 assert.equal(moved.zoom,moving.zoom);
 assert.deepEqual(moved.pan,moving.pan);
 await click('#live-layout');
 assert.equal(await evaluate(`document.querySelector('#live-layout').getAttribute('aria-checked')`),'false','The live switch must turn off after dragging.');
 console.log('Keyboard movement and switching work; dragging with live layout moves neighbors while preserving the camera.');

 if(headed){
  await click('#live-layout');
  const {targetId:otherTarget}=await call('Target.createTarget',{url:'about:blank'});
  openedTargets.add(otherTarget);
  await call('Target.activateTarget',{targetId:otherTarget});
  await waitFor('document.hidden');
  const background=await snapshot();
  await delay(200);
  assert.deepEqual(await snapshot(),background);
  await call('Target.activateTarget',{targetId});
  await waitFor('!document.hidden');
  await nextFrames();
  const resumed=await snapshot();
  assert.notDeepEqual(resumed.positions,background.positions);
  assert.equal(resumed.zoom,background.zoom);
  assert.deepEqual(resumed.pan,background.pan);
  await call('Target.closeTarget',{targetId:otherTarget});
  openedTargets.delete(otherTarget);
  await click('#live-layout');
  console.log('Native background tabs pause live motion and resume without changing the camera.');
 }

 await click('#live-layout');
 assert.equal(await evaluate(`document.querySelector('#live-layout').getAttribute('aria-checked')`),'true','The live switch must turn on before checking idle motion.');
 const warming=await snapshot();
 await nextFrames();
 let resting=await snapshot(),settledLive=false;
 assert.ok(JSON.stringify(resting.positions)!==JSON.stringify(warming.positions),'Live motion did not move a node after the switch was enabled.');
 const settlingDeadline=Date.now()+5000;
 while(Date.now()<settlingDeadline){
  await delay(200);
  await nextFrames();
  const next=await snapshot();
  if(JSON.stringify(next.positions)===JSON.stringify(resting.positions)){settledLive=true;break;}
  resting=next;
 }
 assert.ok(settledLive,'Live motion must settle while idle.');
 assert.equal(await evaluate(`document.querySelector('#live-layout').getAttribute('aria-checked')`),'true');
 await pressKey('Tab','Tab',9);
 assert.equal(await evaluate('document.activeElement.id'),'graph');
 await pressKey('ArrowRight','ArrowRight',39);
 await nextFrames();
 const reheated=await snapshot();
 assert.ok(reheated.positions.filter((position,index)=>
  position.x!==resting.positions[index].x||position.y!==resting.positions[index].y).length>1);
 assert.equal(reheated.zoom,resting.zoom);
 assert.deepEqual(reheated.pan,resting.pan);
 await click('#live-layout');
 console.log('Idle live motion settles without disabling the mode; moving a node restarts its neighbors.');

 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await waitFor('cy.width()===390');
 assert.equal(await evaluate(`cy.nodes().filter(node=>{
  const position=node.renderedPosition();
  return position.x>=0&&position.x<=cy.width()&&position.y>=0&&position.y<=cy.height();
 }).length`),initial.nodes);
 console.log('Browser viewport resizing keeps every node inside the canvas.');

 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await loadPage(pageURL+'#'+concept.id);
 assert.equal(await evaluate(`cy.nodes('.focused').first().id()`),concept.id);
 assert.equal(await evaluate(`document.querySelector('#live-layout').getAttribute('aria-checked')`),'false');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 const mobile=await snapshot();
 await delay(150);
 assert.deepEqual(await snapshot(),mobile);
 await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 for(const live of [false,true]){
  if(live)await tap('#live-layout');
  const touchNode=await evaluate(`(()=>{
   const node=cy.nodes().filter(node=>{
    const p=node.renderedPosition();return p.x>40&&p.x<cy.width()-40&&p.y>60&&p.y<cy.height()-70;
   })[0],bounds=document.querySelector('#graph').getBoundingClientRect(),p=node.renderedPosition();
   return {x:bounds.x+p.x,y:bounds.y+p.y};
  })()`);
  const beforeTouch=await snapshot();
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchNode,id:1,radiusX:1,radiusY:1,force:1}]});
  for(let step=1;step<=5;step++){
   await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchNode.x+step*4,y:touchNode.y,id:1,radiusX:1,radiusY:1,force:1}]});
   await delay(25);
  }
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const afterTouch=await snapshot();
  const changed=afterTouch.positions.filter((position,index)=>
   position.x!==beforeTouch.positions[index].x||position.y!==beforeTouch.positions[index].y).length;
  if(live)assert.ok(changed>1);else assert.equal(changed,1);
  assert.equal(afterTouch.zoom,beforeTouch.zoom);
  assert.deepEqual(afterTouch.pan,beforeTouch.pan);
 }
 await tap('#live-layout');
 const touchFrozen=await snapshot();
 await delay(150);
 assert.deepEqual(await snapshot(),touchFrozen);
 console.log('Touch dragging respects live mode, preserves the camera, and freezes when switched off.');
 await loadPage(pageURL+'?view=links#%E0%A4%A');
 assert.equal(await evaluate(`document.querySelector('#info').hidden`),true);
 assert.equal(await evaluate('location.search'),'?view=links');
 const overview=await snapshot();
 const encodedId='%'+concept.id.charCodeAt(0).toString(16)+concept.id.slice(1);
 await evaluate(`location.hash=${JSON.stringify(encodedId)}`);
 await waitFor(`cy.nodes('.focused').first().id()==='${concept.id}'`);
 assert.deepEqual(await snapshot(),overview);
 await evaluate(`location.hash='%'`);
 await waitFor(`document.querySelector('#info').hidden&&document.querySelector('#graph').getAttribute('aria-busy')==='false'`);
 assert.equal(await evaluate(`cy.nodes('.focused').length`),0);
 assert.equal(await evaluate('location.hash'),'');
 assert.equal(await evaluate('location.search'),'?view=links');
 assert.equal((await snapshot()).nodes,initial.nodes);
 assert.deepEqual(await snapshot(),overview);
 console.log('Malformed links open the full graph; encoded selections work and malformed fragment changes recover.');
 await checkSSDG({call,evaluate,waitFor,delay,nextFrames});
 assert.deepEqual(errors,[]);
 console.log('Narrow deep links restore selection and remain still with reduced motion; no browser runtime errors.');
}catch(error){
 failures.push(error);
}finally{
 clearTimeout(deadline);
 if(browser){
  try{
   browser.kill();
   await closed;
   rmSync(profile,{recursive:true,force:true});
  }catch(error){failures.push(error);}
 }else{
  if(connected){
   for(const targetId of [...openedTargets].reverse()){
    try{await call('Target.closeTarget',{targetId},null);}
    catch(error){failures.push(error);}
   }
  }else if(openedTargets.size){
   failures.push(Error(`Cannot confirm cleanup of ${openedTargets.size} temporary tabs because the Chromium debug connection is closed.`));
  }
  socket?.close();
 }
}
if(failures.length===1)throw failures[0];
if(failures.length>1)throw new AggregateError(failures,'The browser check failed and cleanup also failed.');
