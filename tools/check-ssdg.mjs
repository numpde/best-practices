import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

// Exercise actual pointer input and the shared SVG references, including the
// wordmark's tiny O. A parallel timer per wheel would drift under these checks.
export async function checkSSDG({call,evaluate,waitFor,delay,nextFrames}){
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Emulation.setTouchEmulationEnabled',{enabled:false});
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 let releaseGoals;
 const goalsGate=new Promise(resolve=>{releaseGoals=resolve;});
 const server=createServer(async(req,res)=>{
  if(req.url==='/goals.json')await goalsGate;
  try{res.setHeader('Content-Type',req.url==='/goals.json'?'application/json':req.url.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(new URL('../docs'+(req.url==='/'?'/index.html':req.url),import.meta.url)));}
  catch{res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await waitFor(`document.body?.dataset.state==='loading'`);
 const loading=await evaluate(`({hidden:getComputedStyle(document.querySelector('main')).visibility,opacity:getComputedStyle(document.querySelector('main')).opacity,inert:document.querySelector('main').inert,loader:getComputedStyle(document.querySelector('.page-loader')).display,width:document.querySelector('main').getBoundingClientRect().width,gutter:getComputedStyle(document.documentElement).scrollbarGutter})`);
 assert.equal(loading.hidden,'hidden');assert.equal(loading.opacity,'0');assert.equal(loading.inert,true);
 assert.notEqual(loading.loader,'none');assert.equal(loading.gutter,'stable');
 releaseGoals();
 await waitFor(`document.body.dataset.state==='ready'&&Number(getComputedStyle(document.querySelector('main')).opacity)>0&&Number(getComputedStyle(document.querySelector('main')).opacity)<1`);
 const revealed=await evaluate(`({segments:segments.children.length,cards:document.querySelectorAll('.goal-card').length,font:document.fonts.check('900 40px WheelWordmark'),width:document.querySelector('main').getBoundingClientRect().width,inert:document.querySelector('main').inert,loader:getComputedStyle(document.querySelector('.page-loader')).display})`);
 assert.equal(revealed.segments,17);assert.equal(revealed.cards,18);assert.equal(revealed.font,true);
 assert.equal(revealed.width,loading.width);assert.equal(revealed.inert,false);assert.equal(revealed.loader,'none');
 await waitFor(`getComputedStyle(document.querySelector('main')).opacity==='1'`);
 await waitFor(`document.querySelectorAll('.rotation-surface').length===3`);
 await evaluate('document.fonts.ready');
 const flipAnimation=await evaluate(`(async()=>{
  const card=document.querySelector('.goal-card'),rotor=card.querySelector('.card-rotor');
  card.scrollIntoView({block:'center'});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const b=card.getBoundingClientRect();
  const push=x=>card.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x}));
  push(b.x+b.width*.25);
  await new Promise(resolve=>setTimeout(resolve,100));
  const running=rotor.getAnimations(),matrix=getComputedStyle(rotor).transform;
  const result={running:running.length,matrix,background:getComputedStyle(card.closest('.goal-tile')).backgroundColor};
  await Promise.all(running.map(animation=>animation.finished));
  push(b.x+b.width*.75);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await Promise.all(rotor.getAnimations().map(animation=>animation.finished));
  return result;
 })()`);
 assert.equal(flipAnimation.background,'rgba(0, 0, 0, 0)','The tile container must stay transparent behind the rotating faces.');
 assert.ok(flipAnimation.running>0,'Flipping must animate, including when the system requests reduced motion.');
 assert.ok(flipAnimation.matrix.startsWith('matrix3d('),'The flip must visibly pass through a 3D intermediate orientation.');
 const cadence=await evaluate(`(async()=>{
  const card=document.querySelectorAll('.goal-card')[1],settings=tileInteractions.settings;
  const push=()=>{card.click();return parseFloat(card.style.getPropertyValue('--flip-duration'));};
  const durations=Array.from({length:16},push);
  await new Promise(resolve=>setTimeout(resolve,settings.repeatWindowMs+30));
  const reset=push();push();
  return {durations,reset,initial:settings.initialFlipMs,minimum:settings.minimumFlipMs};
 })()`);
 assert.equal(cadence.durations[0],cadence.initial);
 assert.ok(cadence.durations[1]<cadence.durations[0],'Sustained clicking must speed up the flips.');
 assert.equal(cadence.durations.at(-1),cadence.minimum,'Repeated clicking must respect the speed limit.');
 assert.equal(cadence.reset,cadence.initial,'A pause must restore the slower first flip.');
 const cardCount=await evaluate(`document.querySelectorAll('.goal-card').length`);
 assert.equal(cardCount,18);
 for(const [side,angle] of [['left',-180],['left',-360],['right',-180],['right',0]]){
  const point=await evaluate(`(()=>{
   const card=document.querySelector('.goal-card');card.scrollIntoView({block:'center'});
   const b=card.getBoundingClientRect();return {x:b.x+b.width*${side==='left'?.25:.75},y:b.y+b.height/2};
  })()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  const card=await evaluate(`(()=>{const b=document.querySelector('.goal-card');return {turn:b.style.getPropertyValue('--turn'),expanded:b.getAttribute('aria-expanded'),backHidden:b.querySelector('.card-back').getAttribute('aria-hidden'),cursor:getComputedStyle(b).cursor,selection:getComputedStyle(document.body).userSelect}})()`);
  assert.equal(card.turn,angle+'deg',`${side} pushes must turn in that direction on either face.`);
  assert.equal(card.expanded,String(Math.abs(angle%360)===180));
  assert.equal(card.backHidden,String(angle%360===0));
  assert.equal(card.cursor,'pointer');
  assert.equal(card.selection,'none');
 }
 await nextFrames();
 await evaluate(`Promise.all(document.getAnimations().map(animation=>animation.finished))`);
 for(const width of [1440,1000,768,521,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  const positions=await evaluate(`([...document.querySelectorAll('.goal-tile:not(.wheel-tile)')].map(tile=>{
   const box=tile.getBoundingClientRect(),icon=tile.querySelector('svg').getBoundingClientRect(),title=tile.querySelector('h2');
   const text=document.createRange();text.selectNodeContents(title);
   return {offset:icon.y-box.y,size:icon.width,titleFits:text.getBoundingClientRect().bottom<=icon.top};
  }))`);
  const backs=await evaluate(`([...document.querySelectorAll('.goal-tile:not(.wheel-tile) .card-back')].map(back=>({fits:back.scrollHeight<=back.clientHeight&&back.scrollWidth<=back.clientWidth,overflow:getComputedStyle(back).overflow,headers:back.querySelectorAll('strong,h2').length})))`);
  for(const back of backs){
   assert.ok(back.fits,`${width}px: explanatory text must fit without scrolling.`);
   assert.equal(back.overflow,'hidden');
   assert.equal(back.headers,0);
  }
  const first=positions[0];
  for(const p of positions){
   assert.ok(Math.abs(p.offset-first.offset)<1&&Math.abs(p.size-first.size)<1,`${width}px: tile icons must share size and vertical position regardless of title wrapping.`);
   assert.ok(p.titleFits,`${width}px: goal titles must not overlap their icons.`);
  }
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const iconBounds=await evaluate(`(()=>{
  const probe=document.createElementNS('http://www.w3.org/2000/svg','svg');
  document.body.append(probe);
  const bounds=[...document.querySelectorAll('#symbols symbol')].map(symbol=>{
   const drawing=symbol.firstElementChild.cloneNode(true);
   probe.replaceChildren(drawing);
   const b=drawing.getBBox(),halfStroke=Number(drawing.getAttribute('stroke-width'))/2;
   return {id:symbol.id,left:b.x-halfStroke,top:b.y-halfStroke,right:b.x+b.width+halfStroke,bottom:b.y+b.height+halfStroke};
  });
  probe.remove();return bounds;
 })()`);
 assert.equal(iconBounds.length,17);
 for(const b of iconBounds)assert.ok(b.left>=2&&b.top>=2&&b.right<=30&&b.bottom<=30,`${b.id}: painted strokes must retain the two-unit safe margin: ${JSON.stringify(b)}`);
 const selectors=['.wheel','.wheel-title svg svg','.wheel-tile svg'];
 const iconRotation=await evaluate(`(()=>{
  rotation=73;renderRotation();
  const result=[...segments.querySelectorAll('use')].map(icon=>{
   const m=icon.getCTM();
   const centre=new DOMPoint(icon.x.baseVal.value+icon.width.baseVal.value/2,icon.y.baseVal.value+icon.height.baseVal.value/2).matrixTransform(m);
   const wheelCentre=new DOMPoint(360,360).matrixTransform(document.querySelector('.wheel').getCTM());
   return {angle:Math.atan2(m.b,m.a)*180/Math.PI,radius:Math.hypot(centre.x-wheelCentre.x,centre.y-wheelCentre.y)/Math.hypot(m.a,m.b)};
  });
  rotation=0;renderRotation();return {upright:wheelSettings.keepIconsUpright,icons:result};
 })()`);
 assert.equal(iconRotation.icons.length,17);
 for(const icon of iconRotation.icons){
  assert.ok(Math.abs(icon.angle-(iconRotation.upright?0:73))<.001,'Icon orientation must follow the shared switch.');
  assert.ok(Math.abs(icon.radius-263)<.001,'Icons must orbit with their segments.');
 }
 const state=()=>evaluate(`({angle:rotation,coasting:coastFrame!==null,dragging:drag!==null,
  main:segments.getAttribute('transform'),small:document.getElementById('wordmark-wheel').getAttribute('transform'),
  tile:document.getElementById('tile-wheel').getAttribute('transform')})`);
 async function geometry(selector){
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
  await nextFrames();
  return evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,r:r.width*.38}})()`);
 }
 async function dragArc(selector,{touch=false,start=null,end=null,hold=0,cancel=false}={}){
  const g=await geometry(selector);
  if(start===null){
   const current=(await state()).angle;
   start=-90+180/17+(selector===selectors[1]?-current:current);
   if(await evaluate(`document.querySelector(${JSON.stringify(selector)}).closest('.goal-card')?.getAttribute('aria-expanded')==='true'`))start=180-start;
  }
  if(end===null)end=start+90;
  const position=angle=>({x:g.x+g.r*Math.cos(angle*Math.PI/180),y:g.y+g.r*Math.sin(angle*Math.PI/180)});
  const from=position(start);
  if(touch)await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
  else await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...from});
  for(let i=1;i<=8;i++){
   const point=position(start+(end-start)*i/8);
   if(touch)await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});
   else await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,...point});
   await delay(12);
  }
  if(hold)await delay(hold);
  if(touch)await call('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  else await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...position(end)});
 }
 for(const selector of selectors){
  const g=await geometry(selector);
  const hits=await evaluate(`(()=>{
   const surface=document.querySelector(${JSON.stringify(selector)});
   const hit=(x,y)=>{const p=new DOMPoint(x,y).matrixTransform(surface.getScreenCTM());const target=document.elementFromPoint(p.x,p.y);return target===surface||surface.contains(target)};
   const mid=(-90+180/17)*Math.PI/180;
   return {centre:hit(360,360),gap:hit(360,86),
    outside:hit(710,360),
    leaf:hit(360+274*Math.cos(mid),360+274*Math.sin(mid))};
  })()`);
  assert.deepEqual(hits,{centre:false,gap:false,outside:false,leaf:true},`${selector}: only leaves may intercept input.`);
 }
 for(const selector of selectors){
  const before=await state();
  await dragArc(selector,{hold:200});
  const after=await state();
  assert.ok(Math.abs(after.angle-before.angle-(selector===selectors[1]?-90:90))<2,`${selector}: clockwise drag must follow the pointer (${before.angle} -> ${after.angle}).`);
  const angle=((after.angle%360)+360)%360;
  assert.equal(after.small,`rotate(${-angle} 360 360)`,'The O must counter-rotate.');
  assert.equal(after.tile,after.main,'The final tile must follow the main wheel.');
  assert.equal(after.coasting,false,'Holding still before release must not fling.');
  assert.equal(after.dragging,false);
 }
 await dragArc('.wheel',{start:175,end:195,hold:200});
 const seam=await state();
 assert.ok(Math.abs(seam.angle-110)<2,'Crossing the angle seam must not reverse or jump.');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 assert.equal((await state()).angle,seam.angle,'Keyboard input must not rotate the wheels.');

 await dragArc('.wheel');
 assert.ok((await state()).coasting,'Explicit flinging must coast with reduced motion too, matching Bolt.');
 await evaluate('stopRotation()');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await dragArc('.wheel');
 const release=await state();
 assert.ok(release.coasting,'A fling must coast after release.');
 await delay(80);
 assert.ok((await state()).angle>release.angle,'Inertia must continue in the release direction.');
 const g=await geometry('.wheel');
 const hitAngle=(-90+180/17+(await state()).angle)*Math.PI/180;
 const hit={x:g.x+g.r*Math.cos(hitAngle),y:g.y+g.r*Math.sin(hitAngle)};
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...hit});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...hit});
 const stopped=await state();
 await delay(100);
 assert.equal((await state()).angle,stopped.angle,'Pressing a wheel must stop inertia.');
 await dragArc('.wheel',{hold:200});
 assert.equal((await state()).coasting,false,'Holding still before release must not fling.');
 await dragArc('.wheel');
 await waitFor('coastFrame===null');
 const settled=await state();
 await delay(100);
 assert.equal((await state()).angle,settled.angle,'Inertia must settle without more scheduled motion.');

 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await dragArc('.wheel-tile svg',{touch:true});
 assert.ok((await state()).coasting,'Touch release must also coast.');
 await evaluate(`window.dispatchEvent(new Event('blur'))`);
 assert.equal((await state()).coasting,false,'Losing window focus must stop motion.');
 await dragArc('.wheel',{touch:true,cancel:true});
 await waitFor('drag===null');
 const cancelled=await state();
 assert.equal(cancelled.dragging,false);
 assert.equal(cancelled.coasting,false,'Cancelled gestures must not fling.');
 await delay(100);
 assert.equal((await state()).angle,cancelled.angle);
 assert.equal(cancelled.main,cancelled.tile);
 assert.equal(cancelled.small,`rotate(${-(((cancelled.angle%360)+360)%360)} 360 360)`);
 assert.equal(await evaluate(`wheelTile.querySelector('button').getAttribute('aria-expanded')`),'false','Spinning must not flip the wheel card.');
 await evaluate(`(async()=>{
  const card=wheelTile.querySelector('button');card.click();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await Promise.all(card.getAnimations({subtree:true}).map(animation=>animation.finished));
 })()`);
 assert.equal(await evaluate(`wheelTile.querySelectorAll('svg').length`),1,'Both sides must share one SVG.');
 assert.ok(await evaluate(`new DOMMatrix(getComputedStyle(wheelTile.querySelector('.card-rotor')).transform).m11<0`),'The reverse must show the same wheel mirrored.');
 const reverseBefore=(await state()).angle;
 await dragArc('.wheel-tile svg',{touch:true,hold:200});
 assert.ok((await state()).angle<reverseBefore-30,'Dragging the mirrored face must follow the pointer with reversed rotation.');
 assert.equal(await evaluate(`wheelTile.querySelector('button').getAttribute('aria-expanded')`),'true','Dragging the reverse must not flip it.');
 console.log('SSDG: wheels share pointer/touch rotation with a counter-rotating O; seam, inertia, stopping, cancellation, settling, reduced motion, and no keyboard rotation passed.');
 }finally{releaseGoals();await new Promise(resolve=>server.close(resolve));}
}
