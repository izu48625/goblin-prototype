import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {contactGateway} from '../worker/legal-contact.js';
const get=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [sql,workerIndex,ja,en,client,locale,discover,published,r30]=await Promise.all([
'R35_CONTACT_MIGRATION.sql','worker/index.js','ja/legal.html','en/legal.html','cloud/legal-contact.js',
'cloud/global-locale.js','discover.html','public.html','scripts/r30-home-corrupt-recovery-qa.mjs'].map(get));
for(const needle of ['ENABLE ROW LEVEL SECURITY','REVOKE ALL ON public.contact_inquiries','GRANT INSERT (category,reply_email,work_url,message)','requester_id = (SELECT auth.uid())'])assert(sql.includes(needle),needle);
assert(!/GRANT (SELECT|UPDATE|DELETE)\b/i.test(sql),'contact details must not be publicly readable');
assert(!/SECURITY DEFINER/i.test(sql));
assert(workerIndex.includes("url.pathname==='/api/report/contact'"));
for(const [language,page] of [['ja',ja],['en',en]]){
  assert(page.includes('data-sm-legal-page="'+language+'"'));
  for(const name of ['terms','privacy','copyright','contact'])assert(page.includes('id="'+name+'"'),language+':'+name);
  assert(page.includes('id="legalContactForm"'));
  assert(page.includes('<link rel="alternate" hreflang="ja"'));
  assert(page.includes('<link rel="alternate" hreflang="en"'));
  assert(!/service_role|TURNSTILE_SECRET/.test(page));
}
assert(client.includes("sb.auth.signInAnonymously()")&&client.includes("'/api/report/contact'"));
assert(ja.includes('一般問い合わせは任意、その他は必須'),'Japanese email requirement must match server');
assert(ja.includes('著作権・異議申立ては必須'),'Japanese URL requirement must match server');
assert(en.includes('optional for questions; required for other requests'),'English email requirement must match server');
assert(en.includes('required for copyright claims and appeals'),'English URL requirement must match server');
assert(!ja.includes('法的な最終確認は継続中です。'));
assert(!en.includes('legal review is ongoing.'));
assert(ja.includes('非公開の受付箱')&&en.includes('private review queue'));
assert(ja.includes('本人確認書類')&&en.includes('identity documents'));
assert(ja.includes('作成者が公開した評価結果やスナップショット'));
assert(en.includes("creator's published rating results and snapshots"));
assert(ja.includes('Community参加者ごとの採点データ'));


assert(locale.includes('const legalLang=()')&&locale.includes("'/'+lang+'/legal.html"));
for(const content of [discover,published])for(const section of ['terms','privacy','contact'])assert(content.includes('data-sm-legal-link="'+section+'"'));
assert(r30.includes('if(!(await tray.isVisible()))'),'R30 only toggles hidden utility tray');

const [remix,analytics,ads,publishModel]=await Promise.all([
 'cloud/remix.js','cloud/analytics-config.js','cloud/ad-layout.js','cloud/publish-model.js'
].map(get));
assert(ja.includes('制定：2026年10月11日')&&en.includes('Effective: October 11, 2026'));
for(const [language,page,requirements] of [
  ['ja',ja,['無料で使える範囲','コピーして採点する（Remix）','準拠法・紛争対応','運営者と窓口','安全管理','海外からの利用','Cloudflare','Supabase','jsDelivr']],
  ['en',en,['Free features','Copy &amp; rate (Remix)','Governing law and disputes','Operator and requests','Security','international users','Cloudflare','Supabase','jsDelivr']]
]){
 for(const phrase of requirements)assert(page.includes(phrase),language+': policy missing '+phrase);
 assert.equal((page.match(/id="legalContactForm"/g)||[]).length,1,'Contact form must not duplicate');
 assert(!page.includes('Google Analytics 4 is enabled')&&!page.includes('AdSense is enabled'));
}
assert(remix.includes('scores:Array(cols.length).fill(null)'),'Remix must start without source scores');
assert(remix.includes('sourceTopicId:topic.id'),'Remix source attribution must be retained');
assert(publishModel.includes("relation:'remix'"),'Republished Remix must retain source relation');
assert(analytics.includes('enabled:true')&&analytics.includes("measurementId:'G-ZT8N1BVEL8'"),'Owner-approved GA4 config missing');
assert(ja.includes('「解析設定」')&&en.includes('Help → Analytics'),'GA4 consent withdrawal notice must be present');
assert(ads.includes("get('adPreview')==='1'"),'Ad slots remain developer-only previews');

const key='a'.repeat(70)+'.'+'b'.repeat(70)+'.'+'c'.repeat(70);
const data={category:'copyright',reply_email:'owner@example.com',
 work_url:'https://statsmaker.app/public.html?id=57b432ed-fbf2-4261-b57d-9e0f27356d2e',
 message:'Original work was used without authorization. Please review.'};
let requests=0,upstream=201,allowed=true;
const original=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 requests++;assert.equal(url,'https://ibpdxbeltdwkquowjeay.supabase.co/rest/v1/contact_inquiries');
 assert.equal(init.headers.Authorization,'Bearer '+key);assert.deepEqual(JSON.parse(init.body),data);
 return new Response(null,{status:upstream});
};
const env={REPORT_RATE_LIMIT:{limit:async()=>({success:allowed})}};
function request(body=data,origin='https://statsmaker.app',bearer='Bearer '+key){
 return new Request('https://statsmaker.app/api/report/contact',{method:'POST',
   headers:{Origin:origin,'Content-Type':'application/json',Authorization:bearer},body:JSON.stringify(body)});
}
const expect=async(code,req=request(),e=env)=>assert.equal((await contactGateway(req,e)).status,code);
try{
 await expect(201);assert.equal(requests,1);
 await expect(403,request(data,'https://untrusted.example'));
 await expect(401,request(data,undefined,'Bearer nope'));
 await expect(400,request({...data,category:'other'}));
 await expect(400,request({...data,reply_email:''}));
 await expect(400,request({...data,work_url:''}));
 await expect(400,request({...data,work_url:'https://evil.example/public.html'}));
 await expect(400,request({...data,work_url:'https://statsmaker.app/admin'}));
 await expect(400,request({...data,message:'short'}));
 await expect(400,request({...data,message:'Z'.repeat(2001)}));
 await expect(503,request(),{});
 allowed=false;await expect(429);allowed=true;
 for(const [incoming,wanted] of [[401,401],[403,403],[409,429],[503,503]]){upstream=incoming;await expect(wanted)}
 console.log('R35 legal, bilingual footer, report API, RLS source contracts and R30 test correction PASS');
}finally{globalThis.fetch=original;}
