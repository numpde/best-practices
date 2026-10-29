const iconInteractions={
 onMouseMove(button,svg,move){
  button.addEventListener('pointermove',event=>{
   if(event.pointerType!=='mouse'||button.getAttribute('aria-expanded')==='true')return;
   move(new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse()));
  });
 },
 clock(button,svg,symbol){
  const minute=symbol.querySelector('[data-motion-part="minute"]');
  const hour=symbol.querySelector('[data-motion-part="hour"]');
  let minuteAngle=0;
  const pivot=symbol.querySelector('[data-motion-part="pivot"]');
  iconInteractions.onMouseMove(button,svg,point=>{
   const x=pivot.cx.baseVal.value,y=pivot.cy.baseVal.value;
   if(Math.hypot(point.x-x,point.y-y)<pivot.r.baseVal.value)return;
   const angle=Math.atan2(point.y-y,point.x-x)*180/Math.PI+90;
   // Accumulate turns across the dial seam so the hour hand keeps advancing.
   minuteAngle+=((angle-minuteAngle%360+540)%360)-180;
   minute.setAttribute('transform',`rotate(${minuteAngle} ${x} ${y})`);
   hour.setAttribute('transform',`rotate(${minuteAngle/12} ${x} ${y})`);
  });
 },
 sliders(button,svg,symbol){
  // The tile and wheel reference this same drawing and retain its edited state.
  const drawing=symbol.firstElementChild;
  const tracks=drawing.querySelector('[data-motion-part="tracks"]');
  const sliders=[...drawing.querySelectorAll('[data-motion-part="slider"]')];
  iconInteractions.onMouseMove(button,svg,point=>{
   const nearest=sliders.reduce((best,slider)=>{
    const distance=knob=>Math.abs(point.x-knob.x.baseVal.value-knob.width.baseVal.value/2);
    return distance(slider)<distance(best)?slider:best;
   });
   const track=tracks.getBBox(),height=nearest.height.baseVal.value;
   const top=Math.max(track.y,Math.min(track.y+track.height-height,point.y-height/2));
   nearest.setAttribute('y',top);
  });
 }
};
