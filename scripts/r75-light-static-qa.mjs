import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const host=await read('index.html');
const base=await read('base/index.html');
assert(host.includes('r75-light-host.css?v=r75p1'));
assert(base.includes('r75-light-editor.css?v=r75p1'));
assert(host.includes('content="#f6f5f1"')&&base.includes('content="#f6f5f1"'));
assert(host.includes('id="basicRoot"')&&host.includes('id="basicFrame"'));
assert(base.includes('id="scoreTable"')&&base.includes('id="addRowBtn"'));
const css=await read('base/css/r75-light-editor.css');
const shell=await read('cloud/r75-light-host.css');
assert(css.includes('--bg:#f6f5f1'));
assert(css.includes('background-color:var(--score-tile-overlay,transparent)'));
assert(css.includes('body.score-colors-off #scoreTable td.scoreCell'));
assert(css.includes('background-color:#fff!important;'));
for(const key of ['#scoreTable tbody tr:nth-child(even)','color-scheme:light','#searchInput','#currentScaleBadge','#scoreColorToggleBtn','.publishDialog','.weightDialog']){
 assert(css.includes(key),'Incomplete score light style: '+key);
}
assert(shell.includes('body.homeHost .globalLocaleBar')&&shell.includes('#extSheet'));
assert(shell.includes('background:#fff;color:#292e33'));
const colorJS=await read('base/js/app.js');
for(const rgba of [
 'rgba(116,60,74,.42)','rgba(122,84,62,.35)','rgba(110,99,57,.32)',
 'rgba(40,89,89,.29)','rgba(39,72,103,.31)','rgba(37,64,85,.24)','rgba(31,47,53,.20)'
])assert(colorJS.includes(rgba),'Grade RGBA regression: '+rgba);
const baseCss=await read('base/css/style.css');
assert(baseCss.includes('background-color:var(--score-tile-overlay, transparent)'));
assert(!(await read('cloud/analytics-config.js')).includes('enabled:true'));
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'));
for(const name of ['base/css/r75-light-editor.css','cloud/r75-light-host.css']){
 const s=(await read(name)).replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length,'Mismatched CSS blocks '+name);
}
console.log('R75 light editor, original score RGBA, zero analytics or ads PASS');
