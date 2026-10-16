import assert from 'node:assert/strict';
import {discoverPublicRequest} from '../worker/discover-public.js';

// All infrastructure is mocked. No production requests, data, or tokens.
const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const make=(id,visibility='public')=>({
  id,title:'PUBLIC_'+id,description:'Sample',visibility,
  snapshot:{rows:[{name:'sample'}],criteria:[{name:'metric'}]},
  published_at:'2026-01-01T00:00:00Z',show_community:true,allow_ratings:true,
  score_scale:100,participants:1,remixCount:0
});
const records=new Map([[A,make(A)],[B,make(B)]]);
const cache=new Map();
let scans=0,hydrates=0,failNextScan=false,hideBeforeHydration=false;
globalThis.caches={default:{
  async match(key){
    const hit=cache.get(key.url);
    return hit?new Response(hit.body,{headers:hit.headers}):undefined;
  },
  async put(key,res){
    cache.set(key.url,{body:await res.text(),headers:Object.fromEntries(res.headers)});
  }
}};
globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(url.endsWith('/discover_public_works_v1')){
    scans++;
    await new Promise(resolve=>setTimeout(resolve,45)); // force cold bursts to overlap
    if(failNextScan){
      failNextScan=false;
      return Response.json({message:'fail once'},{status:503});
    }
    const rows=[...records.values()].filter(r=>r.visibility==='public')
      .map(x=>structuredClone(x));
    return Response.json({rows,total:rows.length,has_more:false,anchor:'2026-10-16T00:00:00Z'});
  }
  if(url.endsWith('/discover_public_cards_by_ids_v1')){
    hydrates++;
    if(hideBeforeHydration){
      hideBeforeHydration=false;
      records.get(B).visibility='private';
      records.get(B).title='PRIVATE_MUST_NOT_LEAK';
    }
    return Response.json(body.p_ids
      .map(id=>records.get(id)).filter(t=>t?.visibility==='public')
      .map(x=>structuredClone(x)));
  }
  throw Error('Unexpected RPC '+url);
};
const env={DISCOVER_RATE_LIMIT:{async limit(){return {success:true}}}};
const ctx={waitUntil(p){return p}};
const base='/api/discover?query=&category=all&view=all&sort=newest&locale=ja&limit=12&offset=0';
async function ask(path=base){
  const res=await discoverPublicRequest(new Request('https://statsmaker.app'+path),env,ctx);
  return {status:res.status,cache:res.headers.get('X-Stats-Maker-Discover-Cache'),body:await res.json()};
}

// A burst of 50 cold requests should perform ONE full ranking scan per isolate,
// with every coalesced caller verifying current Public visibility.
const burst=await Promise.all(Array.from({length:50},()=>ask()));
assert.equal(scans,1,'50 cold requests launched redundant full scans');
assert.equal(hydrates,49,'each joining request must rehydrate against current Public');
assert(burst.every(r=>r.status===200 && r.body.rows.length===2));
assert.equal(burst.filter(x=>x.cache==='miss').length,1);
assert.equal(burst.filter(x=>x.cache==='coalesced-verified').length,49);
const index=[...cache.values()][0].body;
assert(!index.includes('PUBLIC_') && !index.includes('sample'),'Cache API must contain IDs only');
// A warm cache still rehydrates every caller; published content is never stale.
const warm=await ask();
assert.equal(warm.cache,'hit-verified');
assert.equal(scans,1);
assert.equal(hydrates,50);

// Revoke an ID after a scan, right before a concurrent joiner rehydrates.
// The owner may already have a successful older response; joiners must not
// return revoked content once the live Public state has changed.
records.get(B).visibility='public';
records.get(B).title='NOW_PUBLIC_AGAIN';
cache.clear();
hideBeforeHydration=true;
const mid=await Promise.all(Array.from({length:6},()=>ask()));
assert(mid.every(x=>x.status===200));
assert(mid.slice(1).every(x=>x.body.rows.every(t=>t.visibility==='public')));
assert(mid.slice(1).every(x=>!JSON.stringify(x.body).includes('PRIVATE_MUST_NOT_LEAK')));
assert(mid.slice(1).every(x=>x.body.rows.length===1),'joiners must recompute after revocation');

// The in-flight key is freed after upstream failure so subsequent traffic
// can recover; a failing scan must not permanently poison cache or promises.
cache.clear();
failNextScan=true;
const first=await Promise.all([ask(),ask(),ask()]);
assert(first.every(x=>x.status===503));
const next=await ask();
assert.equal(next.status,200);
assert.equal(next.body.rows.length,1);
assert(!JSON.stringify(next.body).includes('PRIVATE_MUST_NOT_LEAK'));
console.log('R53: 50 concurrent cold requests -> 1 full scan + 49 live rehydrations; revocation and failure recovery PASS');
