import assert from 'node:assert/strict';

export async function checkIconInteractions({call,evaluate}){
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
 const layerPoints=await evaluate(`(()=>{
  const card=document.querySelector('[aria-label="Understandable design"]');card.scrollIntoView({block:'center'});
  const b=card.getBoundingClientRect(),svg=card.querySelector('svg'),p=new DOMPoint(16,16).matrixTransform(svg.getScreenCTM());
  return {x:p.x,top:b.top+2,bottom:b.bottom-2,middle:p.y};
 })()`);
 const layerState=()=>evaluate(`([...document.querySelectorAll('#icon-design [data-motion-part="layer"]')].map(layer=>layer.transform.baseVal.getItem(0).matrix.f))`);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:layerPoints.x,y:layerPoints.bottom});
 assert.deepEqual(await layerState(),[5,2.5,0],'Moving down must compress the layers around a fixed base.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:layerPoints.x,y:layerPoints.middle});
 assert.ok((await layerState()).every((offset,index)=>Math.abs(offset-[2.5,1.25,0][index])<.001),'The layer spacing must follow the actual vertical pointer position.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:layerPoints.x,y:layerPoints.top});
 const layers=await layerState();assert.deepEqual(layers,[0,0,0],'Moving up must restore the separated layers within their safe bounds.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await layerState(),layers,'Layer positions must freeze on mouse leave.');
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Understandable design"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="design"] use').getAttribute('href')})`),{tile:'#icon-design',wheel:'#icon-design'});
 const glassPoints=await evaluate(`(()=>{
  const card=document.querySelector('[aria-label="Trustworthy evidence"]');card.scrollIntoView({block:'center'});
  const svg=card.querySelector('svg'),b=card.getBoundingClientRect(),p=new DOMPoint(16,15).matrixTransform(svg.getScreenCTM());
  return {inside:{x:p.x,y:p.y},near:{x:b.left+2,y:b.top+2},far:{x:b.right-2,y:b.bottom-2}};
 })()`);
 const glassState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-evidence'),m=s.querySelector('[data-motion-part="magnifier"]').transform.baseVal.getItem(0).matrix;
  return {x:m.e,y:m.f,check:s.querySelector('[data-motion-part="check"]').getAttribute('transform')};
 })()`);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...glassPoints.inside});
 let glass=await glassState();assert.ok(Math.abs(glass.x-3)<.001&&Math.abs(glass.y-2)<.001,'The lens must follow the pointer directly within its travel limits.');
 assert.equal(glass.check,null,'The evidence check must stay fixed under the moving magnifier.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...glassPoints.far});
 glass=await glassState();assert.deepEqual(glass,{x:3,y:3,check:null},'The lens and handle must stop within the lower-right safe boundary.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...glassPoints.near});
 glass=await glassState();assert.deepEqual(glass,{x:-2,y:-2,check:null},'The magnifier must stay within the upper-left safe boundary.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 assert.deepEqual(await glassState(),glass,'The shared magnifier must retain its position on mouse leave.');
 assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="Trustworthy evidence"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="evidence"] use').getAttribute('href')})`),{tile:'#icon-evidence',wheel:'#icon-evidence'});
 async function moveOnIcon(label,x,y){
  const point=await evaluate(`(()=>{
   const card=document.querySelector('[aria-label="'+${JSON.stringify(label)}+'"]');card.scrollIntoView({block:'center'});
   const p=new DOMPoint(${x},${y}).matrixTransform(card.querySelector('svg').getScreenCTM());return {x:p.x,y:p.y};
  })()`);
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
 }
 const cursorState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-interfaces'),m=s.querySelector('[data-motion-part="cursor"]').transform.baseVal.getItem(0).matrix;
  return {x:m.e,y:m.f,screen:s.querySelector('[data-motion-part="screen"]').getAttribute('transform')};
 })()`);
 await moveOnIcon('Usable interfaces',16,14);
 let cursor=await cursorState();assert.ok(Math.abs(cursor.x-4)<.001&&Math.abs(cursor.y-1)<.001,'The cursor tip must follow the actual pointer inside the screen.');
 assert.equal(cursor.screen,null,'The screen must remain steady.');
 await moveOnIcon('Usable interfaces',32,32);
 assert.deepEqual(await cursorState(),{x:9,y:2,screen:null},'The cursor must stop inside the lower-right screen boundary.');
 await moveOnIcon('Usable interfaces',0,0);
 cursor=await cursorState();assert.deepEqual(cursor,{x:-7,y:-7,screen:null},'The cursor must stop inside the upper-left screen boundary.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.deepEqual(await cursorState(),cursor);

 const snakePoints=await evaluate(`(()=>{
  const svg=document.querySelector('[aria-label="Reproducible results"] svg');svg.scrollIntoView({block:'center'});
  const m=svg.getScreenCTM(),point=angle=>{const r=(angle-90)*Math.PI/180,p=new DOMPoint(16+10*Math.cos(r),16+10*Math.sin(r)).matrixTransform(m);return {x:p.x,y:p.y};};
  return {start:point(0),between:point(45),quarter:point(90)};
 })()`);
 const assertSnakePositions=(pieces,positions,message)=>assert.ok(pieces.every((p,i)=>Math.abs(p.x-positions[i][0])<.001&&Math.abs(p.y-positions[i][1])<.001),message);
 const snakeState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-reproducibility');
  return {boxes:[...s.querySelectorAll('[data-motion-part="box"]')].map(node=>{const m=node.transform.baseVal.getItem(0).matrix;return {x:m.e,y:m.f,shape:node.querySelector('use').getAttribute('href')};}),bodies:[...s.querySelectorAll('[data-motion-part="body"]')].map((body,i)=>{const b=iconInteractions.bounds(body),tip=body.getPointAtLength(body.getTotalLength()),head=s.querySelectorAll('[data-motion-part="head"]')[i],m=head.transform.baseVal.getItem(0).matrix;return {path:body.getAttribute('d'),width:b.width,height:b.height,tipX:tip.x,tipY:tip.y,headX:m.e,headY:m.f,shape:head.getAttribute('href')};})};
 })()`);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...snakePoints.start});
 let snake=await snakeState();
 assertSnakePositions(snake.boxes,[[8.232233,8.232233],[23.767767,23.767767]],'Both boxes must occupy the rounded-square track.');
 assert.ok(snake.bodies.every(body=>body.width>5&&body.height>5),'The chain body must bend around the corners.');
 const initialBodies=snake.bodies.map(body=>body.path);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...snakePoints.between});
 snake=await snakeState();
 assertSnakePositions(snake.boxes,[[16,7.5],[16,24.5]],'The boxes must follow the snaking body along the square.');
 assert.ok(snake.bodies.every((body,i)=>body.path!==initialBodies[i]),'The body must change its bend as it moves along the track.');
 assert.ok(snake.bodies.every(body=>Math.abs(body.tipX-body.headX)<.001&&Math.abs(body.tipY-body.headY)<.001),'Arrowheads must remain attached to the snaking body.');
 assert.deepEqual(snake.boxes.map(node=>node.shape),['#reproducible-box','#reproducible-box']);
 assert.deepEqual(snake.bodies.map(node=>node.shape),['#reproducible-head','#reproducible-head']);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...snakePoints.quarter});
 snake=await snakeState();assertSnakePositions(snake.boxes,[[23.767767,8.232233],[8.232233,23.767767]],'A quarter turn must advance the whole chain to the next corners.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.deepEqual(await snakeState(),snake,'The chain must keep its shared position on mouse leave.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...snakePoints.start});
 assert.deepEqual(await snakeState(),snake,'Entering at another point must not jump the chain.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...snakePoints.between});
 snake=await snakeState();assertSnakePositions(snake.boxes,[[24.5,16],[7.5,16]],'Movement after re-entry must continue from the retained state.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...snakePoints.quarter});
 assert.deepEqual(await snakeState(),snake,'Repeated re-entry must preserve the current state.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...snakePoints.between});
 snake=await snakeState();assertSnakePositions(snake.boxes,[[23.767767,8.232233],[8.232233,23.767767]],'Moving backwards after re-entry must reverse from the retained position.');


 const bulbState=()=>evaluate(`({brightness:Number(document.querySelector('#icon-improvement [data-motion-part="bulb"]').getAttribute('opacity')),base:document.querySelector('#icon-improvement [data-motion-part="base"]').getAttribute('opacity')})`);
 await moveOnIcon('Reasoned improvement',16,12);
 let bulb=await bulbState();assert.ok(Math.abs(bulb.brightness-1)<.001,'The bulb must brighten as the mouse approaches its centre.');assert.equal(bulb.base,null,'The socket must remain steady.');
 await moveOnIcon('Reasoned improvement',21,12);
 assert.ok(Math.abs((await bulbState()).brightness-.725)<.001,'Brightness must follow actual pointer distance.');
 await moveOnIcon('Reasoned improvement',0,0);
 bulb=await bulbState();assert.equal(bulb.brightness,.45,'The bulb must retain a visible outline at its dimmest.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.deepEqual(await bulbState(),bulb);
 for(const [label,id] of [['Usable interfaces','interfaces'],['Reproducible results','reproducibility'],['Reasoned improvement','improvement']]){
  assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="'+${JSON.stringify(label)}+'"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="'+${JSON.stringify(id)}+'"] use').getAttribute('href')})`),{tile:'#icon-'+id,wheel:'#icon-'+id});
 }

 const ownershipState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-ownership'),signal=s.querySelector('[data-motion-part="signal"]');
  return {x:signal.cx.baseVal.value,y:signal.cy.baseVal.value,owner:s.querySelector('[data-motion-part="owner"]').getAttribute('transform'),records:[...s.querySelectorAll('[data-motion-part="record"]')].map(record=>record.getAttribute('transform'))};
 })()`);
 const ownerInitial=await ownershipState();
 await moveOnIcon('Clear ownership',16,16);assert.deepEqual(await ownershipState(),ownerInitial,'Entering must preserve the ownership signal.');
 await moveOnIcon('Clear ownership',24,16);let owner=await ownershipState();assert.ok(Math.abs(owner.x-6)<.001&&Math.abs(owner.y-25.5)<.001,'The signal must reach the left record along its branch.');
 await moveOnIcon('Clear ownership',32,16);owner=await ownershipState();assert.ok(Math.abs(owner.x-16)<.001&&Math.abs(owner.y-7)<.001,'Transfers between records must pass through the central owner.');
 await moveOnIcon('Clear ownership',40,16);owner=await ownershipState();assert.ok(Math.abs(owner.x-26)<.001&&Math.abs(owner.y-25.5)<.001,'The owner must route the signal to the other record.');
 assert.equal(owner.owner,null);assert.deepEqual(owner.records,[null,null]);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await moveOnIcon('Clear ownership',8,16);assert.deepEqual(await ownershipState(),owner);
 await moveOnIcon('Clear ownership',0,16);owner=await ownershipState();assert.ok(Math.abs(owner.x-16)<.001&&Math.abs(owner.y-7)<.001,'Reverse transfers must also return through the owner.');

 const evolutionState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-evolution'),branch=s.querySelector('[data-motion-part="branch"]'),start=branch.getPointAtLength(0),tip=branch.getPointAtLength(branch.getTotalLength()),head=s.querySelector('[data-motion-part="branch-head"]').transform.baseVal.getItem(0).matrix;
  return {start:[start.x,start.y],tip:[tip.x,tip.y],head:[head.e,head.f],trunk:s.querySelector('[data-motion-part="trunk"]').getAttribute('d')};
 })()`);
 await moveOnIcon('Coherent evolution',20,10);let evolution=await evolutionState();
 assert.ok(evolution.tip.every((v,i)=>Math.abs(v-[20,10][i])<.001),'The branch tip must track the actual pointer, not a distant offset.');
 assert.deepEqual(evolution.start,[7,22]);assert.ok(evolution.head.every((v,i)=>Math.abs(v-evolution.tip[i])<.001),'The arrowhead must stay attached to the curve tip.');assert.equal(evolution.trunk,'M7 25V8');
 await moveOnIcon('Coherent evolution',0,0);evolution=await evolutionState();assert.ok(evolution.tip.every((v,i)=>Math.abs(v-[18,3][i])<.001));assert.ok(evolution.head.every((v,i)=>Math.abs(v-evolution.tip[i])<.001),'The arrowhead must stay attached to the curve tip.');
 await moveOnIcon('Coherent evolution',32,32);evolution=await evolutionState();assert.ok(evolution.tip.every((v,i)=>Math.abs(v-[25,15][i])<.001));assert.ok(evolution.head.every((v,i)=>Math.abs(v-evolution.tip[i])<.001),'The arrowhead must stay attached to the curve tip.');assert.deepEqual(evolution.start,[7,22]);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.deepEqual(await evolutionState(),evolution);

 const completionState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-completion'),check=s.querySelector('[data-motion-part="check"]');
  return {height:s.querySelector('[data-motion-part="flag"]').transform.baseVal.getItem(0).matrix.f,unchecked:Number(check.getAttribute('stroke-dashoffset'))/check.getTotalLength(),visible:check.getAttribute('visibility'),pole:s.querySelector('[data-motion-part="pole"]').getAttribute('transform')};
 })()`);
 await moveOnIcon('Verified completion',16,16);let completion=await completionState();assert.equal(completion.height,0);assert.equal(completion.unchecked,0);
 await moveOnIcon('Verified completion',16,32);completion=await completionState();assert.ok(Math.abs(completion.height-9)<.001&&completion.unchecked<.001,'The flag must lower while retaining verification.');
 await moveOnIcon('Verified completion',16,40);completion=await completionState();assert.ok(Math.abs(completion.height-9)<.001&&Math.abs(completion.unchecked-.5)<.001,'The check must draw while the flag remains lowered.');
 await moveOnIcon('Verified completion',16,32);completion=await completionState();assert.ok(Math.abs(completion.height-9)<.001&&completion.unchecked<.001,'Verification must finish before raising begins.');
 await moveOnIcon('Verified completion',16,24);completion=await completionState();assert.ok(Math.abs(completion.height-4.5)<.001&&completion.unchecked<.001,'Only a verified flag may rise.');
 await moveOnIcon('Verified completion',16,16);completion=await completionState();assert.ok(Math.abs(completion.height)<.001&&completion.unchecked<.001);assert.equal(completion.pole,null);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await moveOnIcon('Verified completion',16,8);assert.deepEqual(await completionState(),completion,'Re-entry must retain the completion state.');
 await moveOnIcon('Verified completion',16,41);completion=await completionState();assert.ok(Math.abs(completion.height-9)<.001&&completion.unchecked>.999);assert.equal(completion.visible,'hidden');
 for(const [label,id] of [['Clear ownership','ownership'],['Coherent evolution','evolution'],['Verified completion','completion']]){
  assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="'+${JSON.stringify(label)}+'"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="'+${JSON.stringify(id)}+'"] use').getAttribute('href')})`),{tile:'#icon-'+id,wheel:'#icon-'+id});
 }

 assert.equal(await evaluate('goals.filter(goal=>goal.motion).length'),17,'Every goal must select its semantic interaction from the JSON source.');
 const taskState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-capabilities'),ink=s.querySelector('[data-motion-part="ink"]'),path=s.querySelector('[data-motion-part="trace"]');
  return {progress:1-Number(ink.getAttribute('stroke-dashoffset'))/path.getTotalLength(),visible:ink.getAttribute('visibility'),window:s.querySelector('[data-motion-part="window"]').getAttribute('transform'),references:[...s.querySelectorAll('use')].map(use=>use.getAttribute('href'))};
 })()`);
 await moveOnIcon('Useful capabilities',11,19);let task=await taskState();assert.equal(task.progress,0);assert.equal(task.visible,'hidden');
 await moveOnIcon('Useful capabilities',15,23);task=await taskState();assert.ok(Math.abs(task.progress-.3473)<.02,'The task check must trace its real bend under the mouse.');assert.equal(task.window,null);
 await moveOnIcon('Useful capabilities',22,15);task=await taskState();assert.equal(task.progress,1,'Reaching the end of the useful path must complete the check.');assert.deepEqual(task.references,['#capability-check','#capability-check']);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.deepEqual(await taskState(),task);

 const paperState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-results'),fold=s.querySelector('[data-motion-part="fold"]'),b=iconInteractions.bounds(fold);
  return {x:b.x,y:b.y,width:b.width,height:b.height,visible:fold.getAttribute('visibility'),content:s.querySelector('[data-motion-part="content"]').innerHTML,contentTransform:s.querySelector('[data-motion-part="content"]').getAttribute('transform'),outline:s.querySelector('[data-motion-part="paper"]').getAttribute('d')};
 })()`);
 const initialPaper=await paperState();
 await moveOnIcon('Faithful results',16,16);assert.deepEqual(await paperState(),initialPaper,'Moving away from the paper corner must not affect it.');
 await moveOnIcon('Faithful results',23,8);let paper=await paperState();assert.ok(Math.abs(paper.x-23)<.001&&Math.abs(paper.y+paper.height-8)<.001,'The folded tip must track the actual pointer at the paper corner.');
 assert.ok(Math.abs(paper.width-3)<.001&&Math.abs(paper.height-3)<.001);assert.equal(paper.content,initialPaper.content);assert.equal(paper.contentTransform,null);
 await moveOnIcon('Faithful results',16,20);assert.deepEqual(await paperState(),paper,'Motion elsewhere in the card must not fold the corner at a distance.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.deepEqual(await paperState(),paper);
 await moveOnIcon('Faithful results',22,9);paper=await paperState();assert.ok(Math.abs(paper.width-4)<.001&&Math.abs(paper.height-4)<.001,'The fold must stop in the blank margin before reaching content.');assert.equal(paper.content,initialPaper.content);
 await moveOnIcon('Faithful results',26.01,4.99);paper=await paperState();assert.equal(paper.visible,'hidden');assert.equal(paper.width,0);assert.equal(paper.height,0);

 const failureState=()=>evaluate(`(()=>{
  const s=document.querySelector('#icon-failures'),shaft=s.querySelector('[data-motion-part="shaft"]'),m=s.querySelector('[data-motion-part="head"]').transform.baseVal.getItem(0).matrix;
  return {x:shaft.x2.baseVal.value,y:shaft.y2.baseVal.value,headX:m.e,headY:m.f,tail:[shaft.x1.baseVal.value,shaft.y1.baseVal.value],error:s.querySelector('[data-motion-part="error"]').getAttribute('d'),errorTransform:s.querySelector('[data-motion-part="error"]').getAttribute('transform'),frame:s.querySelector('[data-motion-part="frame"]').getAttribute('transform')};
 })()`);
 await moveOnIcon('Actionable failures',25,11);let failure=await failureState();assert.ok(Math.abs(failure.x-25)<.001&&Math.abs(failure.y-11)<.001,'The next-step arrow must point at the actual mouse.');assert.deepEqual(failure.tail,[16,15]);assert.deepEqual([failure.headX,failure.headY],[failure.x,failure.y]);assert.equal(failure.errorTransform,null);assert.equal(failure.frame,null);
 const error=failure.error;
 await moveOnIcon('Actionable failures',0,0);failure=await failureState();assert.deepEqual([failure.x,failure.y],[21,9]);assert.equal(failure.error,error);
 await moveOnIcon('Actionable failures',32,32);failure=await failureState();assert.deepEqual([failure.x,failure.y],[26,17]);assert.deepEqual([failure.headX,failure.headY],[failure.x,failure.y]);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.deepEqual(await failureState(),failure);
 for(const [label,id] of [['Useful capabilities','capabilities'],['Faithful results','results'],['Actionable failures','failures']]){
  assert.deepEqual(await evaluate(`({tile:document.querySelector('[aria-label="'+${JSON.stringify(label)}+'"] svg use').getAttribute('href'),wheel:document.querySelector('[data-goal="'+${JSON.stringify(id)}+'"] use').getAttribute('href')})`),{tile:'#icon-'+id,wheel:'#icon-'+id});
 }
 console.log('Icons: shared semantic motion, pointer mapping, limits, stationary parts, and retained state passed.');

}
