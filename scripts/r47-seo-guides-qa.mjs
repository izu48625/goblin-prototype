import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {staticSitemap} from '../worker/seo.js';

const text=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const slugs=['chart-guide.html','png-guide.html'];
const urls=slugs.flatMap(slug=>['ja','en'].map(lang=>'/'+lang+'/'+slug));
const docs=[];
const marketingPages=['index.html','discover.html',
  ...['ja','en'].flatMap(lang=>['index.html','chart-guide.html','png-guide.html'].map(page=>lang+'/'+page))];
for(const path of marketingPages){
  const html=await text(path);
  assert(!/(無料|架空|\\bfree\\b|\\bfictional\\b|\\bimaginary\\b|\\binvented\\b)/i.test(html),
    'Avoid unwanted promotional wording or repetitive sample labels on '+path);
}
const sourceSeo=await text('worker/seo.js');
assert(!/(自分でも無料|無料でグラフ|\\bfree charts\\b|charts for free)/i.test(sourceSeo),
  'Public work SSR should not add pushy sales language');

for(const lang of ['ja','en']){
  const home=await text(lang+'/index.html');
  // A coherent, genuinely localized search snippet must match the visible
  // WebSite description and OG metadata; do not insert keyword-stuffed text.
  const title=home.match(/<title>([^<]+)<\/title>/)?.[1];
  const description=home.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const ogTitle=home.match(/<meta property="og:title" content="([^"]+)">/)?.[1];
  const ogDescription=home.match(/<meta property="og:description" content="([^"]+)">/)?.[1];
  const rawStructuredData=home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert(title&&description&&rawStructuredData,'landing needs distinct title, description and WebSite JSON-LD');
  const structuredData=JSON.parse(rawStructuredData);
  assert.equal(ogTitle,title,'OG title should match actual search title');
  assert.equal(ogDescription,description,'OG description should match actual search description');
  assert.equal(structuredData.description,description,'JSON-LD should use same claim as page');
  assert((home.match(/<h1\b/g)||[]).length===1,'one clear landing H1');
  assert(home.includes('id="detailed-guides"'),'retain R47 practical guide links');
  assert(home.includes('section:has(> .grid)'),'keep compact feature cards on iPhone');
  assert(description.length<220,'avoid needlessly long description');
  assert.equal((await text('cloud/analytics-config.js')).includes('enabled:false'),true,'GA4 must stay off');

  // SEO-K: intent-led landing links to actual content, not dead anchors.
  for(const anchor of ['character-stats','player-stats']){
    assert(home.includes('href="/'+lang+'/chart-guide.html#'+anchor+'"'),
      lang+' comparison link must lead to a real guide section');
  }
  assert(
    lang==='ja'?home.includes('能力値')&&home.includes('スポーツ選手'):
      home.includes('character stat')&&home.includes('player comparison'),
    lang+' search intent must match real feature text');
  assert(!/seodata\.dev|trenzhub|246,000|33,100/.test(home),
    'Unverified external keyword volume must not appear in the site');
  assert(!/adsbygoogle|ca-pub-|googletagmanager\.com/.test(home),
    'GA4 and AdSense must remain inactive');

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
    if(slug==='chart-guide.html'){
      assert(html.includes('id="character-stats"')&&html.includes('id="player-stats"'),
        path+' both examples must be linkable');
      assert(html.includes('href="/index.html?lang='+lang+'"'),
        path+' users need a route into the real scoring sheet');
      assert(lang==='ja'?html.includes('サンプルのキャラクター')&&html.includes('サンプルスコア'):
        html.includes('sample game characters')&&html.includes('sample comparison'),
        path+' demonstration scores must be clearly marked as samples');
      assert(!/seodata\.dev|trenzhub|246,000|33,100/.test(html),
        'Market volume estimates must not appear in the guide');
    }

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
