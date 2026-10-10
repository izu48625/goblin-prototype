// Stats Maker R26 P3: optional Turnstile-validated Community write gateway.
// Not an enforcement boundary until direct Supabase RPC EXECUTE is revoked.
// No privileged Supabase keys are used. All calls retain the anonymous user's JWT.

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

export function gatewayEnabled(env){
  return env.TURNSTILE_COMMUNITY_STAGE==='1' && credentialsConfigured(env);
}

export function securityConfig(env){
  const configured=credentialsConfigured(env);
  const enabled=gatewayEnabled(env);
  // Read-only readiness flag. Never return the secret or the sitekey before cutover.
  return json({communityGatewayEnabled:enabled,siteKey:enabled?env.TURNSTILE_SITE_KEY:null,
    turnstileConfigured:configured});
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
    if(raw.length>100000)return reject(413,'payload_too_large');
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
  if(!user?.id)return reject(401,'invalid_session');

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

  // Forward only the already authenticated user's JWT and validated RPC fields.
  // This still requires P3 enforcement cutover to close direct RPC access.
  let rpcResp;
  try{
    rpcResp=await fetch(SUPABASE_URL+'/rest/v1/rpc/save_my_topic_rating',{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+bearer[1], 'Content-Type':'application/json'},
      body:JSON.stringify({p_topic_id:topic,p_scores:body.p_scores,p_submit:body.p_submit})
    });
  }catch{return reject(503,'rating_unavailable')}
  const result=await rpcResp.json().catch(()=>null);
  if(!rpcResp.ok){
    if(rpcResp.status===429||String(result?.message||'').includes('RATE_LIMITED'))
      return reject(429,'rate_limited');
    return json({error:'rating_rejected',message:String(result?.message||'Rating was not saved.').slice(0,240)},rpcResp.status>=500?503:400);
  }
  return json({data:result});
}
