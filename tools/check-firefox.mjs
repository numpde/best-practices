import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {checkIconInteractions} from './check-icon-interactions.mjs';

const server=createServer(async(req,res)=>{
 try{
  res.setHeader('Content-Type',req.url.endsWith('.json')?'application/json':req.url.endsWith('.js')?'text/javascript':'text/html');
  res.setHeader('Cache-Control','no-store');
  res.end(await readFile(new URL('../docs'+(req.url==='/'?'/index.html':req.url),import.meta.url)));
 }catch{res.statusCode=404;res.end();}
});
const driver=spawn(process.env.GECKODRIVER||'geckodriver',['--port','0']);
let session,endpoint,output='';
driver.stderr.on('data',chunk=>{output+=chunk;});
const listening=new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('Firefox WebDriver did not start.\n'+output)),15000);
 driver.once('error',error=>{clearTimeout(timeout);reject(error);});
 driver.once('exit',code=>{clearTimeout(timeout);reject(Error('Firefox WebDriver exited with '+code+'\n'+output));});
 driver.stdout.on('data',chunk=>{
  output+=chunk;
  const match=output.match(/Listening on (127\.0\.0\.1:\d+)/);
  if(match){clearTimeout(timeout);resolve('http://'+match[1]);}
 });
});
async function request(path,body,method='POST'){
 const response=await fetch(endpoint+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const {value}=await response.json();
 if(!response.ok)throw Error('Firefox '+path+': '+JSON.stringify(value));
 return value;
}
async function evaluate(expression){
 const result=await request(`/session/${session}/execute/async`,{
  script:'const done=arguments[arguments.length-1];Promise.resolve().then(()=>window.eval(arguments[0])).then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));',args:[expression],
 });
 if(!result.ok)throw Error(result.error);
 return result.value;
}
try{
 endpoint=await listening;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 session=(await request('/session',{capabilities:{alwaysMatch:{browserName:'firefox','moz:firefoxOptions':{args:['-headless']}}}})).sessionId;
 await request(`/session/${session}/window/rect`,{width:1440,height:1100});
 const load=async()=>{
  await request(`/session/${session}/url`,{url:`http://127.0.0.1:${server.address().port}/`});
  await evaluate('artworkReady');
  assert.equal(await evaluate('document.body.dataset.state'),'ready');
 };
 await load();
 assert.equal(await evaluate(`document.querySelector('#icon-results [data-motion-part="paper"]').getAttribute('d')`),'M6 5H26L26 5V28H6Z','The paper outline must be measured before it is drawn.');
 // WebDriver rounds native mouse coordinates to pixels. These shared geometry
 // checks use exact subpixel events; the native-input pass below checks hit testing.
 const call=async(method,p)=>{
  assert.equal(method,'Input.dispatchMouseEvent');assert.equal(p.type,'mouseMoved');
  await evaluate(`(()=>{
   const target=document.elementFromPoint(${p.x},${p.y}),button=target?.closest('.goal-card');
   if(window.iconTestHover!==button){window.iconTestHover?.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));window.iconTestHover=button;}
   target?.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',buttons:0,clientX:${p.x},clientY:${p.y}}));
  })()`);
 };
 await checkIconInteractions({call,evaluate});
 await load();
 const labels=await evaluate('goals.map(goal=>goal.name)');
 for(const label of labels){
  for(const [x,y] of [[0,0],[16,16],[32,32]]){
   const point=await evaluate(`(()=>{
    const button=document.querySelector('[aria-label='+CSS.escape(${JSON.stringify(label)})+']');button.scrollIntoView({block:'center'});
    const p=new DOMPoint(${x},${y}).matrixTransform(button.querySelector('svg').getScreenCTM());return {x:Math.round(p.x),y:Math.round(p.y)};
   })()`);
   await request(`/session/${session}/actions`,{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:'viewport',...point}]}]});
   const bounds=await evaluate(`(()=>{
    const button=document.querySelector('[aria-label='+CSS.escape(${JSON.stringify(label)})+']');
    const symbol=document.querySelector(button.querySelector('use').getAttribute('href')),drawing=symbol.firstElementChild;
    const b=iconInteractions.bounds(drawing);return {x:b.x,y:b.y,width:b.width,height:b.height,restored:drawing.parentNode===symbol};
   })()`);
   assert.ok(bounds.restored&&bounds.width>0&&bounds.height>0&&bounds.x>=1&&bounds.y>=1&&bounds.x+bounds.width<=31&&bounds.y+bounds.height<=31,`${label}: native pointer motion must keep the shared drawing intact and inside its canvas: ${JSON.stringify(bounds)}`);
  }
 }
 assert.equal(await evaluate('document.querySelector(".symbol-library").children.length'),1,'Measuring must leave no extra artwork behind.');
 console.log('Firefox: all 17 icons passed geometry, retained-state, and native pointer bounds checks.');
}finally{
 try{if(session)await request(`/session/${session}`,undefined,'DELETE');}
 finally{driver.kill();await new Promise(resolve=>server.close(resolve));}
}
