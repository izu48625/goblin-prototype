// R58 P2: isolated end-to-end Worker route mock. No real HTTP/database writes.
// This tests the Auth -> Turnstile -> privileged RPC path under simultaneous requests;
// it does NOT claim real multi-region/network p95 or production load capacity.
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const url='https://statsmaker.app/api/guard/community';
const topic='57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const service='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+
  Buffer.from(JSON.stringify({role:'service_role',exp:4070908800})).toString('base64url')+
  '.'+'x'.repeat(64);
const uid=n=>'00000000-0000-4000-8000-'+String(n+1).padStart(12,'0');
const rid=n=>'10000000-0000-4000-8000-'+String(n+1).padStart(12,'0');
const token=n=>'qaonly_'+String(n).padStart(4,'0')+'x'.repeat(80);
const nFromToken=header=>{
  const m=String(header||'').match(/qaonly_(\d{4})/);
  return m?Number(m[1]):null;
};
const env={
  TURNSTILE_COMMUNITY_STAGE:'1',
  TURNSTILE_SITE_KEY:'r58-test-site-key',
  TURNSTILE_SECRET:'r58-isolated-secret',
  SUPABASE_SERVICE_ROLE_KEY:service,
  COMMUNITY_GATEWAY_RATE_LIMIT:{async limit(){return {success:true}}},
  ASSETS:{async fetch(){return new Response('mock only')}}
};
let scenario,events,saved,limits;
function reset(mode='ok',limitPerIp=100){
  scenario=mode;
  events={auth:0,turnstile:0,rpc:0};
  saved=new Map();
  limits=new Map();
  env.COMMUNITY_GATEWAY_RATE_LIMIT={async limit({key}){
    const count=(limits.get(key)||0)+1;
    limits.set(key,count);
    if(mode==='limit_unavailable')throw Error('mock limit outage');
    return {success:count<=limitPerIp};
  }};
}
function request(user,ip='192.0.2.'+(user%240+1),submit=true){
  return new Request(url,{method:'POST',headers:{
    Origin:'https://statsmaker.app',
    'Content-Type':'application/json',
    Authorization:'Bearer '+token(user),
    'CF-Connecting-IP':ip
  },body:JSON.stringify({p_topic_id:topic,p_scores:[{
    item_id:topic,criterion_id:topic,score:75
  }],p_submit:submit,turnstile_token:'r58-valid-mock-token'})});
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async (target,opts={})=>{
  const path=new URL(String(target)).pathname;
  if(path==='/auth/v1/user'){
    events.auth++;
    const user=nFromToken(opts.headers.Authorization);
    if(user===null||scenario==='auth_unavailable')
      return Response.json({message:'denied'},{status:401});
    return Response.json({id:uid(user)});
  }
  if(path==='/turnstile/v0/siteverify'){
    events.turnstile++;
    return Response.json({success:scenario!=='challenge_failed',
      hostname:'statsmaker.app',action:'community_submit',
      challenge_ts:new Date().toISOString()});
  }
  if(path==='/rest/v1/rpc/gateway_save_my_topic_rating'){
    events.rpc++;
    if(scenario==='rpc_unavailable')
      return Response.json({message:'mock downstream failed'},{status:503});
    if(scenario==='invalid_response')
      return Response.json({unexpected:'not-a-saved-rating'});
    const body=JSON.parse(opts.body);
    assert.equal(opts.headers.apikey,service,'service credential only in upstream Worker');
    assert.equal(body.p_topic_id,topic);
    assert.equal(body.p_user_id.startsWith('00000000-0000-4000-8000-'),true);
    assert(!Object.hasOwn(body,'turnstile_token'),'Turnstile token must not reach database');
    const existing=saved.get(body.p_user_id);
    const index=Number(body.p_user_id.slice(-12))-1;
    saved.set(body.p_user_id,body.p_submit?'submitted':'draft');
    return Response.json([{rating_set_id:existing?rid(index):rid(index),
      rating_status:body.p_submit?'submitted':'draft',
      submitted_at:body.p_submit?new Date().toISOString():null}]);
  }
  throw Error('Unexpected external request in isolated mock: '+target);
};
const pct=(values,p)=>{
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.ceil(sorted.length*p)-1]||0;
};
async function burst(count,make=(i)=>request(i)){
  const all=await Promise.all(Array.from({length:count},async(_,i)=>{
    const start=performance.now();
    const response=await worker.fetch(make(i),env);
    return {status:response.status,ms:performance.now()-start,
      retry:response.headers.get('Retry-After'),body:await response.json()};
  }));
  return {all,p50:+pct(all.map(x=>x.ms),.5).toFixed(2),
    p95:+pct(all.map(x=>x.ms),.95).toFixed(2),
    p99:+pct(all.map(x=>x.ms),.99).toFixed(2)};
};
try{
  for(const concurrency of [1,5,20,50]){
    reset();
    const result=await burst(concurrency);
    assert(result.all.every(x=>x.status===200),'Unique simultaneous participants rejected');
    assert.equal(saved.size,concurrency,'Saved unique count differs');
    assert.deepEqual(events,{auth:concurrency,turnstile:concurrency,rpc:concurrency});
    console.log('R58 P2 gateway full-route isolated mock PASS',{
      concurrency,successful:concurrency,p50_ms:result.p50,p95_ms:result.p95,p99_ms:result.p99});
  }

  reset();
  let result=await burst(20,()=>request(0,'198.51.100.8'));
  assert(result.all.every(x=>x.status===200),'Duplicate submissions should get idempotent response');
  assert.equal(saved.size,1,'Same authenticated identity counted more than once');
  assert.equal(events.rpc,20,'Retries were unexpectedly swallowed');
  console.log('R58 P2 repeated same user mock PASS',{attempts:20,uniqueUsers:saved.size});

  reset('ok',5);
  result=await burst(20,i=>request(i,'203.0.113.9'));
  assert.equal(result.all.filter(x=>x.status===200).length,5);
  assert.equal(result.all.filter(x=>x.status===429).length,15);
  assert(result.all.filter(x=>x.status===429).every(x=>x.retry==='60'));
  assert.equal(events.auth,5);
  assert.equal(events.rpc,5,'Denied traffic reached database');
  console.log('R58 P2 shared-IP rate limit mock PASS',{accepted:5,blocked:15});

  for(const [mode,code,authCount,dbCount] of [
    ['limit_unavailable',503,0,0],['auth_unavailable',401,1,0],
    ['challenge_failed',403,1,0],['rpc_unavailable',503,1,1],
    ['invalid_response',503,1,1]
  ]){
    reset(mode);
    result=await burst(1);
    assert.equal(result.all[0].status,code,mode);
    assert.equal(events.auth,authCount,mode+' unexpected Auth calls');
    assert.equal(events.rpc,dbCount,mode+' unexpected DB calls');
    assert.equal(saved.size,0,mode+' false saved state');
    console.log('R58 P2 failure mode PASS',mode,code);
  }
}finally{globalThis.fetch=originalFetch}
