import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {staticSitemap} from '../worker/seo.js';
import {weightedAverage,rankSample} from '../cloud/scoring-guide.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const expected=[
  [9,5,8,7.33,7.75,6.40],
  [7,8,7,7.33,7.25,7.60],
  [6,9,6,7.00,6.75,7.80]
];
for(const [joy,budget,travel,average,joyWeighted,budgetWeighted] of expected){
  assert.equal(Number(((joy+budget+travel)/3).toFixed(2)),average);
  assert.equal(Number(((joy*2+budget+travel)/4).toFixed(2)),joyWeighted);
  assert.equal(Number(((joy+budget*3+travel)/5).toFixed(2)),budgetWeighted);
}
assert.equal(weightedAverage([9,5,8],[2,1,1]),7.75);
assert.deepEqual(rankSample([1,1,1]).map(a=>[a.index,a.rank]),[[0,1],[1,1],[2,3]]);
assert.deepEqual(rankSample([2,1,1]).map(a=>a.index),[0,1,2]);
assert.deepEqual(rankSample([1,3,1]).map(a=>a.index),[2,1,0]);
assert.throws(()=>weightedAverage([9,4,5],[1,0,1]),RangeError);
const worker=await read('worker/seo.js');
const sitemap=await staticSitemap().text();
const global=await read('cloud/global-locale.js');
assert(global.includes("'scoring-guide.html'"),'Missing language switch for scoring-guide');
assert(global.includes('data-global-guide="scoring"'),'Missing help menu scoring link');
assert(!/googletagmanager\.com|adsbygoogle\.js/i.test(global),'Guide update may not enable ads or GA4');
for(const lang of ['ja','en']){
  const path=lang+'/scoring-guide.html';
  const html=await read(path);
  const landing=await read(lang+'/index.html');
  const example=await read(lang+'/examples.html');
  assert(html.includes('<html lang="'+lang+'">'),'Incorrect document language');
  assert(html.includes('data-sm-reading-page="'+lang+'"'),'Shared reading header missing');
  assert(html.includes('<meta name="robots" content="index,follow">'),'Public guide should be indexable');
  assert(html.includes('<link rel="canonical" href="https://statsmaker.app/'+path+'">'),'Incorrect canonical');
  assert.equal((html.match(/<h1\b/g)||[]).length,1,'Expected a single H1');
  assert.equal((html.match(/<section\b/g)||[]).length,7,'Expected seven complete useful sections');
  assert.equal((html.match(/<section\b/g)||[]).length,(html.match(/<\/section>/g)||[]).length,'Unclosed section');
  assert.equal((html.match(/<table\b/g)||[]).length,3,'Expected rubric, source scores, and interactive ranking table');
  assert(html.includes('id="scoringPlayground"'),'Interactive ranking must be present');
  assert.equal((html.match(/type="range"/g)||[]).length,3,'Three weighting controls required');
  assert(html.includes('aria-live="polite"'),'Accessible score result announcement required');
  assert(html.includes('/cloud/scoring-guide.mjs?v=r83p2'),'Module script not loaded');
  assert(html.includes('https://statsmaker.app/ja/scoring-guide.html'));
  assert(html.includes('https://statsmaker.app/en/scoring-guide.html'));
  assert(html.includes('7.75')&&html.includes('7.25')&&html.includes('7.80'),'Weighted scores missing');
  for(const slug of ['examples.html','png-guide.html','chart-guide.html','legal.html']){
    assert(html.includes('/'+lang+'/'+slug),'Missing user-facing reading or contact link: '+slug);
  }
  assert(landing.includes('href="/'+lang+'/scoring-guide.html"'),'Landing has no relevant guide link');
  assert(example.includes('href="/'+lang+'/scoring-guide.html"'),'Examples have no relevant guide link');
  assert(sitemap.includes('https://statsmaker.app/'+path),'Guide missing from search sitemap');
  assert(worker.includes("'"+'/'+lang+'/scoring-guide.html'+"'"),'Work sitemap code omits guide');
  assert(!/adsbygoogle\.js|googletagmanager\.com|google-analytics\.com|service_role|sb_secret_/i.test(html),'Unexpected ad, tracking, or private key');
}
const moduleCode=await read('cloud/scoring-guide.mjs');
assert(moduleCode.includes('export function weightedAverage'),'No reusable calculation model');
assert(!/fetch\(|localStorage|sessionStorage|XMLHttpRequest|sendBeacon|google-analytics|adsbygoogle/i.test(moduleCode),'Playground must not track or send data');
const index=await read('index.html');
const config=await read('cloud/analytics-config.js');
assert(index.includes('name="google-adsense-account"'),'Do not remove approved owner verification');
assert(!index.includes('adsbygoogle.js'),'Keep live ad delivery off until approval');
assert(config.includes('enabled:false')&&config.includes("measurementId:''"),'GA4 must stay disabled');
console.log('R83 QA PASS: two original interactive guides, ranking logic, arithmetic, JA/EN, sitemap, privacy, ad-free');
