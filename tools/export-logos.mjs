import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const check=process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(arg=>arg==='--check'),'Usage: node tools/export-logos.mjs [--check]');
const source=readFileSync(join(root,'docs/index.html'),'utf8').replace("fetch('goals.json')",
 `Promise.resolve({ok:true,json:()=>${readFileSync(join(root,'docs/goals.json'),'utf8').trim()}})`);
const exportSource=source.replace('await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));','await Promise.resolve();').replace('<script src="tile-interactions.js"></script>',`<script>${readFileSync(join(root,'docs/tile-interactions.js'),'utf8')}</script>`);
const fontLicense=source.match(/<!-- (Embedded Roboto Black,[\s\S]*?)-->/)?.[1];
assert.ok(fontLicense,'The page must retain the embedded font license.');
const temporary=mkdtempSync(join(root,'.logo-export-'));
const variants=[
 {name:'ssdg-wheel',kind:'emblem',width:1600,height:1600},
 {name:'ssdg-wordmark',kind:'wordmark',width:1440,height:1092},
 {name:'ssdg-mark',kind:'mark',width:512,height:512},
];
function run(command,args){
 try{return execFileSync(command,args,{encoding:'utf8',stdio:'pipe',timeout:45000,maxBuffer:16*1024*1024});}
 catch(error){throw new Error(`${command} failed while exporting logos. Check that Chromium and pdftocairo are installed and runnable. ${error.stderr||error.message}`,{cause:error});}
}
const browserArgs=['--headless','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(temporary,'profile')}`];
const chromium=process.env.CHROMIUM||'chromium';
const escapeXML=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

// Extract the same SVG nodes the interactive page renders. All geometry,
// typography, icons, colours and the emblem's wordmark placement belong there.
function extractionScript(variant){
 return `(()=>{
 const variant=${JSON.stringify(variant)};
 document.documentElement.style.scrollbarGutter='auto';
 const ns='http://www.w3.org/2000/svg';
 const ring=document.getElementById('colour-ring').cloneNode(true);
 const wordmark=document.querySelector('.wheel-title h1 > svg').cloneNode(true);
 const art=document.createElementNS(ns,'svg');
 const defs=document.createElementNS(ns,'defs');
 defs.innerHTML=document.getElementById('symbols').innerHTML;
 for(const sector of document.querySelectorAll('#segments > g > path'))defs.append(sector.cloneNode(true));
 art.append(defs);
 const blue=getComputedStyle(document.documentElement).getPropertyValue('--blue').trim();
 wordmark.querySelectorAll('[fill="var(--blue)"]').forEach(node=>node.setAttribute('fill',blue));
 wordmark.style.width='';wordmark.style.height='';
 if(variant.kind==='emblem'){
  art.setAttribute('viewBox',document.querySelector('.wheel').getAttribute('viewBox'));
  const segments=document.getElementById('segments').cloneNode(true);
  // The ring's referenced sectors already live in defs; keep IDs unique.
  segments.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  art.append(segments);
  const wheelBounds=document.querySelector('.wheel').getBoundingClientRect();
  const titleBounds=document.querySelector('.wheel-title h1 > svg').getBoundingClientRect();
  const scale=document.querySelector('.wheel').viewBox.baseVal.width/wheelBounds.width;
  for(const [key,value] of Object.entries({x:(titleBounds.x-wheelBounds.x)*scale,y:(titleBounds.y-wheelBounds.y)*scale,width:titleBounds.width*scale,height:titleBounds.height*scale}))wordmark.setAttribute(key,value);
  art.append(wordmark);
 }else if(variant.kind==='wordmark'){
  art.setAttribute('viewBox',wordmark.getAttribute('viewBox'));
  // Keep the typography style, while the page's font-face remains available for printing.
  art.setAttribute('style',wordmark.getAttribute('style'));
  art.append(...wordmark.childNodes);
 }else{
  art.setAttribute('viewBox',document.querySelector('.wheel').getAttribute('viewBox'));
  art.append(ring);
 }
 art.style.width=variant.width+'px';art.style.height=variant.height+'px';
 art.querySelectorAll('[aria-hidden],[class]').forEach(node=>{node.removeAttribute('aria-hidden');node.removeAttribute('class')});
 document.body.replaceChildren(art);
 const style=document.createElement('style');
 style.textContent='html,body{margin:0;padding:0;background:transparent}body>svg{display:block}@page{size:'+variant.width+'px '+variant.height+'px;margin:0}';
 document.head.append(style);
 })();`;
}
try{
 for(const variant of variants){
  const base=join(temporary,variant.name);
  writeFileSync(base+'.html',exportSource.replace('</body>',`<script>artworkReady.then(()=>{${extractionScript(variant)}});</script></body>`));
  run(chromium,[...browserArgs,'--no-pdf-header-footer',`--print-to-pdf=${base}.pdf`,'--virtual-time-budget=1000',pathToFileURL(base+'.html').href]);
  run('pdftocairo',['-svg',base+'.pdf',base+'.svg']);
  let svg=readFileSync(base+'.svg','utf8');
  const printedCanvas=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const expectedCanvas=[0,0,variant.width*.75,variant.height*.75];
  // Chromium rounds printed page sizes to fractions of a point.
  assert.ok(printedCanvas.every((value,index)=>Math.abs(value-expectedCanvas[index])<=.25),`${variant.name}: the print export must use the artwork canvas, not the loading page.`);
  assert.ok(!/<(?:text|image|script)\b|@font-face|font-family/.test(svg),`${variant.name}: the export must contain only vector artwork, with outlined lettering.`);
  // PDF stores normalised colour components. Restore exact 8-bit RGB values.
  svg=svg.replace(/rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)/g,(_,r,g,b)=>'#'+[r,g,b].map(n=>Math.round(Number(n)*255/100).toString(16).padStart(2,'0')).join(''));
  svg=svg.replace(/(<svg\b[^>]*\bwidth=")[^"]+(" height=")[^"]+/,`$1${variant.width}$2${variant.height}`);
  const title=variant.kind==='emblem'?'Sustainable Software Development Goals':`Sustainable Software Development Goals — ${variant.kind}`;
  const metadata='Generated from docs/index.html by tools/export-logos.mjs. Do not edit.\n'+(variant.kind==='mark'?'':fontLicense);
  svg=svg.replace(/(<svg\b[^>]*>)/,`$1\n<title>${escapeXML(title)}</title>\n<metadata>${escapeXML(metadata)}</metadata>`);
  writeFileSync(base+'.svg',svg);
  run(chromium,[...browserArgs,`--window-size=${variant.width},${variant.height}`,'--force-device-scale-factor=1','--hide-scrollbars','--default-background-color=00000000',`--screenshot=${base}.png`,'--virtual-time-budget=1000',pathToFileURL(base+'.svg').href]);
 }
 // Produce every variant successfully before replacing any published asset.
 const assets=join(root,'assets');
 if(!check)mkdirSync(assets,{recursive:true});
 for(const {name} of variants)for(const extension of ['svg','png']){
  const filename=`${name}.${extension}`,destination=join(assets,filename);
  const generated=readFileSync(join(temporary,filename));
  if(check){
   assert.ok(existsSync(destination)&&readFileSync(destination).equals(generated),`${filename} is stale or missing. Run make logos and review the updated artwork.`);
  }else writeFileSync(destination,generated);
 }
 console.log(check?'Logo exports match the page.':'Exported emblem, wordmark and mark as transparent SVG and PNG.');
}finally{
 rmSync(temporary,{recursive:true,force:true});
}
