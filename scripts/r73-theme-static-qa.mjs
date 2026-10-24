import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

const nav=await read('cloud/global-locale.css');
assert(nav.includes('/* R73: the same navigation semantics'));
assert(nav.includes('body.r73-light-page .globalLocaleBar .globalSupportPanel a'));
assert(nav.includes('color:#292e33'));
assert(nav.includes('--sm-nav-bg:#fff'));
assert(nav.includes('--sm-nav-panel:#303436'));
const landing=await read('cloud/r72-site.css');
assert(landing.includes('.r73MoreLinks'));
assert(landing.includes('#b64d35'),'Primary CTA contrast must be increased');

for(const lang of ['ja','en']){
  const page=await read(lang+'/index.html');
  assert(page.includes('class="r73-light-page" data-sm-localized-landing="'+lang+'"'));
  assert(page.includes('r72-site.css?v=r73p1'));
  assert(page.includes('global-locale.css?v=r73p1'));
  assert(page.includes('class="r73MoreLinks"'));
  assert(page.indexOf('r73MoreLinks')>page.indexOf('id="visual-examples"'));
  assert(page.includes('id="visual-examples"')&&page.includes('id="rating-guide"'));
  assert(!page.includes('adsbygoogle.js'));
  for(const suffix of ['legal.html','chart-guide.html','png-guide.html','examples.html']){
    const file=await read(lang+'/'+suffix);
    assert(/r73-reading\.css\?v=r(?:73|74)p1/.test(file),'Light reading stylesheet missing on '+lang+'/'+suffix);
    assert(file.includes('r73-reading'),'Page not tagged '+lang+'/'+suffix);
    assert(file.includes('content="#f6f5f1"'),'iPhone theme color not neutral '+suffix);
    assert(!file.includes('adsbygoogle.js'));
    if(suffix==='legal.html'){
      assert(file.includes('id="contact"')&&file.includes('id="privacy"'));
      assert(file.includes('legal-contact.js'));
    }
  }
}
const readCSS=await read('cloud/r73-reading.css');
assert(readCSS.includes('body.r73-reading[data-sm-legal-page] .contactForm'));
assert(readCSS.includes('background:#fff'));
const discover=await read('discover.html');
assert(discover.includes('class="r73-light-page"'));
assert(discover.includes('r72-discover.css?v=r72p1'));
assert(discover.includes('global-locale.css?v=r73p1'));
const home=await read('index.html');
const editor=await read('base/index.html');
const fullEditor=await read('app/editor.html');
assert(home.includes('id="basicRoot"')&&home.includes('id="extLauncher"'));
assert(editor.includes('r72-editor.css?v=r72p1'));
assert(editor.includes('r73-editor-colors.css?v=r73p1'));
assert(editor.includes('id="titleInput"')&&editor.includes('id="scoreTable"'));
assert(fullEditor.includes('css/r73-editor-chrome.css?v=r73p1'));
for(const key of ['.preview-area','.editor-sidebar','.mobile-bottom-tabs']){
 assert((await read('app/css/r73-editor-chrome.css')).includes(key));
}
const basicTheme=await read('base/css/r73-editor-colors.css');
assert(!basicTheme.includes('--score-tile-overlay:'),'Must NOT rewrite heat colors');
assert(!basicTheme.includes('.heat-s'),'Must NOT rewrite heat class palette');
assert((await read('base/js/app.js')).includes('scoreTileColor(v)'),'Score color logic retained');
assert((await read('base/css/style.css')).includes('#scoreTable td.scoreCell'),'Heat CSS base contract retained');
assert((await read('cloud/analytics-config.js')).includes('enabled:false'));
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'));
for(const cssPath of ['cloud/global-locale.css','cloud/r73-reading.css','base/css/r73-editor-colors.css','app/css/r73-editor-chrome.css']){
 const css=await read(cssPath);
 const noComments=css.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((noComments.match(/{/g)||[]).length,(noComments.match(/}/g)||[]).length,'Mismatched braces '+cssPath);
}
console.log('R73 neutral theme, docs, menu contrast sources, mobile shell, privacy PASS');
