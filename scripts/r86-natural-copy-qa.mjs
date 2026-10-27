// R86: natural sample copy without claiming that tutorial ratings are verified real data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const meta=JSON.parse(await read('scripts/r84-use-cases-data.json'));
const jaPages=['ja/use-cases.html','ja/examples.html','ja/scoring-guide.html'];
const enPages=['en/use-cases.html','en/examples.html','en/scoring-guide.html'];
for(const path of [...jaPages,...enPages]){
 const html=await read(path);
 const bundled=await read('dist/'+path);
 assert.equal(html,bundled,'Cloudflare distribution page differs from source '+path);
 assert(html.includes('https://statsmaker.app/'+path),'Preserve canonical '+path);
 assert(html.includes('href="/'+path.split('/')[0]+'/legal.html#contact"'),'Keep contact link '+path);
 assert(!html.includes('架空'),'Requested Japanese adjective remains '+path);
 if(path.startsWith('en/'))assert(!/\bfictional\b|\binvented\b|\bimaginary\b|\bmade-up\b/i.test(html),
   'Repetitive imaginary wording remains '+path);
 assert(!/adsbygoogle\.js|googletagmanager\.com|service_role|sb_secret_/i.test(html),
   'Do not introduce ads, tracking, or secrets');
}
const ja=await read('ja/use-cases.html'),en=await read('en/use-cases.html');
assert(meta.cases.length===5,'Preserve five real native graphs');
for(const c of meta.cases){
 for(const [lang,html] of [['ja',ja],['en',en]]){
  assert(html.includes(c[lang].title),'Original heading out of sync '+lang+'/'+c.slug);
  assert(html.includes(c[lang].lead),'Original explanatory scenario out of sync '+lang+'/'+c.slug);
  assert(html.includes(c[lang].insight),'Original interpretation out of sync '+lang+'/'+c.slug);
  assert(html.includes(c[lang].warning),'Original data disclaimer out of sync '+lang+'/'+c.slug);
  assert(html.includes('/ja/example-images/usecase-'+c.slug+'.png'),'Original native PNG lost '+c.slug);
  assert(c.rows.every(r=>r.length===c.fields.length),'Keep source data columns aligned');
  for(const row of c.rows)for(const cell of row)assert(html.includes('>'+String(cell)+'</'),
    'Source number not visible '+lang+'/'+c.slug+'/'+cell);
 }
}
assert(/すべて説明用の創作です/.test(ja),'Keep provenance note');
assert(/実際の店舗や味覚調査ではありません/.test(ja),'Do not represent invented reviews as real');
assert(/実測値ではありません/.test(ja),'Do not misrepresent studies as measurements');
assert(/All scores here are prepared for demonstration/.test(en),'English provenance');
assert(/not sales, reviews, or real café data/.test(en),'English real world disclaimer');
console.log('R86 PASS: natural bilingual sample copy, no imaginary adjective, native PNGs and numbers preserved, honest provenance');
