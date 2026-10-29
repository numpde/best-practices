import assert from 'node:assert/strict';

export async function checkCardGrab({call,evaluate,waitFor,delay,nextFrames}){
 const selector='.goal-tile:nth-child(3) .goal-card';
 const angle=()=>evaluate(`parseFloat(document.querySelector(${JSON.stringify(selector)}).style.getPropertyValue('--turn'))`);
 async function bounds(){
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
  await nextFrames();
  return evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width*.2,y:r.y+r.height*.5,w:r.width}})()`);
 }
 const settled=()=>waitFor(`(()=>{const a=parseFloat(document.querySelector(${JSON.stringify(selector)}).style.getPropertyValue('--turn'));return Math.abs(a%180)<.00001})()`);
 async function mouseDrag({hold=0,direction=1}={}){
  const b=await bounds();
  const start=direction>0?b.x:b.x+b.w*.6;
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:start,y:b.y});
  for(let i=1;i<=8;i++){
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:start+direction*b.w*.55*i/8,y:b.y});
   await delay(12);
  }
  assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).cursor`),'grabbing');
  if(hold)await delay(hold);
  const released=await angle();
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:start+direction*b.w*.55,y:b.y});
  return released;
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Emulation.setTouchEmulationEnabled',{enabled:false});
 const initial=await angle();
 const release=await mouseDrag();
 assert.ok(Math.abs(release-initial-99)<1,'A horizontal drag must directly turn the card by the configured distance.');
 await delay(70);
 assert.ok(await angle()>release+10,'A flick must keep moving after release.');
 await settled();
 const landing=await angle();
 assert.ok(landing>release+180,'A fast flick must project across multiple faces before snapping.');
 await delay(100);
 assert.equal(await angle(),landing,'The drag must not also generate a click flip.');

 await mouseDrag({direction:-1});
 await delay(70);
 const b=await bounds();
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:b.x,y:b.y});
 const caught=await angle();
 await delay(100);
 assert.equal(await angle(),caught,'Grabbing a coasting card must stop it at its current angle.');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:b.x+b.w*.12,y:b.y});
 const resumed=await angle();
 assert.ok(Math.abs(resumed-caught-21.6)<1,'A new drag must continue from the caught angle.');
 await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))`);
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:b.x+b.w*.12,y:b.y});
 await settled();
 const cancelled=await angle();
 await delay(100);
 assert.equal(await angle(),cancelled,'A cancelled grab must stop at a readable face.');
 const heldRelease=await mouseDrag({hold:180});
 await settled();
 assert.ok(Math.abs(await angle()-heldRelease)<=90,'Holding still before release must snap locally without a fling.');

 const destination='.goal-tile:nth-child(4) .goal-card';
 const source=await bounds();
 const recipient=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(destination)}).getBoundingClientRect();return {x:r.x+r.width*.2,y:r.y+r.height*.5,w:r.width}})()`);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:source.x,y:source.y});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:source.x+source.w*.3,y:source.y});
 await delay(30);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:recipient.x,y:recipient.y});
 await nextFrames();
 const handoff=await evaluate(`({oldCursor:getComputedStyle(document.querySelector(${JSON.stringify(selector)})).cursor,newCursor:getComputedStyle(document.querySelector(${JSON.stringify(destination)})).cursor,captured:document.querySelector(${JSON.stringify(destination)}).hasPointerCapture(1)})`);
 assert.deepEqual(handoff,{oldCursor:'grab',newCursor:'grabbing',captured:true},'A held drag must release its old card and capture the card under the pointer: '+JSON.stringify(await evaluate(`({hit:document.elementFromPoint(${recipient.x},${recipient.y})?.closest('.goal-card')?.getAttribute('aria-label'),x:${recipient.x},y:${recipient.y}})`)));
 const recipientBefore=await evaluate(`parseFloat(document.querySelector(${JSON.stringify(destination)}).style.getPropertyValue('--turn'))`);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:recipient.x+recipient.w*.4,y:recipient.y});
 const recipientDragged=await evaluate(`parseFloat(document.querySelector(${JSON.stringify(destination)}).style.getPropertyValue('--turn'))`);
 assert.ok(Math.abs(recipientDragged-recipientBefore-72)<1,'The recipient must follow movement from the handoff point without jumping.');
 await delay(180);
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:recipient.x+recipient.w*.4,y:recipient.y});
 await settled();
 await waitFor(`Math.abs(parseFloat(document.querySelector(${JSON.stringify(destination)}).style.getPropertyValue('--turn'))%180)<.00001`);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(destination)})).cursor`),'grab');

 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 const t=await bounds(),beforeTouch=await angle();
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:t.x,y:t.y,id:1}]});
 for(let i=1;i<=8;i++){
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:t.x+t.w*.6*i/8,y:t.y,id:1}]});
  await delay(12);
 }
 await delay(180);
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await settled();
 assert.ok(await angle()>beforeTouch,'Horizontal touch dragging must turn and snap the card.');
 const touchSource=await bounds();
 const touchRecipient=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(destination)}).getBoundingClientRect();return {x:r.x+r.width*.2,y:r.y+r.height*.5,w:r.width}})()`);
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchSource.x,y:touchSource.y,id:1}]});
 await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchSource.x+touchSource.w*.3,y:touchSource.y,id:1}]});
 await delay(30);
 await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchRecipient.x,y:touchRecipient.y,id:1}]});
 await nextFrames();
 assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(destination)})).cursor`),'grabbing','A held touch must also transfer to the next card.');
 await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchRecipient.x+touchRecipient.w*.3,y:touchRecipient.y,id:1}]});
 await delay(180);
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await settled();
 await waitFor(`Math.abs(parseFloat(document.querySelector(${JSON.stringify(destination)}).style.getPropertyValue('--turn'))%180)<.00001`);
 const v=await bounds(),beforeScroll=await evaluate('scrollY'),beforeVertical=await angle();
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:v.x,y:v.y,id:1}]});
 for(let i=1;i<=8;i++){
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:v.x,y:v.y-i*10,id:1}]});
  await delay(12);
 }
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await delay(150);
 assert.ok(await evaluate('scrollY')>beforeScroll+10,'Vertical touch gestures on a card must still scroll the page.');
 assert.equal(await angle(),beforeVertical,'Vertical scrolling must not turn or flip a card.');
 console.log('Cards: mouse/touch grabbing, multi-face inertia, snapping, interruption, cancellation, card-to-card handoff, click suppression, and vertical scrolling passed.');
}
