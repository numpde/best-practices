const iconInteractions={
 bounds(part){
  // Firefox cannot measure source shapes inside symbols or defs. Measure the
  // same node in the renderable library, then restore its place before painting.
  const parent=part.parentNode,next=part.nextSibling;
  part.ownerSVGElement.closest('.symbol-library').append(part);
  try{return part.getBBox();}
  finally{parent.insertBefore(part,next);}
 },
 settings:{bookLiftRatio:.5,lockOpenAngle:45,pathSamplesPerUnit:4,bulbMinimumBrightness:.45},
 onMouseMove(button,svg,move){
  button.addEventListener('pointermove',event=>{
   if(event.pointerType!=='mouse'||event.buttons!==0||button.getAttribute('aria-expanded')==='true')return;
   move(new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse()));
  });
 },
 resetPointerReference(button,reset){
  for(const type of ['pointerleave','pointerdown','pointercancel','click'])button.addEventListener(type,reset);
  button.addEventListener('pointermove',event=>{if(event.buttons!==0)reset();});
 },
 onMouseDelta(button,svg,move){
  let previous=null;
  iconInteractions.resetPointerReference(button,()=>{previous=null;});
  iconInteractions.onMouseMove(button,svg,point=>{
   if(previous){
    const delta={x:point.x-previous.x,y:point.y-previous.y};
    previous=point;
    if(delta.x||delta.y)move(delta);
   }else previous=point;
  });
 },
 revealStroke(part,length,progress){
  part.setAttribute('stroke-dasharray',String(length));
  part.setAttribute('stroke-dashoffset',String(length*(1-progress)));
  part.setAttribute('visibility',progress===0?'hidden':'visible');
 },
 trace(button,svg,symbol){
  const path=symbol.querySelector('[data-motion-part="trace"]'),ink=symbol.querySelector('[data-motion-part="ink"]');
  const length=path.getTotalLength(),samples=Math.ceil(length*iconInteractions.settings.pathSamplesPerUnit);
  iconInteractions.revealStroke(ink,length,1);
  iconInteractions.onMouseMove(button,svg,point=>{
   let nearest=0,distance=Infinity;
   for(let i=0;i<=samples;i++){
    const candidate=path.getPointAtLength(length*i/samples),d=Math.hypot(candidate.x-point.x,candidate.y-point.y);
    if(d<distance){nearest=i/samples;distance=d;}
   }
   iconInteractions.revealStroke(ink,length,nearest);
  });
 },
 paper(button,svg,symbol){
  const sheet=iconInteractions.bounds(symbol.querySelector('[data-motion-part="sheet"]'));
  const content=iconInteractions.bounds(symbol.querySelector('[data-motion-part="content"]'));
  const paper=symbol.querySelector('[data-motion-part="paper"]'),fold=symbol.querySelector('[data-motion-part="fold"]');
  const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
  const maximum=content.y-sheet.y-stroke,right=sheet.x+sheet.width,bottom=sheet.y+sheet.height;
  const render=(x,y)=>{
   paper.setAttribute('d',`M${sheet.x} ${sheet.y}H${right-x}L${right} ${sheet.y+y}V${bottom}H${sheet.x}Z`);
   fold.setAttribute('d',`M${right-x} ${sheet.y}V${sheet.y+y}H${right}Z`);
   fold.setAttribute('visibility',x===0||y===0?'hidden':'visible');
  };
  render(0,0);
  iconInteractions.onMouseMove(button,svg,point=>{
   const reach=stroke/2;
   if(point.x<right-maximum-reach||point.x>right+reach||point.y<sheet.y-reach||point.y>sheet.y+maximum+reach)return;
   // Keep interaction at the paper corner and the fold clear of the result.
   render(Math.max(0,Math.min(maximum,right-point.x)),Math.max(0,Math.min(maximum,point.y-sheet.y)));
  });
 },
 guidance(button,svg,symbol){
  const frame=symbol.querySelector('[data-motion-part="frame"]'),shaft=symbol.querySelector('[data-motion-part="shaft"]');
  const head=symbol.querySelector('[data-motion-part="head"]'),bounds=iconInteractions.bounds(symbol.querySelector('#failure-head'));
  const top=frame.points.getItem(0),bottom=frame.points.getItem(2);
  const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
  const tail={x:shaft.x1.baseVal.value,y:shaft.y1.baseVal.value};
  const render=point=>{
   shaft.setAttribute('x2',point.x);shaft.setAttribute('y2',point.y);
   const angle=Math.atan2(point.y-tail.y,point.x-tail.x)*180/Math.PI;
   head.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(${angle})`);
  };
  render({x:shaft.x2.baseVal.value,y:shaft.y2.baseVal.value});
  iconInteractions.onMouseMove(button,svg,point=>{
   const x=Math.max(tail.x+bounds.width+stroke,Math.min(bottom.x-stroke,point.x));
   const y=Math.max(top.y+bounds.width+stroke,Math.min(bottom.y-bounds.width-stroke,point.y));
   render({x,y});
  });
 },
 ownership(button,svg,symbol){
  const owner=symbol.querySelector('[data-motion-part="owner"]'),branches=iconInteractions.bounds(symbol.querySelector('[data-motion-part="branches"]'));
  const records=[...symbol.querySelectorAll('[data-motion-part="record"]')];
  const hub={x:owner.cx.baseVal.value,y:owner.cy.baseVal.value};
  const points=[hub];
  for(const record of records){
   const child={x:record.x.baseVal.value+record.width.baseVal.value/2,y:record.y.baseVal.value+record.height.baseVal.value/2};
   points.push({x:hub.x,y:branches.y},{x:child.x,y:branches.y},child,{x:child.x,y:branches.y},{x:hub.x,y:branches.y},hub);
  }
  const segments=points.slice(1).map((b,i)=>({a:points[i],b,length:Math.hypot(b.x-points[i].x,b.y-points[i].y)}));
  const total=segments.reduce((sum,segment)=>sum+segment.length,0),signal=symbol.querySelector('[data-motion-part="signal"]');
  let distance=0;
  const render=()=>{
   let remaining=(distance%total+total)%total;
   for(const segment of segments){
    if(remaining<=segment.length){
     const t=remaining/segment.length;
     signal.setAttribute('cx',segment.a.x+(segment.b.x-segment.a.x)*t);
     signal.setAttribute('cy',segment.a.y+(segment.b.y-segment.a.y)*t);
     return;
    }
    remaining-=segment.length;
   }
  };
  render();
  iconInteractions.onMouseDelta(button,svg,delta=>{
   distance+=delta.x/symbol.viewBox.baseVal.width*total;render();
  });
 },
 evolution(button,svg,symbol){
  const controls=[...symbol.querySelector('[data-motion-part="control"]').points];
  const start=controls[0],end=controls.at(-1),branch=symbol.querySelector('[data-motion-part="branch"]');
  const trunk=symbol.querySelector('[data-motion-part="trunk"]'),anchor=trunk.getPointAtLength(trunk.getTotalLength());
  const head=iconInteractions.bounds(symbol.querySelector('#evolution-head')),box=symbol.viewBox.baseVal;
  const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
  symbol.querySelector('[data-motion-part="trunk-head"]').setAttribute('transform',`translate(${anchor.x} ${anchor.y})`);
  const render=tip=>{
   const scale={x:(tip.x-start.x)/(end.x-start.x),y:(tip.y-start.y)/(end.y-start.y)};
   const points=controls.map(p=>({x:start.x+(p.x-start.x)*scale.x,y:start.y+(p.y-start.y)*scale.y}));
   branch.setAttribute('d',`M${start.x} ${start.y}C${points.slice(1).map(p=>`${p.x} ${p.y}`).join(' ')}`);
   symbol.querySelector('[data-motion-part="branch-head"]').setAttribute('transform',`translate(${tip.x} ${tip.y})`);
  };
  render(end);
  iconInteractions.onMouseMove(button,svg,point=>{
   const x=Math.max(anchor.x+head.width+stroke*1.5,Math.min(box.x+box.width-stroke*1.5-head.x-head.width,point.x));
   const y=Math.max(box.y+stroke*1.5-head.y,Math.min(start.y-head.height-stroke*1.5,point.y));
   render({x,y});
  });
 },
 completion(button,svg,symbol){
  const pole=iconInteractions.bounds(symbol.querySelector('[data-motion-part="pole"]')),flag=symbol.querySelector('[data-motion-part="flag"]');
  const bounds=iconInteractions.bounds(flag),check=symbol.querySelector('[data-motion-part="check"]'),length=check.getTotalLength();
  const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
  const travel=pole.y+pole.height-bounds.y-bounds.height-stroke;
  let progress=1;
  const render=()=>{
   const verified=Math.min(1,progress*2),raised=Math.max(0,progress*2-1);
   iconInteractions.revealStroke(check,length,verified);
   flag.setAttribute('transform',`translate(0 ${travel*(1-raised)})`);
  };
  render();
  iconInteractions.onMouseDelta(button,svg,delta=>{
   progress=Math.max(0,Math.min(1,progress-delta.y/symbol.viewBox.baseVal.height));render();
  });
 },
 nearestColumn(parts,x){
  const distance=part=>{const b=iconInteractions.bounds(part);return Math.abs(x-b.x-b.width/2);};
  return parts.reduce((nearest,part)=>distance(part)<distance(nearest)?part:nearest);
 },
 trackWithin(button,svg,part,anchor,area,inset){
  const bounds=iconInteractions.bounds(part);
  iconInteractions.onMouseMove(button,svg,point=>{
   const x=Math.max(area.x+inset-bounds.x,Math.min(area.x+area.width-inset-bounds.x-bounds.width,point.x-anchor.x));
   const y=Math.max(area.y+inset-bounds.y,Math.min(area.y+area.height-inset-bounds.y-bounds.height,point.y-anchor.y));
   part.setAttribute('transform',`translate(${x} ${y})`);
  });
 },
 magnifier(button,svg,symbol){
  const glass=symbol.querySelector('[data-motion-part="magnifier"]');
  const lens=glass.querySelector('[data-motion-part="lens"]');
  const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
  iconInteractions.trackWithin(button,svg,glass,{x:lens.cx.baseVal.value,y:lens.cy.baseVal.value},symbol.viewBox.baseVal,stroke*1.5);
 },
 cursor(button,svg,symbol){
  const cursor=symbol.querySelector('[data-motion-part="cursor"]');
  const screen=iconInteractions.bounds(symbol.querySelector('[data-motion-part="screen"]'));
  const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
  iconInteractions.trackWithin(button,svg,cursor,cursor.getPointAtLength(0),screen,stroke);
 },
 snake(button,svg,symbol){
  const track=symbol.querySelector('[data-motion-part="track"]'),length=track.getTotalLength();
  const boxes=[...symbol.querySelectorAll('[data-motion-part="box"]')];
  const bodies=[...symbol.querySelectorAll('[data-motion-part="body"]')];
  const heads=[...symbol.querySelectorAll('[data-motion-part="head"]')];
  const rect=symbol.querySelector('#reproducible-box rect');
  const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
  const clearance=Math.hypot(rect.width.baseVal.value,rect.height.baseVal.value)/2+stroke;
  const box=symbol.viewBox.baseVal,pivot={x:box.x+box.width/2,y:box.y+box.height/2,radius:stroke/2};
  const pointAt=distance=>track.getPointAtLength((distance%length+length)%length);
  const render=angle=>{
   const distance=angle/360*length;
   for(const node of boxes){
    const point=pointAt(distance+Number(node.dataset.offset)*length);
    node.setAttribute('transform',`translate(${point.x} ${point.y})`);
   }
   for(const [index,body] of bodies.entries()){
    const start=distance+Number(body.dataset.offset)*length+clearance,end=start+length/boxes.length-2*clearance;
    const samples=Math.ceil((end-start)*iconInteractions.settings.pathSamplesPerUnit);
    // The connecting stroke follows the same track as the boxes, so the body
    // bends through each corner instead of carrying a rigid arrow around it.
    const points=Array.from({length:samples+1},(_,i)=>pointAt(start+(end-start)*i/samples));
    body.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(''));
    const tip=points.at(-1),before=pointAt(end-stroke/2),after=pointAt(end+stroke/2);
    const heading=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI;
    heads[index].setAttribute('transform',`translate(${tip.x} ${tip.y}) rotate(${heading})`);
   }
  };
  render(0);
  iconInteractions.followDial(button,svg,pivot,render,{relative:true});
 },
 bulb(button,svg,symbol){
  const bulb=symbol.querySelector('[data-motion-part="bulb"]'),bounds=iconInteractions.bounds(bulb);
  const centre={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2},radius=Math.max(bounds.width,bounds.height)/2;
  iconInteractions.onMouseMove(button,svg,point=>{
   const proximity=Math.max(0,1-Math.hypot(point.x-centre.x,point.y-centre.y)/radius);
   const minimum=iconInteractions.settings.bulbMinimumBrightness;
   bulb.setAttribute('opacity',minimum+(1-minimum)*proximity);
  });
 },
 layers(button,svg,symbol){
  const layers=[...symbol.querySelectorAll('[data-motion-part="layer"]')];
  const bounds=layers.map(layer=>iconInteractions.bounds(layer)),last=bounds.at(-1);
  const top=bounds[0].y,bottom=last.y+last.height;
  const travel=last.y-bounds.at(-2).y;
  iconInteractions.onMouseMove(button,svg,point=>{
   const compression=Math.max(0,Math.min(1,(point.y-top)/(bottom-top)));
   layers.forEach((layer,index)=>{
    const offset=travel*compression*(layers.length-1-index)/(layers.length-1);
    layer.setAttribute('transform',`translate(0 ${offset})`);
   });
  });
 },
 lock(button,svg,symbol){
  const shackle=symbol.querySelector('[data-motion-part="shackle"]');
  const outline=shackle.querySelector('path');
  const freeEnd=outline.getPointAtLength(0),hinge=outline.getPointAtLength(outline.getTotalLength());
  const restingAngle=Math.atan2(freeEnd.y-hinge.y,freeEnd.x-hinge.x)*180/Math.PI;
  const deadRadius=Number(symbol.firstElementChild.getAttribute('stroke-width'))/2;
  iconInteractions.onMouseMove(button,svg,point=>{
   if(Math.hypot(point.x-hinge.x,point.y-hinge.y)<deadRadius)return;
   const pointerAngle=Math.atan2(point.y-hinge.y,point.x-hinge.x)*180/Math.PI;
   const delta=((pointerAngle-restingAngle+540)%360)-180;
   const angle=Math.max(0,Math.min(iconInteractions.settings.lockOpenAngle,delta));
   shackle.setAttribute('transform',`rotate(${angle} ${hinge.x} ${hinge.y})`);
  });
 },
 book(button,svg,symbol){
  const page=symbol.querySelector('[data-motion-part="page"]');
  const spine=iconInteractions.bounds(symbol.querySelector('[data-motion-part="spine"]'));
  const cover=iconInteractions.bounds(symbol.querySelector('[data-motion-part="cover"]'));
  const sheet=iconInteractions.bounds(page);
  iconInteractions.onMouseMove(button,svg,point=>{
   const progress=Math.max(0,Math.min(1,(cover.x+cover.width-point.x)/cover.width));
   const angle=progress*Math.PI,scale=Math.cos(angle);
   const lift=Math.sin(angle)*(spine.y-sheet.y)*iconInteractions.settings.bookLiftRatio/sheet.width;
   // Project one sheet across the fixed spine, lifting its outer edge as it turns.
   page.setAttribute('transform',`matrix(${scale} ${-lift} 0 1 ${spine.x*(1-scale)} ${spine.x*lift})`);
  });
 },
 bars(button,svg,symbol){
  const frame=symbol.querySelector('[data-motion-part="frame"]');
  const bars=[...symbol.querySelectorAll('[data-motion-part="bar"]')];
  iconInteractions.onMouseMove(button,svg,point=>{
   const bar=iconInteractions.nearestColumn(bars,point.x);
   const stroke=Number(symbol.firstElementChild.getAttribute('stroke-width'));
   const ceiling=iconInteractions.bounds(frame).y+stroke*1.5;
   bar.setAttribute('y2',Math.max(ceiling,Math.min(bar.y1.baseVal.value,point.y)));
  });
 },
 followDial(button,svg,pivot,turn,{relative=false}={}){
  let rotation=0,previous=null;
  if(relative){
   iconInteractions.resetPointerReference(button,()=>{previous=null;});
  }
  iconInteractions.onMouseMove(button,svg,point=>{
   if(Math.hypot(point.x-pivot.x,point.y-pivot.y)<pivot.radius){previous=null;return;}
   const angle=Math.atan2(point.y-pivot.y,point.x-pivot.x)*180/Math.PI+90;
   if(relative&&previous===null){previous=angle;return;}
   rotation+=((angle-(relative?previous:rotation%360)+540)%360)-180;
   previous=angle;
   turn(rotation);
  });
 },
 recovery(button,svg,symbol){
  const arrow=symbol.querySelector('[data-motion-part="arrow"]');
  const box=symbol.viewBox.baseVal;
  const pivot={x:box.x+box.width/2,y:box.y+box.height/2,radius:Number(symbol.firstElementChild.getAttribute('stroke-width'))/2};
  iconInteractions.followDial(button,svg,pivot,angle=>{
   arrow.setAttribute('transform',`rotate(${angle} ${pivot.x} ${pivot.y})`);
  });
 },
 clock(button,svg,symbol){
  const minute=symbol.querySelector('[data-motion-part="minute"]');
  const hour=symbol.querySelector('[data-motion-part="hour"]');
  const centre=symbol.querySelector('[data-motion-part="pivot"]');
  const pivot={x:centre.cx.baseVal.value,y:centre.cy.baseVal.value,radius:centre.r.baseVal.value};
  iconInteractions.followDial(button,svg,pivot,angle=>{
   minute.setAttribute('transform',`rotate(${angle} ${pivot.x} ${pivot.y})`);
   hour.setAttribute('transform',`rotate(${angle/12} ${pivot.x} ${pivot.y})`);
  });
 },
 sliders(button,svg,symbol){
  // The tile and wheel reference this same drawing and retain its edited state.
  const drawing=symbol.firstElementChild;
  const tracks=drawing.querySelector('[data-motion-part="tracks"]');
  const sliders=[...drawing.querySelectorAll('[data-motion-part="slider"]')];
  iconInteractions.onMouseMove(button,svg,point=>{
   const nearest=iconInteractions.nearestColumn(sliders,point.x);
   const track=iconInteractions.bounds(tracks),height=nearest.height.baseVal.value;
   const top=Math.max(track.y,Math.min(track.y+track.height-height,point.y-height/2));
   nearest.setAttribute('y',top);
  });
 }
};
