import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {brotliCompressSync,gzipSync} from 'node:zlib';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicWorkHtml} from '../worker/seo.js';

const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGIN='https://statsmaker.app';
const KNOWN_PUBLIC='57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const mode=process.argv[2]||'local';
const read=path=>readFile(join(ROOT,path),'utf8');
const bytes=path=>readFile(join(ROOT,path));
const banner=(key,value)=>console.log('R38 READINESS',key,JSON.stringify(value));
const noRealAds=source=>!/<script[^>]+(?:adsbygoogle|pagead2\.googlesyndication|doubleclick\.net)/i.test(source);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function localAudit(){
  const paths=['ja/index.html','en/index.html','ja/legal.html','en/legal.html'];
  const pages=await Promise.all(paths.map(read));
  const [ja,en,jaLegal,enLegal]=pages;
  for(const [html,lang] of [[ja,'ja'],[en,'en']]){
    assert(html.includes('<html lang="'+lang+'">'));
    assert(html.includes('hreflang="ja"')&&html.includes('hreflang="en"'));
    assert(html.includes('<link rel="canonical" href="'+ORIGIN+'/'+lang+'/">'));
    assert(html.includes('<h1>')&&html.includes('name="description"'));
    assert(html.includes('href="../index.html?lang='+lang+'"'));
    assert(html.includes('href="../discover.html?lang='+lang+'"'));
    assert(html.includes('/'+lang+'/legal.html#privacy'));
    assert(noRealAds(html),'Unexpected live advertising in '+lang);
  }
  for(const [html,lang] of [[jaLegal,'ja'],[enLegal,'en']]){
    for(const section of ['terms','privacy','contact']){
      assert(html.includes('id="'+section+'"'),'Missing '+lang+' '+section);
    }
    assert(noRealAds(html));
  }
  const robots=await read('robots.txt');
  assert(robots.includes('Sitemap: '+ORIGIN+'/sitemap.xml'));
  const analytics=await read('cloud/analytics-config.js');
  assert(analytics.includes('enabled:false'),'GA4 was activated without approval');
  assert(analytics.includes("measurementId:''"),'GA4 measurement ID supplied unexpectedly');
  const layout=await read('cloud/ad-layout.js');
  assert(layout.includes('adPreview=1'),'Ad placement must remain preview-only');
  const builder=await read('scripts/build-cloudflare.mjs');
  assert(builder.includes("'robots.txt'"));
  const dynamicSource=await read('worker/seo.js');
  assert(dynamicSource.includes("visibility:'eq.public'"),'Public SEO must exclude URL-limited works');
  assert(dynamicSource.includes("'no-store'"),'Revoked SEO pages need no-store');
  const metrics=[];
  for(const path of ['ja/index.html','en/index.html','index.html',
    'discover.html','base/js/app.js','app/src/editor/editor.js']){
    const data=await bytes(path);
    metrics.push({path,rawKB:Math.round(data.length/1024),
      gzipKB:Math.round(gzipSync(data).length/1024),
      brotliKB:Math.round(brotliCompressSync(data).length/1024)});
    // Keep the two crawlable, text-only localized introductions light.
    if(path==='ja/index.html'||path==='en/index.html')
      assert(brotliCompressSync(data).length<16*1024,'Oversized SEO landing: '+path);
  }
  banner('asset-budgets-informational',metrics);
  // Mock both languages and the revoked case without a Supabase request.
  const oldFetch=globalThis.fetch;
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
  const work=id=>({
    id,title:'Comparison QA',description:'Description',
    language_code:id===ids[1]?'en':'ja',
    visibility:id===ids[2]?'private':'public',
    snapshot:{rows:[{name:'Subject',scores:[90]}],criteria:[{name:'Metric',weight:1}]}
  });
  try{
    globalThis.fetch=async url=>{
      const u=new URL(String(url));
      assert(u.hostname.endsWith('.supabase.co'));
      assert.equal(u.searchParams.get('visibility'),'eq.public');
      const id=u.searchParams.get('id')?.slice(3);
      return new Response(JSON.stringify(id===ids[2]?[]:[work(id)]),{status:200});
    };
    for(const [id,language] of [[ids[0],'ja'],[ids[1],'en']]){
      const res=await publicWorkHtml(id);
      assert.equal(res.status,200);
      assert.equal(res.headers.get('Cache-Control'),'no-store');
      const html=await res.text();
      for(const section of ['terms','privacy','contact'])
        assert(html.includes('/'+language+'/legal.html#'+section),'Missing '+language+' '+section);
      assert(html.includes('rel="canonical" href="'+ORIGIN+'/work/'+id+'"'));
      assert(html.includes('name="robots" content="index,follow"'));
      assert(noRealAds(html));
    }
    const privateResponse=await publicWorkHtml(ids[2]);
    assert.equal(privateResponse.status,404);
    assert(!(await privateResponse.text()).includes('Comparison QA'));
  }finally{
    globalThis.fetch=oldFetch;
  }
  console.log('R38 LOCAL SEO, localized legal links, no-live-ad and lightweight landing QA PASS');
}
async function liveAudit(){
  const fetchPage=async path=>{
    const started=performance.now();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(ORIGIN+path,{
        headers:{'User-Agent':'StatsMaker-R38-ReadOnly-QA/1.0'},
        cache:'no-store',signal:controller.signal
      });
      const html=await response.text();
      banner('live-page',{path,status:response.status,
        ms:Math.round(performance.now()-started),bytes:Buffer.byteLength(html)});
      return {response,html};
    }finally{clearTimeout(timeout)}
  };
  // Waiting only for an HTTP-visible release marker, not performing any writes.
  let published=false;
  for(let i=0;i<24;i++){
    try{
      const p=await fetchPage('/work/'+KNOWN_PUBLIC);
      if(p.response.status===200 && /\/(ja|en)\/legal\.html#privacy/.test(p.html)){
        published=true;break;
      }
    }catch(e){banner('live-poll-retry',String(e))}
    await sleep(5000);
  }
  assert(published,'R38 updated Public SEO footer not available on production');
  for(const [path,expected] of [
    ['/ja/','<html lang="ja">'],['/en/','<html lang="en">'],
    ['/ja/legal.html','id="privacy"'],['/en/legal.html','id="privacy"'],
    ['/robots.txt','Sitemap: '+ORIGIN+'/sitemap.xml'],
    ['/sitemap.xml','<sitemapindex'],['/sitemap-static.xml','/en/']
  ]){
    const p=await fetchPage(path);
    assert.equal(p.response.status,200,path);
    assert(p.html.includes(expected),path+' expected marker missing');
    assert(!p.html.includes('<script src="https://pagead2.googlesyndication.com'),
      'Unexpected live AdSense loader at '+path);
  }
  const notFound=await fetchPage('/work/00000000-0000-4000-8000-000000000000');
  assert.equal(notFound.response.status,404);
  assert.equal(notFound.response.headers.get('Cache-Control'),'no-store');
  const rawViewer=await fetchPage('/public.html');
  assert.equal(rawViewer.response.status,200);
  assert(rawViewer.html.includes('name="robots" content="noindex,follow"'));
  console.log('R38 LIVE READ-ONLY bilingual SEO and Public-only work audit PASS');
}
async function legacyReadOnlyProbe(){
  const base='https://stats-maker-ogp.vercel.app';
  const revoked='00000000-0000-4000-8000-000000000000';
  for(const path of ['/p/'+revoked,'/api/og?id='+revoked]){
    try{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),15000);
      let response;
      try{
        response=await fetch(base+path,{redirect:'manual',
          headers:{'User-Agent':'StatsMaker-R38-ReadOnly-QA/1.0'},
          cache:'no-store',signal:controller.signal});
      }finally{clearTimeout(timeout)}
      const cache=response.headers.get('Cache-Control')||'';
      const compliant=response.status===404&&/no-store/i.test(cache);
      // Observation only: a separate Vercel deployment and external social
      // caches are outside this GitHub/Cloudflare release gate.
      banner('LEGACY_DIRECT_HOST_'+(compliant?'PASS':'NEEDS_REVIEW'),
        {path,status:response.status,cache,compliant});
    }catch(error){
      banner('LEGACY_DIRECT_HOST_UNVERIFIED',{path,error:String(error)});
    }
  }
}
if(mode==='local')await localAudit();
else if(mode==='live')await liveAudit();
else if(mode==='legacy')await legacyReadOnlyProbe();
else throw Error('Unknown audit mode '+mode);
