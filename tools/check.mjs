import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, lstatSync, existsSync} from 'node:fs';
import {dirname, resolve, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=resolve(root,'docs');
const privacyPatterns=[
 ['personal home path', /\/(?:home|Users)\/[A-Za-z0-9_.-]+/],
 ['Codex session location', /\.codex\/(?:sessions|history)/],
 ['session recording identifier', /\brollout-\d{4}-\d{2}-\d{2}/],
 ['private network address', /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/],
 ['SSH host identity', /\b(?!git@github\.com)[a-z][\w.-]*@[a-z][\w.-]*:(?:\/|~)/i],
 ['credential-shaped token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,})\b/],
 ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
function checkPrivacy(text,location){
 for(const [name,pattern] of privacyPatterns){
  assert.ok(!pattern.test(text),`${location}: contains a ${name}; remove it before publishing. Matched values are withheld.`);
 }
}
function filesAt(directory){
 return readdirSync(directory).flatMap(name=>{
  const file=resolve(directory,name),stat=lstatSync(file);
  assert.ok(!stat.isSymbolicLink(),`${relative(root,file)}: symbolic links are not supported publication inputs.`);
  return stat.isDirectory()?filesAt(file):[file];
 });
}
const html=readFileSync(resolve(site,'index.html'),'utf8');
const modelStart=html.indexOf('const groups = [');
const modelEnd=html.indexOf('const criteriaSource=');
assert.ok(modelStart>=0&&modelEnd>modelStart,'Cannot locate the embedded graph source.');
const {nodes,edges,groups,generalityLevels,researchMappings}=vm.runInNewContext(
 html.slice(modelStart,modelEnd)+';({nodes,edges,groups,generalityLevels,researchMappings})',
 {},{timeout:1000},
);
const ids=new Set(nodes.map(n=>n.id)),groupIds=new Set(groups.map(g=>g.id));
assert.ok(nodes.length>0,'The graph has no nodes.');
assert.equal(ids.size,nodes.length,'Node IDs must be unique.');
assert.equal(groupIds.size,groups.length,'Subject IDs must be unique.');
for(const node of nodes){
 assert.ok(groupIds.has(node.group),`${node.id}: unknown subject ${node.group}.`);
 assert.ok(['property','practice','pitfall'].includes(node.kind),`${node.id}: unknown node kind.`);
 assert.ok(Object.hasOwn(generalityLevels,node.generality),`${node.id}: declare a supported generality level.`);
 for(const field of ['id','title','summary','example','scope'])assert.ok(typeof node[field]==='string'&&node[field].length>0,`${node.id}: ${field} must be nonempty text.`);
 assert.ok(Array.isArray(node.examples)&&node.examples.length>=2,`${node.id}: include at least two additional examples.`);
 for(const [index,example] of node.examples.entries()){
  assert.ok(typeof example.text==='string'&&example.text.trim().length>0,`${node.id}: example ${index+1} must have text.`);
  assert.equal(example.origin,'Illustrative case · privacy edited',`${node.id}: example ${index+1} must be identified as an edited illustration.`);
  if(example.href)assert.match(example.href,/^https:\/\/github\.com\/numpde\/[a-z0-9-]+\/commit\/[0-9a-f]{40}$/,`${node.id}: example source must be a direct public commit link.`);
 }
}
for(const [level,size] of Object.entries(generalityLevels)){
 for(const field of ['width','height','fontSize'])assert.ok(Number.isFinite(size[field])&&size[field]>0,`${level}: invalid ${field}.`);
}
const adjacency=new Map(nodes.map(n=>[n.id,new Set()]));
const relationships=new Set();
for(const edge of edges){
 assert.ok(ids.has(edge.from)&&ids.has(edge.to),`Relationship ${edge.from} -> ${edge.to} has a missing endpoint.`);
 assert.notEqual(edge.from,edge.to,`Relationship ${edge.from} must connect distinct concepts.`);
 const key=JSON.stringify([edge.from,edge.to,edge.label]);
 assert.ok(!relationships.has(key),`Duplicate relationship ${key}.`);relationships.add(key);
 assert.ok(typeof edge.label==='string'&&edge.label.length>0,`${key}: missing relationship label.`);
 assert.ok(typeof edge.reason==='string'&&edge.reason.length>20,`${key}: provide an explanation, not a category code.`);
 assert.equal(typeof edge.tension,'boolean',`${key}: tension must be boolean.`);
 adjacency.get(edge.from).add(edge.to);adjacency.get(edge.to).add(edge.from);
}
const reached=new Set(),pending=[nodes[0].id];
while(pending.length){const id=pending.pop();if(reached.has(id))continue;reached.add(id);pending.push(...adjacency.get(id));}
assert.equal(reached.size,nodes.length,'The graph has disconnected concepts; review missing semantic connections.');
for(const [id,number] of Object.entries(researchMappings)){
 assert.ok(ids.has(id),`Research finding ${number}: missing concept ${id}.`);
}
for(const id of ['criteria-source','research-source']){
 const match=html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`));
 assert.ok(match,`Missing embedded evidence: ${id}.`);
 const source=JSON.parse(match[1]);
 for(const [key,item] of Object.entries(source)){
  assert.ok(typeof item.text==='string'&&item.text.length>0,`${id}/${key}: empty evidence text.`);
  if(id==='criteria-source')assert.ok(ids.has(key),`Public criterion ${key}: no graph concept.`);
 }
 if(id==='research-source')for(const number of Object.values(researchMappings))assert.ok(Object.hasOwn(source,number),`Missing research finding ${number}.`);
}
for(const file of filesAt(site)){
 const text=readFileSync(file,'utf8');checkPrivacy(text,relative(root,file));
 if(!file.endsWith('.html'))continue;
 for(const match of text.matchAll(/\b(href|src)=["']([^"']+)["']/g)){
  const [,attribute,target]=match;
  if(target.includes('${')||target.startsWith('#'))continue;
  if(/^(?:[a-z]+:|\/\/)/i.test(target)){
   assert.notEqual(attribute,'src',`${relative(root,file)}: external runtime asset ${target} breaks offline use.`);
   continue;
  }
  assert.ok(!target.startsWith('/'),`${target}: use a relative link so project Pages paths work.`);
  const local=resolve(dirname(file),decodeURIComponent(target.split(/[?#]/)[0]));
  assert.ok(local===site||local.startsWith(site+sep),`${target}: link escapes the published site.`);
  assert.ok(existsSync(local),`${relative(root,file)}: missing local link ${target}.`);
 }
}
for(const directory of ['tools','.github'])for(const file of filesAt(resolve(root,directory)))checkPrivacy(readFileSync(file,'utf8'),relative(root,file));
for(const file of ['README.md','DEVELOPMENT.md','Makefile'])checkPrivacy(readFileSync(resolve(root,file),'utf8'),file);
if(process.argv.includes('--history')){
 const objects=execFileSync('git',['rev-list','--objects','--all'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 for(const entry of objects){
  const id=entry.split(' ')[0];if(!id)continue;
  const type=execFileSync('git',['cat-file','-t',id],{cwd:root,encoding:'utf8'}).trim();
  if(type==='blob'||type==='commit')checkPrivacy(execFileSync('git',['cat-file',type,id],{cwd:root,encoding:'utf8'}),`history object ${id}`);
 }
 console.log('Reachable history privacy scan passed.');
}
console.log(`Site checks passed: ${nodes.length} concepts, ${edges.length} relationships, one connected graph; evidence, relative links, and privacy patterns valid.`);
