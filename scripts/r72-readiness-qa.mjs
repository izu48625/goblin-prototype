import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const code=await read('scripts/build-cloudflare.mjs');
const ads=await read('ads.txt');
const owner='ca-pub-2734957009365610';
assert.equal(ads.trim(),'google.com, pub-2734957009365610, DIRECT, f08c47fec0942fa0');
assert(code.includes("'ads.txt'"),'Static build must ship ads.txt');
for(const lang of ['ja','en']){
  const page=await read(lang+'/index.html');
  assert(page.includes('name="google-adsense-account" content="'+owner+'"'));
  assert(page.includes('r72-site.css?v=r72p1'));
  assert(page.includes('class="r72PageNav"'));
  for(const link of ['/index.html?lang='+lang,'/discover.html?lang='+lang,
    '/'+lang+'/examples.html','/'+lang+'/chart-guide.html','/'+lang+'/legal.html#contact']){
    assert(page.includes(link),'Visible bilingual link missing: '+link);
  }
  for(const guide of ['id="rating-guide"','id="png-guide"','id="visual-examples"','id="r71CategoryHeading"']){
    assert(page.includes(guide),'Retain original substantial content: '+guide);
  }
  assert(!page.includes('adsbygoogle.js'),'Do not activate unapproved ads');
}
const css=await read('cloud/r72-site.css');
assert(css.includes('body[data-sm-localized-landing]'));
assert(css.includes('.r72PageNav'));
assert(css.includes('.r71ShowcaseCard img'));
const discover=await read('discover.html');
assert(discover.includes('r72-discover.css?v=r72p1'));
assert(discover.includes('r71p1'),'Keep privacy-checked Discover logic');
const dc=await read('cloud/r72-discover.css');
assert(dc.includes('.workMainLink .workVisual')&&dc.includes('.visualCategory-manga_anime'));
const home=await read('index.html');
const editor=await read('base/index.html');
assert(home.includes('cloud/r72-host.css?v=r72p1'));
assert(editor.includes('css/r72-editor.css?v=r72p1'));
assert(home.includes('id="basicRoot"')&&home.includes('id="extLauncher"'));
assert(editor.includes('id="titleInput"')&&editor.includes('id="sheetSelect"'));
assert(!(await read('cloud/analytics-config.js')).includes('enabled:true'));
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'));
for(const file of ['cloud/r72-site.css','cloud/r72-discover.css','cloud/r72-host.css','base/css/r72-editor.css']){
 const text=await read(file);
 // Count braces outside comments: all R72 stylesheet rules must close.
 const noComments=text.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((noComments.match(/{/g)||[]).length,(noComments.match(/}/g)||[]).length,'CSS braces: '+file);
}
try{
 const dist=await stat(new URL('../dist/ads.txt',import.meta.url));
 assert(dist.isFile(),'Bundled ads.txt is a file');
 assert.equal((await read('dist/ads.txt')).trim(),ads.trim(),'Bundle preserves AdSense authorization');
}catch(error){if(error.code!=='ENOENT')throw error}
console.log('R72 brand + AdSense static readiness PASS');
