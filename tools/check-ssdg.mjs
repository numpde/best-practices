import assert from 'node:assert/strict';

// Exercise actual pointer input and the shared SVG references, including the
// wordmark's tiny O. A parallel timer per wheel would drift under these checks.
export async function checkSSDG({call,evaluate,waitFor,delay,nextFrames}){
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Emulation.setTouchEmulationEnabled',{enabled:false});
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await call('Page.navigate',{url:new URL('../docs/index.html',import.meta.url).href});
 await waitFor(`document.querySelectorAll('.rotation-surface').length===3`);
 await evaluate('document.fonts.ready');
 for(const width of [1440,768,390]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  const positions=await evaluate(`([...document.querySelectorAll('.goal-tile:not(.wheel-tile)')].map(tile=>{
   const box=tile.getBoundingClientRect(),icon=tile.querySelector('svg').getBoundingClientRect(),title=tile.querySelector('h2');
   return {offset:icon.y-box.y,size:icon.width,titleFits:title.scrollHeight<=title.clientHeight};
  }))`);
  const first=positions[0];
  for(const p of positions){
   assert.ok(Math.abs(p.offset-first.offset)<1&&Math.abs(p.size-first.size)<1,`${width}px: tile icons must share size and vertical position regardless of title wrapping.`);
   assert.ok(p.titleFits,`${width}px: goal titles must fit their reserved row.`);
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
  rotation=0;renderRotation();return {upright:keepWheelIconsUpright,icons:result};
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
 const cancelled=await state();
 assert.equal(cancelled.dragging,false);
 assert.equal(cancelled.coasting,false,'Cancelled gestures must not fling.');
 await delay(100);
 assert.equal((await state()).angle,cancelled.angle);
 assert.equal(cancelled.main,cancelled.tile);
 assert.equal(cancelled.small,`rotate(${-(((cancelled.angle%360)+360)%360)} 360 360)`);
 console.log('SSDG: wheels share pointer/touch rotation with a counter-rotating O; seam, inertia, stopping, cancellation, settling, reduced motion, and no keyboard rotation passed.');
}
