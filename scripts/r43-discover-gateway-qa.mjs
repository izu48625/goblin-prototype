import assert from 'node:assert/strict';
import {discoverPublicRequest} from '../worker/discover-public.js';

const idA='00000000-0000-4000-8000-000000000001';
const idB='00000000-0000-4000-8000-000000000002';
const publicTopic=(id,title)=>({
 id,title,description:'SAFE_PUBLIC_DESCRIPTION',visibility:'public',language_code:'ja',
 published_at:'2026-01-01T00:00:00Z',snapshot_updated_at:'2026-01-01T00:00:00Z',
 snapshot:{rows:[{name:'TARGET_PUBLIC'}],criteria:[{name:'quality'}]},
 score_scale:100,show_community:true,allow_ratings:true,participants:1,remixCount:0
});
const records=new Map([[idA,publicTopic(idA,'Title A')],[idB,publicTopic(idB,'Title B')]]);
const cache=new Map();
globalThis.caches={default:{
 async match(key){const s=cache.get(key.url);return s?new Response(s.body,{headers:s.headers}):undefined},
 async put(key,res){cache.set(key.url,{body:await res.text(),headers:Object.fromEntries(res.headers)})}
}};
let scans=0,hydrates=0;const seenHeaders=[];
globalThis.fetch=async(url,options)=>{
 const body=JSON.parse(options.body);
 seenHeaders.push(options.headers);
 assert.equal(options.headers.Cookie,undefined);
 assert.match(options.headers.Authorization,/^Bearer sb_publishable_/);
 if(url.endsWith('/discover_public_works_v1')){
   scans++;
   const rows=Array.from(records.values()).filter(x=>x.visibility==='public');
   return Response.json({rows,total:rows.length,has_more:false,anchor:'2026-10-14T00:00:00Z'});
 }
 if(url.endsWith('/discover_public_cards_by_ids_v1')){
   hydrates++;
   return Response.json(body.p_ids.map(id=>records.get(id)).filter(r=>r?.visibility==='public'));
 }
 throw Error('Unexpected URL '+url);
};
const ctx={waitUntil(p){return p}};
const env={DISCOVER_RATE_LIMIT:{async limit(){return {success:true}}}};
const req=url=>new Request('https://statsmaker.app'+url,{headers:{'CF-Connecting-IP':'203.0.113.1',Cookie:'private-session=do-not-forward'}});
const ask=async url=>{
 const r=await discoverPublicRequest(req(url),env,ctx);
 return {status:r.status,cache:r.headers.get('X-Stats-Maker-Discover-Cache'),data:await r.json()};
};
const url='/api/discover?query=&category=all&view=all&sort=newest&locale=ja&limit=12&offset=0';
const one=await ask(url);
assert.equal(one.status,200);assert.equal(one.cache,'miss');assert.equal(one.data.rows.length,2);
assert.equal(scans,1);assert.equal(hydrates,0);
const onlyCached=Array.from(cache.values())[0].body;
assert(!onlyCached.includes('SAFE_PUBLIC_DESCRIPTION'));
assert(!onlyCached.includes('TARGET_PUBLIC'));
assert(!onlyCached.includes('Title A'));
const two=await ask(url);
assert.equal(two.cache,'hit-verified');assert.equal(two.data.rows.length,2);
assert.equal(scans,1);assert.equal(hydrates,1);

// Public -> Private: cached old ID MUST NEVER expose stale topic content.
records.get(idB).visibility='private';records.get(idB).title='PRIVATE_MUST_NOT_LEAK';
const three=await ask(url);
assert.equal(three.cache,'miss');
assert.equal(three.data.rows.length,1);
assert(!JSON.stringify(three.data).includes('PRIVATE_MUST_NOT_LEAK'));
assert.equal(scans,2);assert.equal(hydrates,2);
// Cache warmed with only the remaining public ID.
const four=await ask(url);
assert.equal(four.cache,'hit-verified');assert.equal(four.data.rows.length,1);
// Public -> Unlisted must also be rejected on a cached index hit.
records.get(idB).visibility='public';records.get(idB).title='AGAIN_PUBLIC';
cache.clear();
await ask(url); // cache the now-Public B identifier
records.get(idB).visibility='unlisted';records.get(idB).title='UNLISTED_MUST_NOT_LEAK';
const unlisted=await ask(url);
assert(!JSON.stringify(unlisted.data).includes('UNLISTED_MUST_NOT_LEAK'));
assert(unlisted.data.rows.every(r=>r.visibility==='public'));
// Update live Public content; old content must not remain on cache hit.
records.get(idA).title='UPDATED_PUBLIC_TITLE';
const five=await ask(url);
assert.equal(five.data.rows[0].title,'UPDATED_PUBLIC_TITLE');
assert.equal(five.cache,'hit-verified');
// Refresh forces recomputation, bypasses cache.
const six=await ask(url+'&fresh=1');
assert.equal(six.cache,'bypass');assert(scans>=4);
const seven=await ask(url.replace('query=','query=ABC'));
assert.equal(seven.cache,'bypass');assert.equal(seven.status,200);
assert.equal((await ask(url+'&query='+encodeURIComponent('x'.repeat(121)))).status,400);
assert.equal((await ask(url.replace('limit=12','limit=1000'))).status,400);
assert.equal((await ask(url.replace('sort=newest','sort=bad'))).status,400);
assert.equal((await ask(url+'&query=ABC')).status,400,'duplicate query params must be rejected');
assert.equal(seenHeaders.length,scans+hydrates);
const blocked=await discoverPublicRequest(req(url),{DISCOVER_RATE_LIMIT:{async limit(){return {success:false}}}},ctx);
assert.equal(blocked.status,429);
console.log('R43: Public-only ID-cache, Private/Unlisted revocation, fresh card hydration, bypass and input-limit QA PASS');
