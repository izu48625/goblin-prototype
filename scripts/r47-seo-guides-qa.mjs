import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {staticSitemap} from '../worker/seo.js';

const text=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const slugs=['chart-guide.html','png-guide.html'];
const urls=slugs.flatMap(slug=>['ja','en'].map(lang=>'/'+lang+'/'+slug));
const docs=[];
for(const lang of ['ja','en']){
  const home=await text(lang+'/index.html');
  assert(home.includes('href="/'+lang+'/chart-guide.html"'),'chart guide must have a real landing-page link');
  assert(home.includes('href="/'+lang+'/png-guide.html"'),'PNG guide must have a real landing-page link');
  for(const slug of slugs){
    const path=lang+'/'+slug,html=await text(path);
    docs.push(html);
    assert(html.includes('<html lang="'+lang+'">'),path+' localized html');
    assert(html.includes('<meta name="robots" content="index,follow">'),path+' indexable');
    assert(html.includes('<link rel="canonical" href="https://statsmaker.app/'+path+'">'),path+' canonical');
    for(const v of ['ja','en'])
      assert(html.includes('hreflang="'+v+'" href="https://statsmaker.app/'+v+'/'+slug+'"'),path+' hreflang '+v);
    assert(html.includes('href="/index.html?lang='+lang+'"'),path+' working creation CTA');
    assert(html.includes('href="/'+lang+'/legal.html#privacy"'),path+' privacy link');
    assert(html.includes('href="/'+lang+'/legal.html#contact"'),path+' contact link');
    assert(html.includes('<main>')&&html.includes('<h1>')&&html.includes('<h2>'),path+' semantic guide headings');
    assert((html.match(/<section\b/g)||[]).length>=4,path+' practical content');
    assert(!/google-analytics\.com|googletagmanager\.com|adsbygoogle|ca-pub-/.test(html),path+' no live tracking/ads');
    assert(!/noindex|private client key|service_role/i.test(html),path+' no unneeded private material');
    assert(html.includes('href="/'+lang+'/'+(slug==='chart-guide.html'?'png-guide.html':'chart-guide.html')+'"'),path+' complementary guide link');
  }
}
assert(new Set(docs.map(html=>html.match(/<title>(.*?)<\/title>/)?.[1])).size===4,'all localized guide titles distinct');
const response=staticSitemap();
assert.equal(response.status,200,'static sitemap served');
const sitemap=await response.text();
for(const path of urls)assert(sitemap.includes('<loc>https://statsmaker.app'+path+'</loc>'),'new guide missing from XML: '+path);
for(const existing of ['/ja/','/en/','/discover'])
  assert(sitemap.includes('<loc>https://statsmaker.app'+existing+'</loc>'),'existing indexable route lost '+existing);
assert(!sitemap.includes('/private')&&!sitemap.includes('/unlisted'),'private/unlisted forbidden in sitemap');
await access(new URL('../dist/ja/chart-guide.html',import.meta.url));
await access(new URL('../dist/ja/png-guide.html',import.meta.url));
await access(new URL('../dist/en/chart-guide.html',import.meta.url));
await access(new URL('../dist/en/png-guide.html',import.meta.url));
console.log('R47 people-first guides PASS: 4 localized pages, internal links, canonicals, hreflang, sitemap, static assets');
