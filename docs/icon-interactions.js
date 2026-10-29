const iconInteractions={
 settings:{bookLiftRatio:.5},
 onMouseMove(button,svg,move){
  button.addEventListener('pointermove',event=>{
   if(event.pointerType!=='mouse'||event.buttons!==0||button.getAttribute('aria-expanded')==='true')return;
   move(new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse()));
  });
 },
 nearestColumn(parts,x){
  const distance=part=>{const b=part.getBBox();return Math.abs(x-b.x-b.width/2);};
  return parts.reduce((nearest,part)=>distance(part)<distance(nearest)?part:nearest);
 },
 book(button,svg,symbol){
  const page=symbol.querySelector('[data-motion-part="page"]');
  const spine=symbol.querySelector('[data-motion-part="spine"]').getBBox();
  const cover=symbol.querySelector('[data-motion-part="cover"]').getBBox();
  const sheet=page.getBBox();
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
   const ceiling=frame.getBBox().y+stroke*1.5;
   bar.setAttribute('y2',Math.max(ceiling,Math.min(bar.y1.baseVal.value,point.y)));
  });
 },
 followDial(button,svg,pivot,turn){
  let rotation=0;
  iconInteractions.onMouseMove(button,svg,point=>{
   if(Math.hypot(point.x-pivot.x,point.y-pivot.y)<pivot.radius)return;
   const angle=Math.atan2(point.y-pivot.y,point.x-pivot.x)*180/Math.PI+90;
   rotation+=((angle-rotation%360+540)%360)-180;
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
   const track=tracks.getBBox(),height=nearest.height.baseVal.value;
   const top=Math.max(track.y,Math.min(track.y+track.height-height,point.y-height/2));
   nearest.setAttribute('y',top);
  });
 }
};
