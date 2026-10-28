import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';

const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const conf=JSON.parse(await read('wrangler.jsonc'));
for(const pattern of ['/work/*','/sitemap.xml','/sitemap-static.xml','/sitemap-works-*.xml'])
  assert(conf.assets.run_worker_first.includes(pattern),'Worker route missing '+pattern);

const en=await read('en/index.html');
const ja=await read('ja/index.html');
const root=await read('index.html');
const discover=await read('discover.html');
const robot=await read('robots.txt');
const builder=await read('scripts/build-cloudflare.mjs');
for(const [html,lang] of [[en,'en'],[ja,'ja']]){
  assert(html.includes('<html lang="'+lang+'">'));
  assert(html.includes('href="https://statsmaker.app/'+lang+'/"'));
  assert(html.includes('hreflang="en"'));
  assert(html.includes('hreflang="ja"'));
  assert(html.includes('hreflang="x-default"'));
  assert(html.includes('href="../index.html?lang='+lang+'"'));
  assert(html.includes('href="../discover.html?lang='+lang+'"'));
  assert(html.includes('name="description"'));
}
assert(en.includes('Chart Maker for Radar'), 'English chart-maker search title missing');
assert(en.includes('anime')||en.includes('Anime'), 'English topic coverage missing');
assert(ja.includes('グラフ作成・能力比較'));
assert(root.includes("localStorage.setItem('statsMaker.locale',language)"));
assert(discover.includes('rating charts'));
assert(robot.includes('Sitemap: https://statsmaker.app/sitemap.xml'));
assert(builder.includes("'en','ja'"));
for(const p of ['public.html','my.html','rate.html','base/index.html','app/editor.html']){
  assert((await read(p)).includes('<meta name="robots" content="noindex,follow">'),
    'User/private/internal page must be noindex: '+p);
}

const publicId='071a2bf3-2a17-490d-a2f5-b5b0a5832438';
const unlistedId='8a6fec8a-dec2-4764-b5c0-91cebf2a0481';
const malicious='<img src=x onerror=alert(1)>';
const fixture={
  id:publicId,title:'Best football players – '+malicious,
  description:'Rank the best football players & compare scores.',
  visibility:'public',language_code:'en',published_at:'2026-10-10T18:00:00Z',
  snapshot:{rows:[{name:'Messi & Ronaldo',scores:[8,9]},{name:malicious,scores:[null,5]},{name:'Neymar',scores:[7,6]}],
    criteria:[{name:'Skill'},{name:'Goals'}],scale:10}
};
const publicSummary={id:publicId,visibility:'public',
  snapshot_updated_at:'2026-10-10T18:00:00Z'};
const privateSummary={id:unlistedId,visibility:'unlisted',
  snapshot_updated_at:'2026-10-10T18:00:00Z'};

let upstream=0;
const savedFetch=globalThis.fetch;
let shouldFail=false;
globalThis.fetch=async url=>{
  upstream++;
  const u=new URL(String(url));
  assert.equal(u.hostname,'ibpdxbeltdwkquowjeay.supabase.co');
  assert.equal(u.searchParams.get('visibility'),'eq.public',
    'Any indexable SEO query must require visibility=eq.public');
  if(shouldFail)return new Response('unavailable',{status:502});
  if(u.searchParams.get('select')==='id'){
    const r=new Response(JSON.stringify([{id:publicId}]),{status:200,headers:{
      'Content-Type':'application/json','Content-Range':'0-0/1'
    }});
    return r;
  }
  if(u.searchParams.get('id')){
    const select=u.searchParams.get('select')||'';
    assert(select.includes('seo_scores_0:snapshot->rows->0->scores'),
      'The public score table should use bounded JSON path fields');
    assert(!select.includes('snapshot,'),'Never fetch an entire snapshot for SEO');
    return Response.json(
    u.searchParams.get('id')==='eq.'+publicId?[fixture]:[]);
  }
  return Response.json([publicSummary,privateSummary]);
};
const env={ASSETS:{async fetch(){return new Response('asset-fallback',{status:200})}}};
const req=(path,opts)=>worker.fetch(new Request('https://statsmaker.app'+path,opts),env);
try{
  const index=await req('/sitemap.xml');
  assert.equal(index.status,200);
  assert.match(index.headers.get('Content-Type'),/xml/);
  const indexXML=await index.text();
  assert(indexXML.includes('/sitemap-static.xml'));
  assert(indexXML.includes('/sitemap-works-1.xml'));
  assert(!indexXML.includes('/sitemap-works-2.xml'));

  const staticSite=await req('/sitemap-static.xml');
  const staticXML=await staticSite.text();
  for(const path of ['/en/','/ja/','/discover'])
    assert(staticXML.includes('https://statsmaker.app'+path));
  assert(staticXML.includes('<loc>https://statsmaker.app/</loc>'),
    'The actual root scoring app must be discoverable, not only language landings');
  assert(!staticXML.includes('/my'));
  assert(!staticXML.includes('/public?id'));

  const works=await req('/sitemap-works-1.xml');
  assert.equal(works.status,200);
  const worksXml=await works.text();
  assert(worksXml.includes('/work/'+publicId));
  assert(!worksXml.includes(unlistedId),'Unlisted work leaked into sitemap');
  assert(worksXml.includes('<lastmod>2026-10-10</lastmod>'));

  const html=await req('/work/'+publicId);
  assert.equal(html.status,200);
  assert.equal(html.headers.get('Cache-Control'),'no-store',
    'Visibility changes must invalidate indexable SSR immediately');
  const body=await html.text();
  assert(body.includes('lang="en"'));
  assert(body.includes('<meta name="robots" content="index,follow">'));
  assert(body.includes('<link rel="canonical" href="https://statsmaker.app/work/'+publicId+'">'));
  assert(body.includes('/public.html?id='+publicId));
  assert(body.includes('Messi &amp; Ronaldo'));
  assert(body.includes('Rating criteria'));
  assert(body.includes('Published rating excerpt'),'Search results must expose real Public score values');
  assert(body.includes('>8</td>')&&body.includes('>9</td>'),"Use the author’s real scores, not invented rankings");
  assert(body.includes('>—</td>'),'Missing ratings must not become zeros');
  assert(body.includes('Maximum score: 10 points'),'Use real scale for interpretations');
  assert(!body.includes(malicious),'Raw HTML in user submissions is unsafe');
  assert(!body.includes('<script>alert('));
  assert(body.includes('schema.org'));
  assert(!body.includes('http-equiv="refresh"'),'SEO landing should not redirect automatically');
  assert(!body.includes('location.replace('));

  // Missing description: derive only truthful visible Public subjects and
  // criterion names. Escape all user-supplied text in HTML and metadata.
  const authoredDescription=fixture.description;
  fixture.description='';
  const derived=await req('/work/'+publicId);
  assert.equal(derived.status,200);
  const derivedBody=await derived.text();
  assert(derivedBody.includes('Compare Messi &amp; Ronaldo'),
    'Actual public target names should inform an absent work description');
  assert(derivedBody.includes('Rating criteria: Skill, Goals'),
    'Actual public metric names should inform an absent work description');
  assert(!derivedBody.includes(malicious),
    'Generated Public description must HTML-escape submitted content');
  assert(derivedBody.includes('<meta name="description" content="'),
    'Generated description should be machine-readable');

  fixture.language_code='ja';
  const jpDerived=await req('/work/'+publicId);
  assert.equal(jpDerived.status,200);
  const jpBody=await jpDerived.text();
  assert(jpBody.includes('比較対象：'),'Japanese Public summary must be localized');
  assert(jpBody.includes('評価項目：'),'Japanese Public criteria must be localized');
  assert(!jpBody.includes(malicious),'Japanese fallback must escape submitted text');
  fixture.language_code='en';
  fixture.description=authoredDescription;

  const unlisted=await req('/work/'+unlistedId);
  assert.equal(unlisted.status,404);
  assert((await unlisted.text()).includes('noindex'));
  const malformed=await req('/work/aaaaaaaa');
  assert.equal(malformed.status,404);
  assert.equal((await req('/sitemap-works-251.xml')).status,404);
  const prohibited=await req('/work/'+publicId,{method:'POST'});
  assert.equal(prohibited.status,405);
  assert.equal((await req('/sitemap.xml',{method:'POST'})).status,405);
  shouldFail=true;
  const unavailable=await req('/work/'+publicId);
  assert.equal(unavailable.status,503,'Unavailable database must not produce indexable pages');
  assert.equal(unavailable.headers.get('Cache-Control'),'no-store');
  assert.equal((await req('/sitemap.xml')).status,503);
  assert.equal((await req('/sitemap-works-1.xml')).status,503);
  const other=await req('/');
  assert.equal(await other.text(),'asset-fallback');
  assert(upstream<18,'Bound upstream calls to stay within Cloudflare Free limits');
  console.log('R34 bilingual SEO + public-only sitemap + noindex/escape/503 fail closed PASS');
}finally{globalThis.fetch=savedFetch}
