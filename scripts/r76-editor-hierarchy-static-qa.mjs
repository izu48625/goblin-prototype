import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

const host=await read('index.html');
const base=await read('base/index.html');
assert(host.includes('cloud/r76-launcher.css?v=r76p1'));
assert(base.includes('css/r76-editor-hierarchy.css?v=r76p1'));
assert(host.includes('id="basicFrame"')&&host.includes('id="extLauncher"'));
for(const id of ['sheetViewBtn','overviewViewBtn','fitViewBtn','addRowBtn','addColBtn',
 'scoreSettingsBtn','currentScaleBadge','moreToolsBtn','searchInput','scoreTable',
 'scoreColorToggleBtn','scoreSettingsPanel','utilityBar']){
 assert(base.includes('id="'+id+'"'),'Existing working editor control missing: '+id);
}
const editor=await read('base/css/r76-editor-hierarchy.css');
for(const selector of ['.topbar.panel','.sheetPanel.panel','.modeStrip',
 '.coreActions #addRowBtn','#currentScaleBadge','.sheetPanel .filterBar',
 '#scoreTable .headerSortRow','#scoreTable .metricHeaderInput',
 '#scoreTable .headerSortBtn','#scoreTable :is(.nameCell,.indexCell)']){
 assert(editor.includes(selector),'R76 visual hierarchy incomplete: '+selector);
}
assert(editor.includes('background:#f0eee9'),'Sort header must be light');
assert(editor.includes('border:0;')&&editor.includes('border-top:1px solid var(--r76-rule)'));
assert(!/--score-tile-overlay\s*:/.test(editor),'Scoring alpha overlays must not be modified');
assert(!/#scoreTable td\.scoreCell\s*[{,]/.test(editor),'Do not overwrite graded score cells');
assert(!/#scoreTable td\.avgCell\s*[{,]/.test(editor),'Do not overwrite averaged cells');
const launcher=await read('cloud/r76-launcher.css');
assert(launcher.includes('height:48px')&&launcher.includes('min-height:48px'),
 'Compact launcher must preserve at least 44px tap surface');
assert(!/(?:^|\n)\s*#basicRoot\s*\{/m.test(launcher.replace(/\/\*[\s\S]*?\*\//g,'')),'Do not change iframe viewport reservation');
const original=await read('base/js/app.js');
for(const color of ['rgba(116,60,74,.42)','rgba(122,84,62,.35)','rgba(110,99,57,.32)']){
 assert(original.includes(color),'Scoring grade palette changed: '+color);
}
for(const path of ['base/css/r76-editor-hierarchy.css','cloud/r76-launcher.css']){
 const styles=(await read(path)).replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((styles.match(/{/g)||[]).length,(styles.match(/}/g)||[]).length,'Unbalanced CSS '+path);
}
assert((await read('cloud/analytics-config.js')).includes('enabled:false'),'GA4 must remain off');
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'),'Real ads disabled');
console.log('R76 light hierarchy CSS, existing button/score/privacy contracts PASS');
