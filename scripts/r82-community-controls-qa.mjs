import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('base/index.html'),css=await read('base/css/r82-community-controls-guard.css');
assert(html.includes('r82-community-controls-guard.css?v=r82c1'));
assert(html.indexOf('r82-community-controls-guard.css')>html.indexOf('r81-clear-settings.css'),'Security guard must load after UI');
assert(css.includes('body.community-mode .sheetPanel .coreActions'));
assert(css.includes('body.community-mode .topbar .topActions'));
for(const k of ['#publishBtn','#newSheetBtn','#addRowBtn','#addColBtn','#r80OptionsBtn','#r80VisualsBtn'])
 assert(css.includes(k),'Community unsafe control not guarded: '+k);
assert(css.includes('display:none!important'));
assert(!css.includes('scoreInput'),'Score inputs must remain usable');
assert(!css.includes('scoreCell'),'Grade cells must not be changed');
console.log('R82 Community UI safety scoped to Community only; score input preserved PASS');
