import assert from 'node:assert/strict';
import {checkCardGrab} from './check-card-grab.mjs';
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
 const sliderPoint=await evaluate(`(()=>{
  const button=document.querySelector('[aria-label="Informed control"]');button.scrollIntoView({block:'center'});
  const svg=button.querySelector('svg'),b=button.getBoundingClientRect();
  const p=new DOMPoint(7,16).matrixTransform(svg.getScreenCTM());
  return {x:p.x,top:b.top+2,bottom:b.bottom-2};
 })()`);
 const sliderState=()=>evaluate(`(()=>{
  const drawing=document.querySelector('#icon-control');
  return {positions:[...drawing.querySelectorAll('[data-motion-part="slider"]')].map(s=>s.y.baseVal.value)};
 })()`);
 const originalSliders=await sliderState();
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:sliderPoint.x,y:sliderPoint.bottom});
 const movedSliders=await sliderState();
 assert.equal(movedSliders.positions[0],22,'The nearest slider must stop at the bottom of its track.');
 assert.deepEqual(movedSliders.positions.slice(1),originalSliders.positions.slice(1));
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Informed control"] svg').innerHTML,wheel:document.querySelector('[data-goal="control"] use').getAttribute('href')})`),{tile:'<use href="#icon-control"></use>',wheel:'#icon-control'},'Both instances must reference one drawing without a copy.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await sliderState(),movedSliders,'Sliders must freeze on mouse leave.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:sliderPoint.x,y:sliderPoint.top});
 assert.equal((await sliderState()).positions[0],4,'The slider must stop at the top of its track.');
 const clockPoint=await evaluate(`(()=>{
  const svg=document.querySelector('[aria-label="Honest state and effects"] svg');svg.scrollIntoView({block:'center'});
  const p=new DOMPoint(26,16).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};
 })()`);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...clockPoint});
 const handTransform=()=>evaluate(`document.querySelector('#icon-effects [data-motion-part="minute"]').getAttribute('transform')`);
 const clockPosition=await handTransform();
 assert.ok(Math.abs(parseFloat(clockPosition.slice(7))-90)<.001,'The shared clock hand must point toward the mouse.');
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Honest state and effects"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="effects"] use').getAttribute('href')})`),{tile:'#icon-effects',wheel:'#icon-effects'});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.equal(await handTransform(),clockPosition,'The clock hand must hold its position on mouse leave.');
 const dial=await evaluate(`(()=>{
  const svg=document.querySelector('[aria-label="Honest state and effects"] svg');svg.scrollIntoView({block:'center'});
  const m=svg.getScreenCTM(),p=new DOMPoint(16,16).matrixTransform(m);
  return {x:p.x,y:p.y,r:10*Math.hypot(m.a,m.b)};
 })()`);
 for(const angle of [170,250,330,410,450]){
  const radians=(angle-90)*Math.PI/180;
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:dial.x+dial.r*Math.cos(radians),y:dial.y+dial.r*Math.sin(radians)});
 }
 const clockHands=()=>evaluate(`['minute','hour'].map(part=>parseFloat(document.querySelector('#icon-effects [data-motion-part="'+part+'"]').getAttribute('transform').slice(7)))`);
 let hands=await clockHands();
 assert.ok(Math.abs(hands[0]-450)<.001&&Math.abs(hands[1]-37.5)<.001,'A full minute-hand turn must advance the hour hand by 30 degrees without resetting at the seam.');
 for(const angle of [370,290,210,130,50,-30,-110,-190,-270]){
  const radians=(angle-90)*Math.PI/180;
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:dial.x+dial.r*Math.cos(radians),y:dial.y+dial.r*Math.sin(radians)});
 }
 hands=await clockHands();
 assert.ok(Math.abs(hands[0]+270)<.001&&Math.abs(hands[1]+22.5)<.001,'Turning backwards must reverse both hands at the same 12:1 ratio.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await clockHands(),hands,'Both hands must freeze on mouse leave.');
 const barPoint=await evaluate(`(()=>{
  const card=document.querySelector('[aria-label="Bounded resource use"]');card.scrollIntoView({block:'center'});
  const b=card.getBoundingClientRect(),p=new DOMPoint(10,16).matrixTransform(card.querySelector('svg').getScreenCTM());
  return {x:p.x,top:b.top+2,bottom:b.bottom-2};
 })()`);
 const barPositions=()=>evaluate(`([...document.querySelectorAll('#icon-resources [data-motion-part="bar"]')].map(bar=>bar.y2.baseVal.value))`);
 const originalBars=await barPositions();
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:barPoint.x,y:barPoint.top});
 let bars=await barPositions();
 assert.equal(bars[0],8,'A resource bar must stop below the frame ceiling.');
 assert.deepEqual(bars.slice(1),originalBars.slice(1),'Only the nearest bar should move.');
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Bounded resource use"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="resources"] use').getAttribute('href')})`),{tile:'#icon-resources',wheel:'#icon-resources'});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await barPositions(),bars,'Resource bars must retain their values on mouse leave.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:barPoint.x,y:barPoint.bottom});
 assert.equal((await barPositions())[0],22,'A resource bar must not fall below its baseline.');
 const recoveryDial=await evaluate(`(()=>{
  const svg=document.querySelector('[aria-label="Dependable recovery"] svg');svg.scrollIntoView({block:'center'});
  const m=svg.getScreenCTM(),p=new DOMPoint(16,16).matrixTransform(m);return {x:p.x,y:p.y,r:10*Math.hypot(m.a,m.b)};
 })()`);
 const recoveryState=()=>evaluate(`({arrow:document.querySelector('#icon-recovery [data-motion-part="arrow"]').getAttribute('transform'),check:document.querySelector('#icon-recovery [data-motion-part="check"]').getAttribute('transform')})`);
 for(const angle of [0,90,180,270,360]){
  const radians=(angle-90)*Math.PI/180;
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:recoveryDial.x+recoveryDial.r*Math.cos(radians),y:recoveryDial.y+recoveryDial.r*Math.sin(radians)});
 }
 const recovery=await recoveryState();
 assert.ok(Math.abs(parseFloat(recovery.arrow.slice(7))-360)<.001,'The recovery arrow must advance through a complete turn.');
 assert.equal(recovery.check,null,'The check must stay steady as the arrow turns.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await recoveryState(),recovery,'The recovery arrow must freeze on mouse leave.');
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Dependable recovery"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="recovery"] use').getAttribute('href')})`),{tile:'#icon-recovery',wheel:'#icon-recovery'});
 const recoveryMargin=await evaluate(`(async()=>{
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('width','320');svg.setAttribute('height','320');
  svg.append(document.querySelector('#icon-recovery').firstElementChild.cloneNode(true));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=320;const ctx=canvas.getContext('2d');
  let margin=320,painted=0;
  for(let angle=0;angle<360;angle+=15){
   svg.querySelector('[data-motion-part="arrow"]').setAttribute('transform','rotate('+angle+' 16 16)');
   const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await image.decode();
   ctx.clearRect(0,0,320,320);ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,320,320).data;
   for(let y=0;y<320;y++)for(let x=0;x<320;x++)if(pixels[(y*320+x)*4+3]){painted++;margin=Math.min(margin,x,y,319-x,319-y);}
  }
  return {margin,painted};
 })()`);
 assert.ok(recoveryMargin.painted>0&&recoveryMargin.margin>=20,'The rounded arrow must retain a two-unit painted margin through a full rotation.');
 const bookPoint=await evaluate(`(()=>{
  const card=document.querySelector('[aria-label="Transferable knowledge"]');card.scrollIntoView({block:'center'});
  const b=card.getBoundingClientRect(),p=new DOMPoint(16,16).matrixTransform(card.querySelector('svg').getScreenCTM());
  return {x:p.x,y:p.y,left:b.left+2,right:b.right-2};
 })()`);
 const bookState=()=>evaluate(`(()=>{
  const symbol=document.querySelector('#icon-knowledge'),page=symbol.querySelector('[data-motion-part="page"]'),m=page.transform.baseVal.getItem(0).matrix;
  return {count:symbol.querySelectorAll('[data-motion-part="page"]').length,scale:m.a,tilt:m.b,hingeX:m.a*16+m.e,hingeY:m.b*16+8+m.f,cover:symbol.querySelector('[data-motion-part="cover"]').getAttribute('transform'),spine:symbol.querySelector('[data-motion-part="spine"]').getAttribute('transform')};
 })()`);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:bookPoint.right,y:bookPoint.y});
 let book=await bookState();assert.equal(book.count,1,'Only one sheet should turn.');assert.equal(book.scale,1,'The page must lie on the right at one end.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:bookPoint.x,y:bookPoint.y});
 book=await bookState();assert.ok(Math.abs(book.scale)<.001&&book.tilt<0,'The sheet must turn edge-on and lift across the spine.');
 assert.ok(Math.abs(book.hingeX-16)<.001&&Math.abs(book.hingeY-8)<.001,'The page must remain attached to the spine.');
 assert.equal(book.cover,null);assert.equal(book.spine,null);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:bookPoint.left,y:bookPoint.y});
 book=await bookState();assert.equal(book.scale,-1,'The same page must land on the left.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:bookPoint.right,y:bookPoint.y});
 book=await bookState();assert.equal(book.scale,1,'Moving back must turn the page back to the right.');
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Transferable knowledge"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="knowledge"] use').getAttribute('href')})`),{tile:'#icon-knowledge',wheel:'#icon-knowledge'});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await bookState(),book,'The shared page must stay where it was left.');
 const lockPoints=await evaluate(`(()=>{
  const svg=document.querySelector('[aria-label="Protected information"] svg');svg.scrollIntoView({block:'center'});
  const m=svg.getScreenCTM(),point=angle=>{const r=angle*Math.PI/180,p=new DOMPoint(19-6*Math.cos(r),14-6*Math.sin(r)).matrixTransform(m);return {x:p.x,y:p.y};};
  return {closed:point(0),partial:point(30),beyond:point(60),below:point(-30)};
 })()`);
 const lockState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-information'),shackle=s.querySelector('[data-motion-part="shackle"]'),m=shackle.transform.baseVal.getItem(0).matrix;
  return {angle:shackle.transform.baseVal.getItem(0).angle,hingeX:m.a*19+m.c*14+m.e,hingeY:m.b*19+m.d*14+m.f,steady:['shield','body','keyhole'].map(part=>s.querySelector('[data-motion-part="'+part+'"]').getAttribute('transform'))};
 })()`);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...lockPoints.partial});
 let lock=await lockState();assert.ok(Math.abs(lock.angle-30)<.001,'The shackle must follow the actual mouse angle around its hinge.');
 assert.ok(Math.abs(lock.hingeX-19)<.001&&Math.abs(lock.hingeY-14)<.001,'The shackle must stay attached to the lock body.');
 assert.deepEqual(lock.steady,[null,null,null],'The shield, body, and keyhole must remain steady.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...lockPoints.beyond});
 lock=await lockState();assert.equal(lock.angle,45,'The shackle must respect its opening limit.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await lockState(),lock,'The shared lock must hold its opening on mouse leave.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...lockPoints.closed});
 lock=await lockState();assert.ok(Math.abs(lock.angle)<.001,'Moving toward the resting free end must close the lock.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...lockPoints.below});
 assert.equal((await lockState()).angle,0,'The shackle must not swing through the lock body.');
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Protected information"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="information"] use').getAttribute('href')})`),{tile:'#icon-information',wheel:'#icon-information'});
 const flipAnimation=await evaluate(`(async()=>{
  const card=document.querySelector('.goal-card'),rotor=card.querySelector('.card-rotor');
  card.scrollIntoView({block:'center'});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const b=card.getBoundingClientRect();
  const push=x=>card.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x}));
  push(b.x+b.width*.25);
  await new Promise(resolve=>setTimeout(resolve,100));
  const current=parseFloat(card.style.getPropertyValue('--turn')),matrix=getComputedStyle(rotor).transform;
  const result={running:current<0&&current>-180,matrix,background:getComputedStyle(card.closest('.goal-tile')).backgroundColor};
  await new Promise(resolve=>{const check=()=>parseFloat(card.style.getPropertyValue('--turn'))===-180?resolve():requestAnimationFrame(check);check();});
  push(b.x+b.width*.75);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await new Promise(resolve=>{const check=()=>parseFloat(card.style.getPropertyValue('--turn'))===0?resolve():requestAnimationFrame(check);check();});
  return result;
 })()`);
 assert.equal(flipAnimation.background,'rgba(0, 0, 0, 0)','The tile container must stay transparent behind the rotating faces.');
 assert.ok(flipAnimation.running,'Flipping must animate, including when the system requests reduced motion.');
 assert.ok(flipAnimation.matrix.startsWith('matrix3d('),'The flip must visibly pass through a 3D intermediate orientation.');
 const cadence=await evaluate(`(async()=>{
  const card=document.querySelectorAll('.goal-card')[1],settings=tileInteractions.settings;
  let target=0;
  const push=()=>{target-=settings.snapDegrees;card.click();};
  const measure=async(count)=>{
   const start=performance.now();for(let i=0;i<count;i++)push();
   await new Promise(resolve=>{const check=()=>parseFloat(card.style.getPropertyValue('--turn'))===target?resolve():requestAnimationFrame(check);check();});
   return performance.now()-start;
  };
  const first=await measure(1),burst=await measure(16);
  await new Promise(resolve=>setTimeout(resolve,settings.repeatWindowMs+30));
  const reset=await measure(1);
  return {first,burst,reset,initial:settings.initialFlipMs,minimum:settings.minimumFlipMs};
 })()`);
 assert.ok(Math.abs(cadence.first-cadence.initial)<120,'The first flip must use the slower configured duration.');
 assert.ok(cadence.burst<cadence.first*.6&&Math.abs(cadence.burst-cadence.minimum)<120,'Sustained clicking must accelerate to the configured speed limit.');
 assert.ok(Math.abs(cadence.reset-cadence.initial)<120,'A pause must restore the slower first flip.');
 const cardCount=await evaluate(`document.querySelectorAll('.goal-card').length`);
 assert.equal(cardCount,18);
 for(const [side,angle] of [['left',-180],['left',-360],['right',-180],['right',0]]){
  const point=await evaluate(`(()=>{
   const card=document.querySelector('.goal-card');card.scrollIntoView({block:'center'});
   const b=card.getBoundingClientRect();return {x:b.x+b.width*${side==='left'?.25:.75},y:b.y+b.height/2};
  })()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await waitFor(`parseFloat(document.querySelector('.goal-card').style.getPropertyValue('--turn'))===${angle}`);
  const card=await evaluate(`(()=>{const b=document.querySelector('.goal-card');return {turn:b.style.getPropertyValue('--turn'),expanded:b.getAttribute('aria-expanded'),backHidden:b.querySelector('.card-back').getAttribute('aria-hidden'),cursor:getComputedStyle(b).cursor,selection:getComputedStyle(document.body).userSelect}})()`);
  assert.equal(card.turn,angle+'deg',`${side} pushes must turn in that direction on either face.`);
  assert.equal(card.expanded,String(Math.abs(angle%360)===180));
  assert.equal(card.backHidden,String(angle%360===0));
  assert.equal(card.cursor,'grab');
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
  assert.deepEqual(hits,{centre:false,gap:false,outside:false,leaf:true},`${selector}: only leaves may intercept wheel input.`);
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
  await new Promise(resolve=>{const check=()=>Math.abs(parseFloat(card.style.getPropertyValue('--turn'))%360)===180?resolve():requestAnimationFrame(check);check();});
 })()`);
 assert.equal(await evaluate(`wheelTile.querySelectorAll('svg').length`),1,'Both sides must share one SVG.');
 assert.ok(await evaluate(`new DOMMatrix(getComputedStyle(wheelTile.querySelector('.card-rotor')).transform).m11<0`),'The reverse must show the same wheel mirrored.');
 const reverseBefore=(await state()).angle;
 await dragArc('.wheel-tile svg',{touch:true,hold:200});
 assert.ok((await state()).angle<reverseBefore-30,'Dragging the mirrored face must follow the pointer with reversed rotation.');
 assert.equal(await evaluate(`wheelTile.querySelector('button').getAttribute('aria-expanded')`),'true','Dragging the reverse must not flip it.');
 await checkCardGrab({call,evaluate,waitFor,delay,nextFrames});
 console.log('SSDG: wheels share pointer/touch rotation with a counter-rotating O; seam, inertia, stopping, cancellation, settling, reduced motion, and no keyboard rotation passed.');
 }finally{releaseGoals();await new Promise(resolve=>server.close(resolve));}
}
