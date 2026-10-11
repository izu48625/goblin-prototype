// R35 Public work reports. Cloudflare limits bursts; Supabase verifies user JWT and RLS.
const URL='https://ibpdxbeltdwkquowjeay.supabase.co';
const KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';
const REASONS=new Set(['spam','inappropriate','harassment','copyright','other']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(status,error)=>Response.json(error?{error}:{ok:true},{status,headers:{'Cache-Control':'no-store'}});
export async function workReportGateway(request,env){
  if(request.method!=='POST')return reply(405,'method_not_allowed');
  if(request.headers.get('Origin')!==new URL(request.url).origin)return reply(403,'origin_rejected');
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return reply(415,'unsupported_type');
  const auth=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(request.headers.get('Authorization')||'');
  if(!auth||auth[1].length<100||auth[1].length>4096)return reply(401,'authentication_required');
  if(!env.REPORT_RATE_LIMIT?.limit)return reply(503,'report_unavailable');
  if(Number(request.headers.get('Content-Length')||0)>1600)return reply(413,'payload_too_large');
  let limited;try{limited=await env.REPORT_RATE_LIMIT.limit({key:'report:'+(request.headers.get('CF-Connecting-IP')||'unknown-client')})}catch{return reply(503,'report_unavailable')}
  if(!limited?.success)return new Response(JSON.stringify({error:'rate_limited'}),{status:429,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'60'}});
  let body;
  try{const raw=await request.text();if(raw.length>1600)return reply(413,'payload_too_large');body=JSON.parse(raw)}catch{return reply(400,'invalid_payload')}
  const topic=body?.topic_id,reason=body?.reason,details=body?.details??'';
  if(!UUID.test(topic||'')||!REASONS.has(reason)||typeof details!=='string'||details.length>500||(reason==='other'&&details.trim().length<8))return reply(400,'invalid_payload');
  // The database fills reporter_id with auth.uid(). Browser cannot write review status.
  let upstream;
  try{upstream=await fetch(URL+'/rest/v1/work_reports',{
    method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+auth[1],'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({topic_id:topic,reason,details:details.trim()})
  })}catch{return reply(503,'report_unavailable')}
  if(upstream.status===201||upstream.status===204)return reply(201);
  if(upstream.status===409)return reply(409,'already_reported');
  if(upstream.status===401)return reply(401,'authentication_required');
  if(upstream.status===403||upstream.status===404)return reply(403,'not_reportable');
  return reply(upstream.status>=500?503:400,'report_unavailable');
}