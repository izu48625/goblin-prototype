import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTierProject} from '../app/src/core/project.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const seo=await read('worker/seo.js');
const nav=await read('cloud/global-locale.js');
const example=await read('ja/examples.html');
const exampleEn=await read('en/examples.html');
const starter=await read('cloud/tier-seo-start.js');
const css=await read('cloud/tier-seo.css');
assert.match(seo,/['"]\/ja\/tier-maker\.html['"]/);
assert.match(seo,/['"]\/en\/tier-maker\.html['"]/);
assert(nav.includes("'tier-maker.html'"),'Language switch must include new Tier page');
assert(example.includes('/ja/tier-maker.html'));
assert(exampleEn.includes('/en/tier-maker.html'));
assert(starter.includes('createTierProject()')&&starter.includes('saveProject(project)'));
assert(starter.includes('location.assign(url.pathname+url.search)'));
assert(!/\.from\(['"]topics['"]\)|\.insert\(|\.upsert\(|\.rpc\(/.test(starter),
  'Search landing should never write cloud/Public data');
assert(css.includes('@media(max-width:700px)'));
for(const lang of ['ja','en']){
  const html=await read(lang+'/tier-maker.html');
  const home=await read(lang+'/index.html');
  assert(home.includes('/'+lang+'/tier-maker.html'),'SEO landing unlinked from Home');
  assert(html.includes('<html lang="'+lang+'">'));
  assert(html.includes('data-sm-reading-page="'+lang+'"'));
  assert(html.includes('<meta name="robots" content="index,follow">'));
  assert(html.includes('<link rel="canonical" href="https://statsmaker.app/'+lang+'/tier-maker.html">'));
  assert(html.includes('hreflang="ja"')&&html.includes('hreflang="en"')&&html.includes('hreflang="x-default"'));
  assert(html.includes('src="/cloud/tier-seo-start.js?v=r121seo1"'));
  assert(html.includes('id="tierStart"'));
  assert(html.includes('src="/ja/example-images/sample-tier.png"'));
  assert(html.includes('<table class="tierSeoTable">'));
  assert(html.includes('Tier')&&html.includes(lang==='ja'?'ティア':'tier list'));
  const scripts=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)];
  assert.equal(scripts.length,1,'one WebApplication JSON-LD block');
  const structured=JSON.parse(scripts[0][1]);
  assert.equal(structured['@type'],'WebApplication');
  assert.equal(structured.inLanguage,lang);
  assert.equal(structured.url,'https://statsmaker.app/'+lang+'/tier-maker.html');
}
const project=createTierProject();
assert.equal(project.type,'tier-list');
assert.deepEqual(project.data.tiers.map(t=>t.label),['S','A','B','C','D']);
assert.equal(project.data.items.length,5);
console.log('R121 Tier SEO PASS: indexed JA/EN HTML, correct schema, sitemap, links and real local editor action');
