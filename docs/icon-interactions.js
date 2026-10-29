const iconInteractions={
 onMouseMove(button,svg,move){
  button.addEventListener('pointermove',event=>{
   if(event.pointerType!=='mouse'||button.getAttribute('aria-expanded')==='true')return;
   move(new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse()));
  });
 },
 clock(button,svg,symbol){
  const hand=symbol.querySelector('[data-motion-part="hand"]');
  const pivot=symbol.querySelector('[data-motion-part="pivot"]');
  iconInteractions.onMouseMove(button,svg,point=>{
   const x=pivot.cx.baseVal.value,y=pivot.cy.baseVal.value;
   if(Math.hypot(point.x-x,point.y-y)<pivot.r.baseVal.value)return;
   const angle=Math.atan2(point.y-y,point.x-x)*180/Math.PI+90;
   hand.setAttribute('transform',`rotate(${angle} ${x} ${y})`);
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
