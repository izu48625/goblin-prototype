import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const path=p=>new URL('../'+p,import.meta.url);
const read=p=>readFile(path(p),'utf8');
const html=await read('base/index.html'),host=await read('index.html'),js=await read('base/js/r80-scoring-first.js');
const css=await read('base/css/r80-scoring-first.css'),hostCss=await read('cloud/r80-no-sticky-launcher.css');
assert(html.includes('r80-scoring-first.css?v=r80p1'));
assert(html.includes('r80-scoring-first.js?v=r80p1'));
assert(host.includes('r80-no-sticky-launcher.css?v=r80p1'));
for(const id of ['mobileHeaderMoreBtn','r80PublishAction','r80NewAction',
 'newSheetBtn','publishBtn','r80SearchBtn','r80OptionsBtn','r80VisualsBtn',
 'r80ScaleAction','r80ColorAction','r80MoreAction','scoreSettingsBtn',
 'scoreColorToggleBtn','moreToolsBtn','searchInput','scoreTable']){
  assert(html.includes('id="'+id+'"'),'Missing control '+id);
}
assert(js.includes("$('publishBtn')?.click()")&&js.includes("$('newSheetBtn')?.click()"));
assert(js.includes("window.parent.postMessage({type:'statsmaker:open-extensions'},location.origin)"));
const launcher=await read('app/src/launcher.js');
assert(launcher.includes('event.origin!==location.origin||event.source!==frame.contentWindow'),
 'Visuals bridge cannot accept other-origin messages');
const p=await read('app/src/core/project.js');
assert(p.includes('theme:"light"')&&p.includes('background:THEMES.light.bg'));
assert(p.includes('template:"minimal"'));
assert(p.includes('const th=THEMES[themeId]||THEMES.dark'),'Existing template selections preserved');
assert((await read('app/src/core/store.js')).includes('structuredClone(project)'),'Existing project state retained');
const x=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/--score-tile-overlay\s*:/.test(x),'No grading UI changes');
assert(!/#scoreTable td\.[\w-]+\s*\{/.test(x),'Data cells must be untouched');
for(const c of [css,hostCss]){
  const clean=c.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.equal((clean.match(/{/g)||[]).length,(clean.match(/}/g)||[]).length);
}
assert((await read('cloud/analytics-config.js')).includes('enabled:false'));
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'));
console.log('R80 mobile progressive disclosure / secure iframe / new light projects / privacy PASS');
