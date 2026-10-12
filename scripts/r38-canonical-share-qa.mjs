import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const ORIGIN='https://statsmaker.app';
const code=await readFile(new URL('../cloud/runtime-config.js',import.meta.url),'utf8');
const publicSource=await readFile(new URL('../cloud/public.js',import.meta.url),'utf8');
const pageSource=await readFile(new URL('../public.html',import.meta.url),'utf8');
const id='57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const shareFunction=publicSource.match(/function ogShareUrl\(topicId\)\{([\s\S]*?)\n  \}/);
assert(shareFunction,'Official public share button no longer uses expected share helper');
assert(pageSource.includes('cloud/runtime-config.js?v=r38p2canonical1'),'Public page cache marker stale');
assert(!code.includes('stats-maker-ogp.vercel.app'),'Legacy origin still hardcoded for share creation');
for(const testcase of [
 {hostname:'statsmaker.app',origin:ORIGIN,expected:ORIGIN},
 {hostname:'izu48625.github.io',origin:'https://izu48625.github.io',expected:ORIGIN},
 {hostname:'example.github.io',origin:'https://example.github.io',expected:ORIGIN},
 {hostname:'localhost',origin:'http://localhost:4173',expected:ORIGIN},
 {hostname:'127.0.0.1',origin:'http://127.0.0.1:4173',expected:ORIGIN},
 {hostname:'stats-maker-web.example.workers.dev',
  origin:'https://stats-maker-web.example.workers.dev',
  expected:'https://stats-maker-web.example.workers.dev'}
]){
 const sandbox={
   window:{SM_RUNTIME:{testing:true}},
   location:{hostname:testcase.hostname,origin:testcase.origin,href:testcase.origin+'/public.html'}
 };
 vm.runInNewContext(code,sandbox,{filename:'runtime-config.js'});
 assert.equal(sandbox.window.SM_RUNTIME.ogShareOrigin,testcase.expected,testcase.hostname);
 assert.equal(sandbox.window.SM_RUNTIME.testing,true,'Runtime extension lost existing settings');
 const actual=vm.runInNewContext('(function(topicId){'+shareFunction[1]+'\n})',sandbox)(id);
 assert.equal(actual,testcase.expected+'/p/'+id,
   'Public share URL must be canonical or same-origin protected');
 console.log('R38 P2 share host PASS',testcase.hostname,actual);
}
console.log('R38 P2 protected canonical share-origin QA PASS, no external service access');
