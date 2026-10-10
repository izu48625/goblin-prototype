import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const jwt='abcdefghijklmnop0123456789_'.repeat(4);
const sampleTopic='57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const endpoint='https://statsmaker.app/api/guard/community';
const makeBody=()=>({p_topic_id:sampleTopic,p_scores:[{item_id:sampleTopic,criterion_id:sampleTopic,score:83}],p_submit:true,turnstile_token:'test-solved-token-012345'});
const makeReq=(body=makeBody(),authorization='Bearer '+jwt)=>new Request(endpoint,{
  method:'POST',
  headers:{'Origin':'https://statsmaker.app','Content-Type':'application/json',
    Authorization:authorization,'CF-Connecting-IP':'192.0.2.80'},
  body:JSON.stringify(body)
});

let rateSuccess=true,authSuccess=true,verdict={success:true,hostname:'statsmaker.app',action:'community_submit',challenge_ts:new Date().toISOString()};
let outbound=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
  const u=String(url);outbound.push({u,options});
  if(u.includes('/auth/v1/user'))return Response.json(authSuccess?{id:'test-user'}:{msg:'not signed in'},{status:authSuccess?200:401});
  if(u.includes('challenges.cloudflare.com/turnstile'))return Response.json(verdict);
  if(u.includes('/rpc/save_my_topic_rating'))return Response.json([{rating_set_id:'abc',rating_status:'submitted'}]);
  throw new Error('Unexpected external request: '+u);
};
const env={
  TURNSTILE_COMMUNITY_STAGE:'1',
  TURNSTILE_SITE_KEY:'test-public-sitekey',
  TURNSTILE_SECRET:'test-secret-not-live',
  COMMUNITY_GATEWAY_RATE_LIMIT:{async limit(){return {success:rateSuccess}}},
  OG_RATE_LIMIT:{async limit(){return {success:true}}},
  SHARE_RATE_LIMIT:{async limit(){return {success:true}}},
  ASSETS:{async fetch(){return new Response('asset')}}
};

try{
  let r=await worker.fetch(new Request('https://statsmaker.app/api/security/config'),{...env,TURNSTILE_COMMUNITY_STAGE:'0'});
  assert.deepEqual(await r.json(),{communityGatewayEnabled:false,siteKey:null});
  assert(!JSON.stringify(await (await worker.fetch(new Request('https://statsmaker.app/api/security/config'),env)).json()).includes(env.TURNSTILE_SECRET));
  r=await worker.fetch(makeReq(),{...env,TURNSTILE_COMMUNITY_STAGE:'0'});
  assert.equal(r.status,503);
  assert.equal(outbound.length,0);

  r=await worker.fetch(makeReq(makeBody(),'Bearer bad'),env);
  assert.equal(r.status,401);
  assert.equal(outbound.length,0);

  r=await worker.fetch(makeReq({...makeBody(),turnstile_token:'abc'}),env);
  assert.equal(r.status,400);
  assert.equal(outbound.length,0);

  rateSuccess=false;
  r=await worker.fetch(makeReq(),env);
  assert.equal(r.status,429);
  assert.equal(outbound.length,0);
  rateSuccess=true;

  authSuccess=false;
  r=await worker.fetch(makeReq(),env);
  assert.equal(r.status,401);
  assert(!outbound.some(x=>x.u.includes('siteverify')));
  outbound=[];authSuccess=true;

  for(const bad of [
    {success:false},
    {success:true,hostname:'evil.example',action:'community_submit',challenge_ts:new Date().toISOString()},
    {success:true,hostname:'statsmaker.app',action:'wrong_action',challenge_ts:new Date().toISOString()},
    {success:true,hostname:'statsmaker.app',action:'community_submit',challenge_ts:new Date(Date.now()-360000).toISOString()}
  ]){
    verdict=bad;
    outbound=[];
    r=await worker.fetch(makeReq(),env);
    assert.equal(r.status,403);
    assert(!outbound.some(x=>x.u.includes('/rpc/save_my_topic_rating')),'invalid challenge forwarded to database');
  }

  verdict={success:true,hostname:'statsmaker.app',action:'community_submit',challenge_ts:new Date().toISOString()};
  outbound=[];
  r=await worker.fetch(makeReq(),env);
  assert.equal(r.status,200);
  const result=await r.json();
  assert.equal(result.data[0].rating_status,'submitted');
  assert.deepEqual(outbound.map(x=>new URL(x.u).pathname),['/auth/v1/user','/turnstile/v0/siteverify','/rest/v1/rpc/save_my_topic_rating']);
  const downstream=outbound.at(-1);
  assert.equal(downstream.options.headers.Authorization,'Bearer '+jwt);
  const payload=JSON.parse(downstream.options.body);
  assert(!Object.hasOwn(payload,'turnstile_token'),'token must not be sent to Supabase');
  assert.equal(payload.p_topic_id,sampleTopic);
  assert(!JSON.stringify(result).includes(env.TURNSTILE_SECRET));
  console.log('R26 P3 Turnstile gateway tests PASS');
}finally{globalThis.fetch=originalFetch}
