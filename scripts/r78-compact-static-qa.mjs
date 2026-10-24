import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('base/index.html');
const css=await read('base/css/r78-compact-header.css');
assert(html.includes('css/r78-compact-header.css?v=r78p1'));
for(const id of ['titleInput','descInput','sheetSelect','publishBtn','newSheetBtn',
 'mobileHeaderMoreBtn','mobileHeaderMoreMenu','scoreTable','addRowBtn','scoreColorToggleBtn']){
 assert(html.includes('id="'+id+'"'),'Existing control missing '+id);
}
assert(css.includes('@media (max-width:760px)'));
assert(css.includes('>.titleHeading')&&css.includes('>.descriptionGroup')&&css.includes('>.savedSheetGroup'));
assert(html.includes('class="titleHeading"')&&html.includes('class="descriptionGroup"')&&html.includes('class="savedSheetGroup"'));
assert(!css.includes('display:contents'));
assert(css.includes('grid-column:1 / -1'));
assert(css.includes('grid-column:2'));
assert(css.includes('font-size:16px'));
assert(css.includes('min-height:44px'));
assert(!/--score-tile-overlay\s*:/.test(css),'Graded scoring RGBA changed');
assert(!/\.scoreCell\s*[{,]/.test(css),'Score cells restyled by header update');
assert(!/\.visual\s*[{,]/.test(css),'Exported chart templates restyled by header update');
const stripped=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert.equal((stripped.match(/{/g)||[]).length,(stripped.match(/}/g)||[]).length);
assert((await read('cloud/analytics-config.js')).includes('enabled:false'));
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'));
console.log('R78 no hidden controls, no data/score/color/ads regressions PASS');
