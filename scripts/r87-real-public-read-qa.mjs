// One read-only, authenticated with the *public* publishable key only.
// Verifies that PostgREST accepts our bounded JSON path projection before deployment.
import assert from 'node:assert/strict';
import {publicWorkHtml} from '../worker/seo.js';
const id='1eed295e-9a79-449d-9fd7-e4405e0ae426'; // Known Public test content.
const originalFetch=globalThis.fetch;
let calls=0,query='';
try{
 globalThis.fetch=async (url,opts)=>{
   calls++;
   const u=new URL(String(url));
   assert.equal(u.hostname,'ibpdxbeltdwkquowjeay.supabase.co');
   assert.equal(u.searchParams.get('visibility'),'eq.public','Never read Unlisted or Private work');
   const projection=u.searchParams.get('select')||'';
   query=projection;
   assert(projection.includes('seo_scores_0:snapshot->rows->0->scores'));
   assert(!projection.includes(',snapshot,'),'Do not transfer entire snapshots');
   return originalFetch(url,{...opts,signal:AbortSignal.timeout(12000)});
 };
 const res=await publicWorkHtml(id);
 assert.equal(res.status,200,'Live public PostgREST read failed');
 const body=await res.text();
 assert(body.includes('公開作品の採点データ'),'SSR lacks source-backed table');
 assert(body.includes('リオネル・メッシ'),'Expected Public subject absent');
 assert(body.includes('<td>9</td>'),'Expected numeric Public score missing');
 assert.equal(calls,1,'One bounded upstream read per Public work page');
 assert.equal(res.headers.get('Cache-Control'),'no-store');
 console.log('R87 production data READ-ONLY PASS: real Public score excerpt, public-only bounded REST projection, 1 request');
}finally{globalThis.fetch=originalFetch;}
