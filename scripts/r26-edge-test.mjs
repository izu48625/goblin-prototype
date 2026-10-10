import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';

const conf=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
assert.equal(conf.ratelimits.length,3);
assert(conf.assets.run_worker_first.includes('/api/og*'));
assert(conf.assets.run_worker_first.includes('/p/*'));

let externalFetches=0;
const savedFetch=globalThis.fetch;
globalThis.fetch=async request=>{
  externalFetches++;
  const target=String(request);
  if(target.includes('/api/og'))return new Response(new Uint8Array([137,80,78,71]),{status:200,headers:{'Content-Type':'image/png'}});
  throw new Error('Unexpected upstream call: '+target);
};

const calls={og:[],share:[]};
const env={
  OG_RATE_LIMIT:{async limit(args){calls.og.push(args);return {success:calls.og.length<2}}},
  SHARE_RATE_LIMIT:{async limit(args){calls.share.push(args);return {success:false}}},
  ASSETS:{async fetch(){return new Response('static asset',{status:200})}}
};
const header={'CF-Connecting-IP':'192.0.2.18'};

try{
  const health=await worker.fetch(new Request('https://statsmaker.app/api/health'),env);
  assert.equal(health.status,200);
  assert.equal((await health.json()).release,'r26p1');

  const allowed=await worker.fetch(new Request('https://statsmaker.app/api/og?id=test', {headers:header}),env);
  assert.equal(allowed.status,200);
  assert.equal(allowed.headers.get('X-Stats-Maker-OG-Backend'),'vercel-stage1');
  assert.equal(externalFetches,1);

  const denied=await worker.fetch(new Request('https://statsmaker.app/api/og?id=test', {headers:header}),env);
  assert.equal(denied.status,429);
  assert.equal(denied.headers.get('Retry-After'),'60');
  assert.equal(externalFetches,1,'blocked request must not reach OGP origin');
  assert.deepEqual(calls.og,[{key:'192.0.2.18'},{key:'192.0.2.18'}]);

  const shareDenied=await worker.fetch(new Request('https://statsmaker.app/p/5ffb1644-b5f8-434f-b216-27012c90bbfe',{headers:header}),env);
  assert.equal(shareDenied.status,429);
  assert.equal(externalFetches,1,'blocked share must not reach Supabase');
  assert.deepEqual(calls.share,[{key:'192.0.2.18'}]);

  const invalidMethod=await worker.fetch(new Request('https://statsmaker.app/api/og',{method:'POST',headers:header}),env);
  assert.equal(invalidMethod.status,405);

  const staticResponse=await worker.fetch(new Request('https://statsmaker.app/'),env);
  assert.equal(await staticResponse.text(),'static asset');
  console.log('R26 edge guard PASS');
}finally{
  globalThis.fetch=savedFetch;
}
