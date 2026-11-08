// Read-only production crawlability audit. Not a substitute for Google
// Search Console's authenticated index inspection.
// Does not follow private/unlisted URLs, change Supabase, or index content.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const root=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/$/,'');
const get=async(path)=>{
  const url=root+path;
  const res=await fetch(url,{headers:{Accept:path.endsWith('.xml')?'application/xml':'text/html'},
    signal:AbortSignal.timeout(12000),cache:'no-store'});
  const body=await res.text();
  assert.equal(res.status,200,url+' HTTP '+res.status);
  return {res,body};
};
const decode=xml=>xml.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const robots=await get('/robots.txt');
assert(robots.body.includes('Sitemap: '+root+'/sitemap.xml'));
const main=await get('/sitemap.xml');
assert(main.body.includes(root+'/sitemap-static.xml'),'Sitemap index must expose static pages');
const staticMap=await get('/sitemap-static.xml');
for(const page of ['/','/ja/','/en/','/discover']){
  assert(staticMap.body.includes('<loc>'+root+page+'</loc>'),'Static sitemap missing '+page);
}
// Cloudflare deployment is asynchronous relative to the GitHub push.
// Wait for the actual new navigation before making a definitive production claim.
let navReady=false;
for(let attempt=1;attempt<=8;attempt++){
  const bodies=await Promise.all(['/ja/','/en/'].map(page=>get(page).then(x=>x.body)));
  navReady=bodies.every(body=>{
    const rail=body.match(/<nav class="r71CategoryRail"[^>]*>([\\s\\S]*?)<\\/nav>/)?.[1]||'';
    return rail.includes('category=sports')&&rail.includes('category=manga_anime')&&
      !rail.includes('category=game')&&!rail.includes('category=movie_tv');
  });
  if(navReady)break;
  console.log('New landing navigation not deployed yet; check '+attempt+'/8');
  if(attempt<8)await delay(12000);
}
assert(navReady,'Landing navigation not deployed within the bounded check window');
for(const page of ['/ja/','/en/']){
  const {body}=await get(page);
  assert(body.includes('<meta name="robots" content="index,follow">'));
  assert(body.includes('<link rel="canonical" href="'+root+page+'">'));
  assert(body.includes('category=sports'));
  assert(body.includes('category=manga_anime'));
  const rail=body.match(/<nav class="r71CategoryRail"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  assert(!rail.includes('category=game')&&!rail.includes('category=movie_tv'),
    'Empty categories must not be highlighted on '+page);
}
let inspectedWorks=0;
if(main.body.includes('/sitemap-works-1.xml')){
  const works=await get('/sitemap-works-1.xml');
  const urls=[...works.body.matchAll(/<loc>(https:\/\/statsmaker\.app\/work\/[0-9a-f-]{36})<\/loc>/gi)]
    .map(m=>decode(m[1])).slice(0,12);
  for(const url of urls){
    const page=await get(url.slice(root.length));
    assert(page.body.includes('<meta name="robots" content="index,follow">'));
    assert(page.body.includes('<link rel="canonical" href="'+url+'">'));
    assert(page.body.includes('<h1>'),'Public work must expose original title');
    inspectedWorks++;
  }
}
const byCategory={};
for(const category of ['sports','manga_anime']){
  const {body}=await get('/discover?category='+category);
  const payload=body.match(/<script type="application\/json" id="discover-ssr-data">([^<]*)<\/script>/)?.[1];
  assert(payload,'SSR Public cards must be visible to crawlers for '+category);
  const data=JSON.parse(payload);
  assert.equal(data.category,category);
  assert(Array.isArray(data.data?.rows)&&data.data.rows.length<=12);
  for(const row of data.data.rows){
    assert.equal(row.visibility,'public');
    assert.equal(row.snapshot?.metadata?.category,category,
      'Filtered category must match the actual Public snapshot');
  }
  byCategory[category]=data.data.total;
}
console.log('LIVE crawlability/canonical/navigation audit PASS',
  JSON.stringify({inspectedWorks,byCategory,warning:'Not a Search Console index status'}));
