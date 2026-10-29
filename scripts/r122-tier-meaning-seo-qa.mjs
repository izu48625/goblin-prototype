import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const sitemap=await read('worker/seo.js');
const nav=await read('cloud/global-locale.js');
assert(sitemap.includes("'/ja/tier.html','/en/tier.html'"),'Both Tier meaning pages must be sitemap-visible');
assert(nav.includes("'tier-maker.html','tier.html'"),'Language switch must keep the current Tier page');
const records=[
  {lang:'ja',title:'ティア（tier）とは？',other:'en',term:'ティア',rank:'Tier 1'},
  {lang:'en',title:'Tier Meaning:',other:'ja',term:'tier',rank:'Tier 1'}
];
for(const d of records){
  const html=await read(d.lang+'/tier.html');
  const home=await read(d.lang+'/index.html');
  const maker=await read(d.lang+'/tier-maker.html');
  const chart=await read(d.lang+'/chart-guide.html');
  assert(html.includes('<html lang="'+d.lang+'">'),'Correct declared page language');
  assert(html.includes('<title>'+d.title),'Unique meaningful page title');
  assert(html.includes('name="description"'),'Organic description present');
  assert(html.includes('<meta name="robots" content="index,follow">'),'Indexable page');
  assert(html.includes('<link rel="canonical" href="https://statsmaker.app/'+d.lang+'/tier.html">'),'Canonical missing');
  for(const lang of ['ja','en'])assert(html.includes('hreflang="'+lang+'" href="https://statsmaker.app/'+lang+'/tier.html"'));
  assert(html.includes('hreflang="x-default"'));
  assert(html.includes('data-sm-reading-page="'+d.lang+'"'),'Native language-aware navigation');
  assert(html.includes('<h1>')&&html.includes(d.term)&&html.includes(d.rank),'Actual article heading/content');
  assert(html.includes('id="definition"')&&html.includes('id="tiers"')&&html.includes('id="tier-number"'));
  assert(html.includes('id="worked-example"')&&html.includes('id="ranking"')&&html.includes('id="how-to"'));
  assert(html.includes('src="/ja/example-images/sample-tier.png"'),'Original illustrative PNG');
  assert(html.includes('<th scope="row">Green Team</th><td>92.5</td><td>S</td>'));
  assert(html.includes('<th scope="row">Blue Team</th><td>75.0</td><td>B</td>'));
  assert(html.includes('href="/'+d.lang+'/tier-maker.html"'),'Accessible functional action');
  assert(html.includes('href="/'+d.other+'/tier.html"'),'Other language version linked');
  assert(!/adsbygoogle\.js|googletagmanager\.com/.test(html),'No newly-enabled advertising or GA4');
  for(const [label,linked] of [['home',home],['maker',maker],['chart guide',chart]]){
    assert(linked.includes('/'+d.lang+'/tier.html'),'Missing contextual link from '+label);
  }
  const ld=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert(ld,'JSON-LD Article');
  const parsed=JSON.parse(ld[1]);
  assert.equal(parsed['@type'],'Article');
  assert.equal(parsed.inLanguage,d.lang);
  assert.equal(parsed.mainEntityOfPage,'https://statsmaker.app/'+d.lang+'/tier.html');
}
console.log('R122 PASS: JA/EN meaning pages provide genuinely distinct informative content, canonical/hreflang, sitemap, original data and natural internal links');
