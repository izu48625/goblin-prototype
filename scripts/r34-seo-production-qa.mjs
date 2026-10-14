import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/+$/,'');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Match the currently committed page metadata; changing SEO copy must not
// break production QA merely because an outdated marketing phrase was removed.
const pages=await Promise.all(['en','ja'].map(async lang=>{
  const source=await readFile(new URL('../'+lang+'/index.html',import.meta.url),'utf8');
  const title=source.match(/<title>([^<]+)<\/title>/)?.[1];
  const description=source.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const script=source.match(/(?:\/?cloud\/global-locale\.js\?v=[A-Za-z0-9.-]+)/)?.[0];
  assert(title&&description&&script,'Missing indexed landing metadata or shared nav: '+lang);
  return {lang,path:'/'+lang+'/',title,description,script};
}));
const fetchText=async(path)=>{
  const response=await fetch(base+path,{headers:{'User-Agent':'StatsMakerR34ReadOnlyQA/1.0'},redirect:'follow'});
  return {response,text:await response.text()};
};
async function awaitRelease(){
  for(let i=0;i<30;i++){
    try{
      const [en,ja,map]=await Promise.all([fetchText('/en/'),fetchText('/ja/'),fetchText('/sitemap.xml')]);
      const live=[en,ja];
      if(live.every((p,i)=>p.response.ok&&
          p.text.includes('<title>'+pages[i].title+'</title>')&&
          p.text.includes(pages[i].script))&&
        map.response.ok&&map.text.includes('<sitemapindex'))return;
    }catch(e){console.log('R34 release poll',String(e))}
    await sleep(5000);
  }
  throw new Error('R34 English SEO landing and XML sitemap not deployed after 150 seconds');
}
await awaitRelease();
for(const {path,lang,title,description,script} of pages){
  const {response,text}=await fetchText(path);
  assert.equal(response.status,200,path);
  assert(text.includes('<html lang="'+lang+'">'));
  assert(text.includes('hreflang="en"'));
  assert(text.includes('hreflang="ja"'));
  assert(text.includes('href="https://statsmaker.app/'+lang+'/"'));
  assert(text.includes('<title>'+title+'</title>'),'Production SEO title differs from current source: '+path);
  assert(text.includes('<meta name="description" content="'+description+'">'),'Production SEO description mismatch: '+path);
  assert(text.includes(script),'Production shared menu JS is stale: '+path);
  assert(text.includes('chart-guide.html')&&text.includes('png-guide.html'),'Practical guides not linked from '+path);
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
