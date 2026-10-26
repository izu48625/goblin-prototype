import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {staticSitemap} from '../worker/seo.js';
const read=p=>readFile(new URL('../'+p,import.meta.url));
const txt=async p=>(await read(p)).toString('utf8');
const meta=JSON.parse(await txt('scripts/r84-use-cases-data.json'));
const slugs=['cafe','routes','study','plan','hero'];
const expectedTypes=['bar','quadrant','image-line','range','stat-card'];
assert.deepEqual(meta.cases.map(x=>x.slug),slugs);
assert.deepEqual(meta.cases.map(x=>x.type),expectedTypes);
for(const c of meta.cases){
 assert(c.rows.length>=4,'Need meaningful source rows '+c.slug);
 assert(c.rows.every(row=>row.length===c.fields.length),'Incomplete source score row '+c.slug);
 assert(c.rows.every(row=>row.slice(1).every(n=>typeof n==='number'&&n>=0&&n<=100)),'Invalid score '+c.slug);
 const path='ja/example-images/usecase-'+c.slug+'.png';
 const raw=await read(path), bundled=await read('dist/'+path);
 assert(raw.length>5000&&raw.length<2000000,'Native PNG unexpectedly small or huge: '+path);
 assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG signature');
 assert.equal(raw.readUInt32BE(16),c.width,'Incorrect native width: '+path);
 assert.equal(raw.readUInt32BE(20),c.height,'Incorrect native height: '+path);
 assert(raw.equals(bundled),'Cloudflare build did not copy native image '+path);
}
const siteMap=await staticSitemap().text();
const common=await txt('cloud/global-locale.js');
assert(common.includes("'use-cases.html'"),'Bilingual page switching missing');
assert(common.includes('data-global-guide="usecases"'),'Shared guide nav missing');
for(const lang of ['ja','en']){
 const path=lang+'/use-cases.html',html=await txt(path),bundled=await txt('dist/'+path);
 assert.equal(bundled,html,'Cloudflare page differs from authored '+path);
 assert(html.includes('<html lang="'+lang+'">'));
 assert(html.includes('data-sm-reading-page="'+lang+'"'),'Shared reader nav not loaded');
 assert(html.includes('<meta name="robots" content="index,follow">'));
 assert(html.includes('<link rel="canonical" href="https://statsmaker.app/'+path+'">'));
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.equal((html.match(/class="case"/g)||[]).length,5,'Expected exactly five independent applications');
 assert.equal((html.match(/<img /g)||[]).length,5,'Need actual rendered PNGs');
 assert(html.includes('hreflang="ja"')&&html.includes('hreflang="en"'));
 for(const c of meta.cases){
  assert(html.includes('id="'+c.slug+'"'),'Missing scenario '+c.slug);
  assert(html.includes('src="/ja/example-images/usecase-'+c.slug+'.png"'));
  assert(html.includes(c[lang].title),'Wrong localized scenario title');
  assert(html.includes(c[lang].insight),'Explain results, not just sample picture');
  for(const row of c.rows)for(const val of row)assert(html.includes('>'+String(val)+'</'),'Source table must expose score '+val+' for '+c.slug);
 }
 assert(html.includes('/index.html?lang='+lang));
 assert(html.includes('/'+lang+'/legal.html#contact'));
 assert(html.includes('/'+lang+'/scoring-guide.html'));
 assert((await txt(lang+'/index.html')).includes('/'+lang+'/use-cases.html'));
 assert((await txt(lang+'/examples.html')).includes('/'+lang+'/use-cases.html'));
 assert(siteMap.includes('<loc>https://statsmaker.app/'+path+'</loc>'),'Missing public sitemap '+path);
 assert(!/adsbygoogle\.js|googletagmanager\.com|google-analytics\.com|service_role|sb_secret_/i.test(html),'No ads, analytics or internal DB credentials');
}
const config=await txt('cloud/analytics-config.js');
assert(config.includes('enabled:false'),'Do not enable GA4');
const home=await txt('index.html');
assert(!home.includes('adsbygoogle.js'),'No ads before AdSense review');
console.log('R84 PASS: five native Canvas PNGs, five use cases, two content-rich localizations, unaltered user data and privacy');
