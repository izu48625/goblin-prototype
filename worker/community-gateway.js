// Stats Maker R26 P4: staged, trusted Community write gateway.
// Browser JWT is checked by Supabase Auth; a service-only RPC persists the vote.
// Enforcement begins only after R26_P4_CUTOVER.sql revokes direct RPC EXECUTE.
// SUPABASE_SERVICE_ROLE_KEY must exist only as a Cloudflare Worker runtime secret.

const SUPABASE_URL='https://ibpdxbeltdwkquowjeay.supabase.co';
const SUPABASE_KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';
const ALLOWED_HOST='statsmaker.app';
const TURNSTILE_URL='https://challenges.cloudflare.com/turnstile/v0/siteverify';

const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{
  'Cache-Control':'no-store',
  'Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff',...extra
}});
const reject=(status,code)=>json({error:code},status);

function credentialsConfigured(env){
  return typeof env.TURNSTILE_SITE_KEY==='string' && env.TURNSTILE_SITE_KEY.length>6
    && typeof env.TURNSTILE_SECRET==='string' && env.TURNSTILE_SECRET.length>6;
}

function trustedRpcConfigured(env){
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(typeof key!=='string'||key.length<100)return false;
  const parts=key.split('.');
  if(parts.length!==3||!parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)))return false;
  try{
    // A local sanity check only. Supabase verifies the actual JWT signature.
    const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload?.role==='service_role' && (typeof payload.exp!=='number'||payload.exp>Date.now()/1000);
  }catch{return false}
}

export function gatewayEnabled(env){
  return env.TURNSTILE_COMMUNITY_STAGE==='1'
    && credentialsConfigured(env) && trustedRpcConfigured(env);
}

export function securityConfig(env){
  const configured=credentialsConfigured(env);
  const trusted=trustedRpcConfigured(env);
  const enabled=gatewayEnabled(env);
  // Public metadata only. Neither the Turnstile secret nor privileged DB key
  // is ever returned. The sitekey remains hidden until enabled.
  return json({communityGatewayEnabled:enabled,siteKey:enabled?env.TURNSTILE_SITE_KEY:null,
    turnstileConfigured:configured,trustedGatewayConfigured:trusted});
}

export async function communityGateway(request,env){
  if(request.method!=='POST')return reject(405,'method_not_allowed');
  if(!gatewayEnabled(env))return reject(503,'gateway_not_configured');
  const origin=request.headers.get('Origin');
  if(origin && origin!=='https://'+ALLOWED_HOST)return reject(403,'invalid_origin');
  const contentType=request.headers.get('Content-Type')||'';
  if(!/^application\/json(?:;|$)/i.test(contentType))return reject(415,'json_required');
  const size=Number(request.headers.get('Content-Length')||0);
  if(size>100000)return reject(413,'payload_too_large');

  const limited=await env.COMMUNITY_GATEWAY_RATE_LIMIT.limit({
    key:request.headers.get('CF-Connecting-IP')||'unknown-client'
  });
  if(!limited.success)return json({error:'rate_limited'},429,{'Retry-After':'60'});

  const auth=request.headers.get('Authorization')||'';
  const bearer=auth.match(/^Bearer ([A-Za-z0-9_.-]{40,5500})$/);
  if(!bearer)return reject(401,'auth_required');

  let body;
  try{
    const raw=await request.text();
    // Content-Length can be absent or dishonest. Enforce the actual UTF-8
    // byte size, not UTF-16 JS string length (which undercounts emoji/CJK).
    if(new TextEncoder().encode(raw).byteLength>100000)
      return reject(413,'payload_too_large');
    body=JSON.parse(raw);
  }catch{return reject(400,'invalid_json')}
  const topic=body?.p_topic_id;
  const token=body?.turnstile_token;
  if(typeof topic!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(topic)
      || !Array.isArray(body?.p_scores)||body.p_scores.length>400
      || typeof body?.p_submit!=='boolean'
      || typeof token!=='string'||token.length<10||token.length>2048)
    return reject(400,'invalid_payload');

  // Verify the anonymous user's JWT with Supabase Auth (not just JWT decoding).
  let userResp;
  try{
    userResp=await fetch(SUPABASE_URL+'/auth/v1/user',{
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+bearer[1]}
    });
  }catch{return reject(503,'auth_unavailable')}
  if(!userResp.ok)return reject(401,'invalid_session');
  const user=await userResp.json().catch(()=>null);
  if(!user?.id||typeof user.id!=='string'
      ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id))
    return reject(401,'invalid_session');

  const params=new URLSearchParams({
    secret:env.TURNSTILE_SECRET,response:token
  });
  const ip=request.headers.get('CF-Connecting-IP');
  if(ip)params.set('remoteip',ip);
  let verdict;
  try{
    const res=await fetch(TURNSTILE_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
    if(!res.ok)return reject(503,'challenge_unavailable');
    verdict=await res.json();
  }catch{return reject(503,'challenge_unavailable')}
  const age=Date.now()-Date.parse(verdict?.challenge_ts||'');
  if(verdict?.success!==true
      ||verdict?.hostname!==ALLOWED_HOST
      ||verdict?.action!=='community_submit'
      ||!Number.isFinite(age)||age< -60000||age>300000)
    return reject(403,'challenge_failed');

  // The end-user identity was verified by Supabase Auth above. Forward that
  // trusted ID (never a browser-provided p_user_id) to the service-only RPC.
  // The service-role key is held ONLY in the Worker runtime, never in HTML,
  // any public config endpoint, a database table, or the GitHub repository.
  let rpcResp;
  try{
    rpcResp=await fetch(SUPABASE_URL+'/rest/v1/rpc/gateway_save_my_topic_rating',{
      method:'POST',
      headers:{
        apikey:env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        p_user_id:user.id,p_topic_id:topic,
        p_scores:body.p_scores,p_submit:body.p_submit
      })
    });
  }catch{return reject(503,'rating_unavailable')}
  const result=await rpcResp.json().catch(()=>null);
  if(!rpcResp.ok){
    if(rpcResp.status===429||String(result?.message||'').includes('RATE_LIMITED'))
      return reject(429,'rate_limited');
    return json({error:'rating_rejected',message:'Rating could not be saved. Please retry.'},rpcResp.status>=500?503:400);
  }
  // A 2xx response is not proof of persistence when an upstream returns
  // malformed JSON or an unexpected shape. Do not show false "Saved" success.
  const saved=Array.isArray(result)&&result.length===1?result[0]:null;
  if(!saved || typeof saved.rating_set_id!=='string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.rating_set_id)
      || !['draft','submitted'].includes(saved.rating_status)
      || !(saved.submitted_at===null
        || (typeof saved.submitted_at==='string'
          && Number.isFinite(Date.parse(saved.submitted_at)))))
    return reject(503,'invalid_rating_response');
  return json({data:result});
}
