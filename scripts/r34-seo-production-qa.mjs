import assert from 'node:assert/strict';

const base=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/+$/,'');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fetchText=async(path)=>{
  const response=await fetch(base+path,{headers:{'User-Agent':'StatsMakerR34ReadOnlyQA/1.0'},redirect:'follow'});
  return {response,text:await response.text()};
};
async function awaitRelease(){
  for(let i=0;i<30;i++){
    try{
      const [en,map]=await Promise.all([fetchText('/en/'),fetchText('/sitemap.xml')]);
      if(en.response.ok&&en.text.includes('Turn ratings and comparisons into shareable charts')&&
        map.response.ok&&map.text.includes('<sitemapindex'))return;
    }catch(e){console.log('R34 release poll',String(e))}
    await sleep(5000);
  }
  throw new Error('R34 English SEO landing and XML sitemap not deployed after 150 seconds');
}
await awaitRelease();
for(const [path,lang,fragment] of [
  ['/en/','en','Free Chart Maker'],['/ja/','ja','無料グラフ作成']]){
  const {response,text}=await fetchText(path);
  assert.equal(response.status,200,path);
  assert(text.includes('<html lang="'+lang+'">'));
  assert(text.includes('hreflang="en"'));
  assert(text.includes('hreflang="ja"'));
  assert(text.includes('href="https://statsmaker.app/'+lang+'/"'));
  assert(text.includes(fragment));
  console.log('LIVE SEO LANDING PASS',path,response.url);
}
const robots=await fetchText('/robots.txt');
assert(robots.text.includes('Sitemap: https://statsmaker.app/sitemap.xml'));
const index=await fetchText('/sitemap.xml');
assert.equal(index.response.status,200);
assert(index.text.includes('/sitemap-static.xml'));
assert(index.text.includes('/sitemap-works-1.xml'));
const staticMap=await fetchText('/sitemap-static.xml');
assert.equal(staticMap.response.status,200);
assert(staticMap.text.includes('/en/'));
assert(staticMap.text.includes('/ja/'));
assert(!staticMap.text.includes('/my/'));
const map=await fetchText('/sitemap-works-1.xml');
assert.equal(map.response.status,200);
const urls=[...map.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert(urls.length>0,'Expected at least one public work in sitemap');
assert(urls.every(url=>/^https:\/\/statsmaker\.app\/work\/[a-f0-9-]{36}$/.test(url)));
const example=await fetch(urls[0],{redirect:'manual'});
assert.equal(example.status,200,'Public search landing did not resolve');
const html=await example.text();
assert(html.includes('<meta name="robots" content="index,follow">'));
assert(html.includes('rel="canonical"'));
assert(html.includes('schema.org'));
assert(html.includes('/public.html?id='));
assert(!html.includes('http-equiv="refresh"'));
assert.equal(example.headers.get('Cache-Control'),'no-store');
console.log('LIVE SEO SITEMAP AND WORK PASS',urls.length,'indexable public works; first',urls[0]);
console.log('R34 live read-only production SEO QA PASS');
