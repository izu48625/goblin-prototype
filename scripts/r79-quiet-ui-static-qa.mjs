import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const host=await read('base/index.html');
const editor=await read('app/editor.html');
const css=await read('base/css/r79-quiet-interface.css');
const appCss=await read('app/css/r79-quiet-chrome.css');
assert(host.includes('r79-quiet-interface.css?v=r79p1'));
assert(editor.includes('r79-quiet-chrome.css?v=r79p1'));
for(const part of ['.fitTable .fitName','.overviewMetrics .overviewMetric',
  '.rankRow.top1','.rankRow.top2','.rankRow.top3',
  '.viewTab.active','#scoreColorToggleBtn','.scaleMismatchHint']){
  assert(css.includes(part),'Missing UI adjustment '+part);
}
assert(css.includes('background-color:var(--score-tile-overlay,transparent)'));
const clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/--score-tile-overlay\s*:/.test(clean),'Do not replace existing score alpha tokens');
assert(!/#scoreTable td\.scoreCell\s*\{/.test(clean),'No data grid recoloring');
assert(!/#previewRoot|\.visual[\s,{:#.]/.test(appCss.replace(/\/\*[\s\S]*?\*\//g,'')),
  'Do not change native graph artwork');
for(const id of ['overviewViewBtn','fitViewBtn','sheetViewBtn','radarTab','barTab',
  'addRowBtn','addColBtn','scoreColorToggleBtn','scoreTable','fitTable','overviewGrid']){
 assert(host.includes('id="'+id+'"'),'Original editable feature missing '+id);
}
for(const p of ['base/css/r79-quiet-interface.css','app/css/r79-quiet-chrome.css']){
 const t=(await read(p)).replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((t.match(/{/g)||[]).length,(t.match(/}/g)||[]).length,'Unbalanced styles '+p);
}
const dataJS=await read('base/js/app.js');
const scoreCss=await read('base/css/style.css');
for(const col of ['rgba(116,60,74,.42)','rgba(122,84,62,.35)',
 'rgba(110,99,57,.32)','rgba(40,89,89,.29)','rgba(39,72,103,.31)',
 'rgba(37,64,85,.24)','rgba(31,47,53,.20)']){
 assert(scoreCss.includes(col),'7-grade CSS fallback invariant '+col);
}
for(const [grade,color] of Object.entries({
 'heat-ss':'#e8b9b2','heat-s':'#edc9b9','heat-a':'#f1d9c4',
 'heat-b':'#efd2a6','heat-c':'#f8edcc','heat-d':'#e3edc9','heat-e':'#d1dce9'
})){
 assert(dataJS.includes("'"+grade+"':'"+color+"'"),'7-grade live RGB invariant '+grade);
}
assert((await read('cloud/analytics-config.js')).includes('enabled:false'));
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'));
console.log('R79 visual-only theme, grade data, privacy and chart templates PASS');
