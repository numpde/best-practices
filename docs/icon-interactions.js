const iconInteractions={
 sliders(button,svg,symbol){
  // Give this tile its own mutable instance of the shared SVG drawing.
  // Updating the symbol itself would also move the main wheel's sliders.
  const drawing=symbol.firstElementChild.cloneNode(true);
  svg.replaceChildren(drawing);
  const tracks=drawing.querySelector('[data-motion-part="tracks"]');
  const sliders=[...drawing.querySelectorAll('[data-motion-part="slider"]')];
  button.addEventListener('pointermove',event=>{
   if(event.pointerType!=='mouse'||button.getAttribute('aria-expanded')==='true')return;
   const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
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
