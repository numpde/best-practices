const tileInteractions={
 settings:{initialFlipMs:650,minimumFlipMs:350,repeatSpeedFactor:.9,repeatWindowMs:1200},
 flip(button,{front,back,gestureTarget=button,dragThreshold=8}){
 let start=null,moved=false;
 gestureTarget.addEventListener('pointerdown',event=>{start={x:event.clientX,y:event.clientY};moved=false;});
 gestureTarget.addEventListener('pointermove',event=>{
  if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>=dragThreshold)moved=true;
 });
 gestureTarget.addEventListener('pointercancel',()=>{start=null;moved=true;});
 let turns=0,lastClick=-Infinity,duration=tileInteractions.settings.initialFlipMs;
 button.style.setProperty('--flip-duration',duration+'ms');
 button.addEventListener('click',event=>{
  start=null;
  if(moved&&event.detail!==0){moved=false;return;}
  moved=false;
  const now=performance.now(),settings=tileInteractions.settings;
  duration=now-lastClick<=settings.repeatWindowMs
   ?Math.max(settings.minimumFlipMs,duration*settings.repeatSpeedFactor)
   :settings.initialFlipMs;
  lastClick=now;
  button.style.setProperty('--flip-duration',duration+'ms');
  const bounds=button.getBoundingClientRect();
  turns+=event.clientX<bounds.x+bounds.width/2?-1:1;
  const flipped=Math.abs(turns%2)===1;
  button.style.setProperty('--turn',`${turns*180}deg`);
  button.setAttribute('aria-expanded',String(flipped));
  front.setAttribute('aria-hidden',String(flipped));
  back.setAttribute('aria-hidden',String(!flipped));
 });
 }
};
