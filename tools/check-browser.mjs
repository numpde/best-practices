import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const profile=mkdtempSync(join(tmpdir(),'practices-browser-'));
const browser=spawn(process.env.CHROMIUM||'chromium',[
 ...process.argv.slice(2),'--headless','--disable-gpu','--remote-debugging-pipe',
 `--user-data-dir=${profile}`,
],{stdio:['ignore','ignore','inherit','pipe','pipe']});
const closed=new Promise(resolve=>browser.once('close',resolve));
const requests=new Map(),errors=[];
let sequence=0,buffer='',session;
browser.stdio[4].setEncoding('utf8');
browser.stdio[4].on('data',chunk=>{
 buffer+=chunk;
 let end;
 while((end=buffer.indexOf('\0'))>=0){
  const message=JSON.parse(buffer.slice(0,end));
  buffer=buffer.slice(end+1);
  const request=requests.get(message.id);
  if(request){
   requests.delete(message.id);
   if(message.error)request.reject(Error(JSON.stringify(message.error)));
   else request.resolve(message.result);
  }else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
 }
});
browser.on('exit',()=>{
 for(const request of requests.values())request.reject(Error('Chromium exited before replying.'));
 requests.clear();
});
function call(method,params={},sessionId=session){
 return new Promise((resolve,reject)=>{
  const id=++sequence;
  requests.set(id,{resolve,reject});
  browser.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');
 });
}
async function evaluate(expression){
 const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
 return result.result.value;
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(expression){
 const end=Date.now()+5000;
 do{
  if(await evaluate(expression))return;
  await delay(30);
 }while(Date.now()<end);
 throw Error(`Timed out waiting for ${expression}`);
}
const waitReady=()=>waitFor(`!!document.querySelector('#graph') &&
 getComputedStyle(document.querySelector('#graph')).visibility==='visible' &&
 document.querySelector('#graph').getAttribute('aria-busy')==='false'`);
const snapshot=()=>evaluate(`({
 positions:cy.nodes().map(node=>({id:node.id(),...node.position()})),
 zoom:cy.zoom(),pan:cy.pan(),nodes:cy.nodes().length,edges:cy.edges().length,
})`);
async function click(selector){
 const point=await evaluate(`(()=>{
  const bounds=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
  return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
 })()`);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
}
const deadline=setTimeout(()=>browser.kill(),30000);
try{
 await once(browser,'spawn');
 const {targetId}=await call('Target.createTarget',{url:'about:blank'});
 ({sessionId:session}=await call('Target.attachToTarget',{targetId,flatten:true}));
 await call('Page.enable');
 await call('Runtime.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.loadFrames=[];
 document.addEventListener('DOMContentLoaded',()=>{
  const graph=document.querySelector('#graph');
  if(!graph)return;
  let fittedDraws=0;
  cy.on('render',()=>{if(cy.zoom()!==1)fittedDraws++;});
  new MutationObserver(()=>{
   window.loadFrames.push({visible:getComputedStyle(graph).visibility==='visible',busy:graph.getAttribute('aria-busy'),fittedDraws});
  }).observe(graph,{attributes:true});
 });`});
 const pageURL=new URL('../docs/index.html',import.meta.url).href;
 await call('Page.navigate',{url:pageURL});
 await waitReady();
 const initial=await snapshot();
 assert.equal(initial.nodes,await evaluate('nodes.length'));
 assert.equal(initial.edges,await evaluate('edges.length'));
 assert.ok(await evaluate(`window.loadFrames.some(frame=>frame.visible&&frame.fittedDraws>0)&&
  window.loadFrames.every(frame=>!frame.visible||frame.busy==='false'&&frame.fittedDraws>0)`));
 console.log('Initial graph appears after a fitted draw with every idea and connection.');

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

 const concept=await evaluate('({id:nodes[0].id,title:nodes[0].title})');
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
 console.log('Pointer selection opens details without hiding, rearranging, or reframing the graph.');

 await evaluate(`document.querySelector('#graph').focus()`);
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
 console.log('Keyboard movement and switching work; dragging with live layout moves neighbors while preserving the camera.');

 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await waitFor('cy.width()===390');
 assert.equal(await evaluate(`cy.nodes().filter(node=>{
  const position=node.renderedPosition();
  return position.x>=0&&position.x<=cy.width()&&position.y>=0&&position.y<=cy.height();
 }).length`),initial.nodes);
 console.log('Browser viewport resizing keeps every node inside the canvas.');

 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await call('Page.navigate',{url:'about:blank'});
 await waitFor(`!document.querySelector('#graph')`);
 await call('Page.navigate',{url:pageURL+'#'+concept.id});
 await waitReady();
 assert.equal(await evaluate(`cy.nodes('.focused').first().id()`),concept.id);
 assert.equal(await evaluate(`document.querySelector('#live-layout').getAttribute('aria-checked')`),'false');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 const mobile=await snapshot();
 await delay(150);
 assert.deepEqual(await snapshot(),mobile);
 assert.deepEqual(errors,[]);
 console.log('Narrow deep links restore selection and remain still with reduced motion; no browser runtime errors.');
}finally{
 clearTimeout(deadline);
 browser.kill();
 await closed;
 rmSync(profile,{recursive:true,force:true});
}
