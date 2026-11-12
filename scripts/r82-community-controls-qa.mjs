import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('base/index.html'),css=await read('base/css/r82-community-controls-guard.css');
assert(/r82-community-controls-guard\.css\?v=[a-z0-9._-]+/i.test(html),
  'Community guard stylesheet must retain a current cache revision');
assert(html.indexOf('r82-community-controls-guard.css')>html.indexOf('r81-clear-settings.css'),'Security guard must load after UI');
assert(css.includes('body.community-mode .sheetPanel .coreActions'));
assert(css.includes('body.community-mode .topbar .topActions'));
for(const k of ['#publishBtn','#newSheetBtn','#addRowBtn','#addColBtn','#r80OptionsBtn','#r80VisualsBtn'])
 assert(css.includes(k),'Community unsafe control not guarded: '+k);
assert(css.includes('display:none!important'));
assert(!css.includes('scoreInput'),'Score inputs must remain usable');
// Later light-theme palette rules intentionally style scored cells; verify
// those rules do NOT appear under the Community-specific safety guard.
const guard=css.slice(0,css.indexOf('/* R106:'));
assert(!guard.includes('scoreCell'),'Community structural guard must not touch score cells');
assert(!guard.includes('scoreInput'),'Community structural guard must not disable score inputs');
console.log('R82 Community UI safety scoped to Community only; score input preserved PASS');
