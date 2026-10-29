const tileInteractions={
 settings:{
  variant:'grab',
  initialFlipMs:650,minimumFlipMs:200,repeatSpeedFactor:.9,repeatWindowMs:1200,
  dragThresholdPx:8,degreesPerWidth:180,snapDegrees:180,
  sampleWindowMs:120,coastTimeMs:280,maximumCoastMs:3000,restAngle:.1,
 },
 flip(button,faces){attachCardInteraction(button,faces,false);},
 grab(button,faces){attachCardInteraction(button,faces,true);},
};

const cardDragTargets=new WeakMap();
let activeCardGesture=null;
document.addEventListener('pointermove',event=>activeCardGesture?.move(event),true);
document.addEventListener('pointerup',event=>activeCardGesture?.end(event),true);
document.addEventListener('pointercancel',event=>activeCardGesture?.cancel(event),true);

function attachCardInteraction(button,{front,back,gestureTarget=button,dragThreshold=tileInteractions.settings.dragThresholdPx},grabbable){
 const settings=tileInteractions.settings;
 let angle=0,motion=null,frame=null,gesture=null,suppressClick=false;
 let lastClick=-Infinity,clickDuration=settings.initialFlipMs;
 const snap=value=>Math.round(value/settings.snapDegrees)*settings.snapDegrees;
 const cursor=()=>{button.style.cursor=gesture?.active?'grabbing':grabbable?'grab':'pointer';};
 const render=()=>{
  button.style.setProperty('--turn',angle+'deg');
  const reversed=Math.cos(angle*Math.PI/180)<0;
  button.setAttribute('aria-expanded',String(reversed));
  front.setAttribute('aria-hidden',String(reversed));
  back.setAttribute('aria-hidden',String(!reversed));
 };
 function stop(){
  if(frame!==null)cancelAnimationFrame(frame);
  frame=null;motion=null;
 }
 function animate(target,kind,duration){
  stop();
  const origin=angle,start=performance.now();
  motion={target};
  const tick=now=>{
   const elapsed=now-start;
   let progress,done;
   if(kind==='coast'){
    // Project a frictional coast onto its snapped destination, as in Motion's
    // inertia generator. Elapsed time keeps the decay independent of frame rate.
    progress=1-Math.exp(-elapsed/settings.coastTimeMs);
    done=Math.abs((target-origin)*(1-progress))<=settings.restAngle||elapsed>=settings.maximumCoastMs;
   }else{
    const t=Math.min(1,elapsed/duration);
    progress=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    done=t===1;
   }
   angle=done?target:origin+(target-origin)*progress;
   render();
   if(done){frame=null;motion=null;}else frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
 }
 function releaseCapture(){
  const ended=gesture;gesture=null;cursor();
  if(activeCardGesture===controller)activeCardGesture=null;
  if(ended&&!ended.reserved&&gestureTarget.hasPointerCapture(ended.id))gestureTarget.releasePointerCapture(ended.id);
 }
 function settle(){
  stop();releaseCapture();angle=snap(angle);render();
 }
 function begin(event,transferred=false){
  if((!transferred&&(event.button!==0||!event.isPrimary))||gesture)return;
  const reserved=!transferred&&!!event.target.closest('.rotation-surface');
  if(grabbable&&!reserved)stop();
  suppressClick=transferred;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,width:button.getBoundingClientRect().width,
   origin:angle,active:transferred,reserved,samples:[{time:performance.now(),angle}]};
  activeCardGesture=controller;
  if(transferred){cursor();gestureTarget.setPointerCapture(event.pointerId);}
 }
 function finish(){
  if(!gesture)return;
  const active=gesture.active;
  const samples=gesture.samples.filter(sample=>performance.now()-sample.time<=settings.sampleWindowMs);
  const first=samples[0],last=samples.at(-1);
  const velocity=first&&last.time>first.time?(last.angle-first.angle)/(last.time-first.time):0;
  releaseCapture();
  if(active)animate(snap(angle+velocity*settings.coastTimeMs),'coast');
 }
 gestureTarget.addEventListener('pointerdown',event=>begin(event));
 const move=event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(Math.hypot(dx,dy)>=dragThreshold)suppressClick=true;
  if(!grabbable||gesture.reserved)return;
  if(!gesture.active){
   if(Math.abs(dy)>=dragThreshold&&Math.abs(dy)>Math.abs(dx)){settle();return;}
   if(Math.abs(dx)<dragThreshold)return;
   gesture.active=true;cursor();
   gestureTarget.setPointerCapture(event.pointerId);
  }
  const hovered=document.elementFromPoint(event.clientX,event.clientY)?.closest('.goal-card');
  const recipient=cardDragTargets.get(hovered);
  if(recipient&&hovered!==button){
   finish();recipient.begin(event,true);return;
  }
  const next=gesture.origin+dx/gesture.width*settings.degreesPerWidth;
  if(next!==angle){
   angle=next;
   const time=performance.now();
   gesture.samples=gesture.samples.filter(sample=>time-sample.time<=settings.sampleWindowMs);
   gesture.samples.push({time,angle});
   render();
  }
 };
 const end=event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  move(event);
  if(!gesture)return;
  finish();
 };
 const cancel=event=>{
  if(gesture?.id!==event.pointerId)return;
  suppressClick=true;settle();
 };
 gestureTarget.addEventListener('lostpointercapture',event=>{
  // Replacing touch's implicit capture on a child also bubbles a lost event.
  if(event.target===gestureTarget)cancel(event);
 });
 const controller={begin,move,end,cancel};
 if(grabbable)cardDragTargets.set(button,controller);
 button.addEventListener('click',event=>{
  if(suppressClick&&event.detail!==0){suppressClick=false;return;}
  suppressClick=false;
  const now=performance.now();
  clickDuration=now-lastClick<=settings.repeatWindowMs
   ?Math.max(settings.minimumFlipMs,clickDuration*settings.repeatSpeedFactor):settings.initialFlipMs;
  lastClick=now;
  const bounds=button.getBoundingClientRect(),direction=event.clientX<bounds.x+bounds.width/2?-1:1;
  const target=snap(motion?.target??angle)+direction*settings.snapDegrees;
  animate(target,'click',clickDuration);
 });
 window.addEventListener('blur',()=>{suppressClick=true;settle();});
 window.addEventListener('resize',()=>{suppressClick=true;settle();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){suppressClick=true;settle();}});
 cursor();render();
}
