// R35 P2 private contact: JWT identity and validation enforced by Supabase RLS.
const API='https://ibpdxbeltdwkquowjeay.supabase.co';
const KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';
const ALLOWED=new Set(['general','copyright','appeal','privacy']);
function reply(status,error){return Response.json(error?{error}:{ok:true},{status,headers:{'Cache-Control':'no-store'}})}
export async function contactGateway(request,env){
  if(request.method!=='POST')return reply(405,'method_not_allowed');
  const url=new URL(request.url);
  if(request.headers.get('Origin')!==url.origin)return reply(403,'origin_rejected');
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return reply(415,'unsupported_type');
  const bearer=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(request.headers.get('Authorization')||'');
  if(!bearer||bearer[1].length<100||bearer[1].length>4096)return reply(401,'authentication_required');
  if(!env.REPORT_RATE_LIMIT?.limit)return reply(503,'contact_unavailable');
  if(Number(request.headers.get('Content-Length')||0)>5000)return reply(413,'payload_too_large');
  let limit;try{limit=await env.REPORT_RATE_LIMIT.limit({key:'contact:'+(request.headers.get('CF-Connecting-IP')||'unknown-client')})}catch{return reply(503,'contact_unavailable')}
  if(!limit?.success)return new Response(JSON.stringify({error:'rate_limited'}),{status:429,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'60'}});
  let body;try{const raw=await request.text();if(raw.length>5000)return reply(413,'payload_too_large');body=JSON.parse(raw)}catch{return reply(400,'invalid_payload')}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,'invalid_payload');
  const category=body.category,reply_email=body.reply_email??'',work_url=body.work_url??'',message=body.message;
  if(!ALLOWED.has(category)||typeof reply_email!=='string'||typeof work_url!=='string'||typeof message!=='string'||message.trim().length<20||message.length>2000||reply_email.length>254||work_url.length>500)return reply(400,'invalid_payload');
  const email=reply_email.trim(),target=work_url.trim();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,'invalid_email');
  if(category!=='general'&&!email)return reply(400,'reply_email_required');
  if(['copyright','appeal'].includes(category)&&!target)return reply(400,'work_url_required');
  if(target){
    let u;try{u=new URL(target)}catch{return reply(400,'invalid_work_url')}
    if(u.protocol!=='https:'||u.hostname!=='statsmaker.app'||u.port)return reply(400,'invalid_work_url');
    if(!(/^\/(?:public\.html|p\/[a-zA-Z0-9_-]{8,128}|work\/[a-zA-Z0-9_-]{8,128})\/?$/.test(u.pathname)))return reply(400,'invalid_work_url');
  }
  let upstream;try{upstream=await fetch(API+'/rest/v1/contact_inquiries',{
    method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+bearer[1],'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({category,reply_email:email,work_url:target,message:message.trim()})
  })}catch{return reply(503,'contact_unavailable')}
  if(upstream.status===201||upstream.status===204)return reply(201);
  if(upstream.status===401)return reply(401,'authentication_required');
  if(upstream.status===403||upstream.status===404)return reply(403,'contact_rejected');
  if(upstream.status===409)return reply(429,'rate_limited');
  return reply(upstream.status>=500?503:400,'contact_unavailable');
}
