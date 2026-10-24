import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('base/index.html');
const js=await read('base/js/r80-scoring-first.js');
const css=await read('base/css/r81-clear-settings.css');
const common=await read('cloud/global-locale.js');
const themeCss=await read('cloud/r81-theme.css');
const editor=await read('app/editor.html');
for(const id of ['publishBtn','newSheetBtn','r81ThemeBtn','r80OptionsBtn','r80VisualsBtn','r80ScaleAction','r80ColorAction','r81SearchAction','r81SearchClose','r81OptionsClose']){
 assert(html.includes('id="'+id+'"'),'Missing original/new control '+id);
}
assert(!html.includes('id="r80SearchBtn"'),'Magnifier must not be a visible toolbar button');
assert(!html.includes('id="r80PublishAction"'),'Publish cannot be buried in More');
assert(!html.includes('id="r80NewAction"'),'New cannot be buried in More');
assert(css.includes('.sheetPanel .sheetToolbar{')&&css.includes('display:block!important'),'Settings panel remains squeezed by flex');
assert(css.includes('grid-template-columns:minmax(0,1fr)!important'),'Settings must use full width');
assert(css.includes('.sheetPanel .r81-options-head'),'Settings must have clearly labelled header');
assert(js.includes("$('scoreSettingsBtn')?.click()")&&js.includes("$('scoreColorToggleBtn')?.click()"));
assert(js.includes("window.parent.postMessage({type:'statsmaker:open-extensions'},location.origin)"));
assert(common.includes("statsMaker.uiTheme")&&common.includes("localStorage.setItem(THEME_KEY,mode)"));
assert(common.includes("window.addEventListener('storage'"));
assert(common.includes("window.SM_THEME="));
assert(common.includes('[data-sm-theme-toggle]'));
assert(editor.includes('id="r81EditorTheme"'));
assert(themeCss.includes('html[data-sm-theme=dark]')&&!themeCss.includes('#previewRoot .visual'));
const body=themeCss.replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/--score-tile-overlay\s*:/.test(body),'Theme must not replace score grade RGBA');
for(const [file,s] of [['base/css/r81-clear-settings.css',css],['cloud/r81-theme.css',themeCss]]){
 const clean=s.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((clean.match(/{/g)||[]).length,(clean.match(/}/g)||[]).length,'CSS brackets '+file);
}
assert((await read('cloud/analytics-config.js')).includes('enabled:false'));
console.log('R81 structural, grade preservation, local-only preference, UI mode QA PASS');
