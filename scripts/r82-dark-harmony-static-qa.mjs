import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const css=await read('cloud/r82-dark-harmony.css');
const globals=await read('cloud/global-locale.js');
assert(globals.includes('/cloud/r82-dark-harmony.css?v=r82p1'));
assert(globals.indexOf("link.dataset.smThemeHarmony='r82'")>globals.indexOf("link.dataset.smThemeStyle='r81'"));
assert(globals.includes("dark?'☼':'☾'"),'Theme icon must not use emoji sun');
for(const selector of [
 '#scoreTable thead :is(th,.metricHead',
 '#scoreTable .headerSortRow',
 '#scoreTable .headerSortBtn',
 '#scoreTable .metricHeaderInput:focus',
 '#scoreTable .thumbBtn',
 '#scoreTable .scoreInput::placeholder',
 '#scoreTable .nameInput::placeholder',
 '#scoreTable tbody td.scoreCell:not(.heat-e)',
 'body.score-colors-off:has(#scoreTable)',
 '.fitTable th,.fitTable thead th'
]) assert(css.includes(selector),'Missing targeted harmony patch '+selector);
assert(css.includes('html[data-sm-theme="dark"]'));
const stripped=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert.equal((stripped.match(/{/g)||[]).length,(stripped.match(/}/g)||[]).length,'CSS block mismatch');
assert(!stripped.includes('--score-tile-overlay:'),'Never change grade-color values');
assert(!stripped.includes('style.background'),'Never alter project color');
assert(!stripped.includes('#previewRoot'),'Do not target rendered chart artwork');
assert(!stripped.includes('body.r73-light-page'),'Only fix scoring screen');
assert((await read('cloud/analytics-config.js')).includes('enabled:false'));
console.log('R82 strict dark scope, palette harmony, RGBA/export privacy static QA PASS');
