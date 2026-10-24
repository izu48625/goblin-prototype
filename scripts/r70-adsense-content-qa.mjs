import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {staticSitemap} from '../worker/seo.js';

const read=path=>readFile(new URL('../'+path,import.meta.url));
const text=async p=>(await read(p)).toString('utf8');
const files=['sample-radar.png','sample-ranking.png','sample-tier.png'];
for(const name of files){
  const src=await read('ja/example-images/'+name);
  const dist=await read('dist/ja/example-images/'+name);
  assert(src.length>5000&&src.length<1500000,'Image must be meaningful and modest in size: '+name);
  assert.equal(src.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Native PNG signature '+name);
  assert.equal(src.readUInt32BE(16),1080,'Expected 1080px native PNG width '+name);
  assert.equal(src.readUInt32BE(20),1080,'Expected 1080px native PNG height '+name);
  assert(src.equals(dist),'Bundled Cloudflare PNG differs from source '+name);
}
for(const lang of ['ja','en']){
  const p=lang+'/examples.html';
  const html=await text(p);
  const bundled=await text('dist/'+p);
  assert.equal(bundled,html,'Cloudflare static page differs from source');
  assert(html.includes('<html lang="'+lang+'">'),'Correct page language');
  assert(html.includes('<meta name="robots" content="index,follow">'));
  assert(html.includes('https://statsmaker.app/'+p),'Exact canonical');
  assert.equal((html.match(/<h1\b/g)||[]).length,1,'One H1');
  assert((html.match(/<section\b/g)||[]).length>=5,'Meaningful unique content');
  assert(html.length>=7000,'Non-thin example guide');
  for(const l of ['ja','en']) assert(html.includes('hreflang="'+l+'" href="https://statsmaker.app/'+l+'/examples.html"'),'Localized hreflang '+l);
  for(const name of files){
    const link='/ja/example-images/'+name;
    assert(html.includes('src="'+link+'"'),'Actual visual '+link);
  }
  assert((html.match(/<img\b/g)||[]).length===3,'All three actual charts must be shown');
  for(const m of html.matchAll(/<img\b[^>]+>/g))
    assert(/\balt="[^"]{12,}"/.test(m[0]),'Every real chart has meaningful alternative text');
  for(const mark of ['92.5','83.75','77.5','75','60','47.5'])
    assert(html.includes(mark),'Demo average missing: '+mark);
  for(const href of ['/index.html?lang='+lang,'/'+lang+'/chart-guide.html','/'+lang+'/png-guide.html',
                     '/'+lang+'/legal.html#privacy','/'+lang+'/legal.html#contact'])
    assert(html.includes('href="'+href+'"'),'Expected existing navigation '+href);
  assert(!/adsbygoogle\.js|googletagmanager\.com|google-analytics\.com|service_role|sb_secret_/i.test(html),
    'No ads, analytics, or internal secret in content page');
  for(const dest of [lang+'/index.html',lang+'/chart-guide.html',lang+'/png-guide.html']){
    const s=await text(dest);
    assert(s.includes('/'+lang+'/examples.html'),
      'Need to discover examples from existing content '+dest);
  }
  for(const slug of ['example-radar','example-ranking','example-tier']){
    assert(!html.includes('src="/ja/example-images/'+slug+'.jpg"'),'No misnamed image file');
  }
}
const root=await text('index.html');
const launcher=await text('app/src/launcher.js');
const global=await text('cloud/global-locale.js');
assert(root.includes('id="extExamplesLink" href="/ja/examples.html"'),'Need minimal root link');
assert(launcher.includes('"/en/examples.html"')&&launcher.includes('"/ja/examples.html"'),'Root link follows language');
assert(global.includes('data-global-guide="examples"'),'Global help link missing');
assert(global.includes("examples.html"),'Global help localization missing');
const sitemap=await staticSitemap().text();
for(const lang of ['ja','en'])
  assert(sitemap.includes('<loc>https://statsmaker.app/'+lang+'/examples.html</loc>'),
    'New example page not indexed through sitemap');
for(const word of ['/private','/unlisted','/my.html'])
  assert(!sitemap.includes(word),'Never index private pages');
const ad=await text('cloud/analytics-config.js');
assert(ad.includes('enabled:false')&&ad.includes("measurementId:''"),'GA4 changed from opt-out');
assert(root.includes('<meta name="google-adsense-account" content="ca-pub-2734957009365610">'),
  'Owner verification tag lost');
assert(!root.includes('adsbygoogle.js'),'Do not enable production ads during review');
console.log('R70 AdSense content QA PASS: native 1080x1080 PNGs, two meaningful static guides, locale navigation, sitemap, non-invasive UI, no extra ads');
