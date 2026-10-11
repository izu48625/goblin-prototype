import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {workReportGateway} from '../worker/work-report.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const sql=await read('R35_REPORTS_MIGRATION.sql');
for(const needle of ['ENABLE ROW LEVEL SECURITY','REVOKE ALL ON public.work_reports','GRANT INSERT (topic_id,reason,details)',"t.visibility = 'public'",'work_reports_unique_reporter_topic','reporter_id uuid NOT NULL DEFAULT auth.uid()'])assert(sql.includes(needle),needle);
assert(!/GRANT (SELECT|UPDATE|DELETE)/i.test(sql),'Reports must be write-only for browser users');
assert((await read('cloud/public.js')).includes('id="reportTopicBtn"'));
assert((await read('cloud/public.js')).includes("data.visibility==='public'&&!isOwner"));
assert((await read('public.html')).includes('cloud/work-report.js?v=r35work1'));
assert((await read('cloud/public.css')).includes('.workReportDialog'));
assert((await read('worker/index.js')).includes("url.pathname==='/api/report/work'"));
const wrangler=JSON.parse(await read('wrangler.jsonc'));
assert(wrangler.assets.run_worker_first.includes('/api/report/*'));
assert(wrangler.ratelimits.some(r=>r.name==='REPORT_RATE_LIMIT'&&r.simple.limit===6));
const token='a'.repeat(70)+'.'+'b'.repeat(70)+'.'+'c'.repeat(70);
const topic='67ab2345-1234-4567-8123-a1255f1e9d30';
const body={topic_id:topic,reason:'spam',details:''};
let sent=0,status=201,allowed=true;
const old=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
  sent++;assert.equal(url,'https://ibpdxbeltdwkquowjeay.supabase.co/rest/v1/work_reports');
  assert.equal(init.headers.Authorization,'Bearer '+token);
  assert.deepEqual(JSON.parse(init.body),body);
  return new Response(null,{status});
};
const env={REPORT_RATE_LIMIT:{limit:async()=>({success:allowed})}};
function req(data=body,extra={}){
  return new Request('https://statsmaker.app/api/report/work',{method:'POST',
    headers:{Origin:extra.origin||'https://statsmaker.app','Content-Type':'application/json',
    Authorization:extra.auth||'Bearer '+token},body:JSON.stringify(data)});
}
const expect=async(n,request=req(),e=env)=>assert.equal((await workReportGateway(request,e)).status,n);
try{
  await expect(201);assert.equal(sent,1);
  await expect(403,req(body,{origin:'https://malicious.example'}));
  await expect(401,req(body,{auth:'Bearer invalid'}));
  await expect(400,req({...body,topic_id:'invalid'}));
  await expect(400,req({...body,reason:'unapproved'}));
  await expect(400,req({...body,reason:'other',details:'short'}));
  await expect(400,req({...body,details:'X'.repeat(501)}));
  await expect(503,req(),{});
  allowed=false;await expect(429);allowed=true;
  for(const [upstream,wanted] of [[409,409],[401,401],[403,403],[503,503]]){status=upstream;await expect(wanted)}
  console.log('R35 report gateway validation, rate-limit, dedupe and RLS security contracts PASS');
}finally{globalThis.fetch=old;}