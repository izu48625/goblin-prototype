import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const common=await read('cloud/global-locale.js');
assert(common.includes('const readingLang=()'));
assert(common.includes('readingLang()&&articleName()'));
assert(common.includes('readingLang()?\'/index.html?lang=\''));
for(const lang of ['ja','en']){
 for(const file of ['chart-guide.html','png-guide.html','examples.html']){
  const name=lang+'/'+file;
  const html=await read(name);
  assert(html.includes('data-sm-reading-page="'+lang+'"'),'article language marker '+name);
  assert(html.includes('global-locale.css?v=r74p1'),'shared nav styles '+name);
  assert(html.includes('global-locale.js?v=r74p1'),'shared nav script '+name);
  assert(html.includes('r73-reading.css?v=r74p1'),'shared reading cache '+name);
  assert(!/<header>[\s\S]*?<\/header>/.test(html),'Duplicate custom article header '+name);
  assert(html.includes('<main>')&&html.includes('</main>'),'Article must preserve content '+name);
  assert(html.includes('rel="canonical"'),'Canonical article source '+name);
  assert(html.includes('hreflang="ja"')&&html.includes('hreflang="en"'),'Bilingual discovery '+name);
 }
}
const basic=await read('base/index.html');
assert(basic.includes('r74-score-harmony.css?v=r74p1'));
const css=await read('base/css/r74-score-harmony.css');
for(const selector of ['#addRowBtn','#addColBtn','#currentScaleBadge','#scoreColorToggleBtn','#searchInput.searchInput']){
 assert(css.includes(selector),'Missing restyle '+selector);
}
assert(!/--score-tile-overlay\s*:/.test(css),'Never mutate screenshot-approved RGBA layers');
assert(!/#scoreTable td\.scoreCell[^,{]*\s*\{/.test(css),'Must not recolor cells');
assert(!/#scoreTable td\.avgCell[^,{]*\s*\{/.test(css),'Must not recolor averages');
const lock=await read('base/css/style.css');
assert(lock.includes('background-color:#101b30'),'Original score backing must remain');
const reading=await read('cloud/r73-reading.css');
assert(reading.includes('body.r73-reading .globalLocaleBar .globalNavLinks'));
assert(reading.includes('flex-wrap:nowrap'));
for(const file of ['cloud/r73-reading.css','base/css/r74-score-harmony.css']){
 const t=(await read(file)).replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((t.match(/{/g)||[]).length,(t.match(/}/g)||[]).length,'Unbalanced CSS '+file);
}
const ga=await read('cloud/analytics-config.js');
assert(ga.includes('enabled:false'),'GA4 stays off');
console.log('R74 header/score/static privacy and art integrity PASS');
