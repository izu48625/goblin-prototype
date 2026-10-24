import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const host=await read('index.html');
const page=await read('app/editor.html');
assert(host.includes('cloud/r77-launcher.css?v=r77p1'));
assert(page.includes('css/r77-light-editor.css?v=r77p1'));
assert(page.includes('content="#f6f5f1"'));
assert(page.includes('id="previewRoot"')&&page.includes('id="canvasShell"'));
assert(page.includes('id="mobilePanelContent"')&&page.includes('id="exportBtn"'));
const css=await read('app/css/r77-light-editor.css');
assert(css.includes('--bg:#f6f5f1'));
assert(css.includes('body.editor-body .globalLocaleBar'));
for(const x of ['.editor-header','.mobile-bottom-tabs','.mobile-sheet',
 '.editor-sidebar','.preview-area','.preview-toolbar','.panel-tab.active',
 '.data-row','.field label','.input,.select,.textarea']){
 assert(css.includes(x),'Missing critical light editor surface '+x);
}
const noComments=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/#previewRoot\s*[,{:]/.test(noComments),'Rendered chart container must remain original');
assert(!/\.visual\s*[,{:]/.test(noComments),'Native graph visual styles must remain original');
const launcher=await read('cloud/r77-launcher.css');
assert(launcher.includes('width:min(202px,calc(100vw - 24px))'));
assert(launcher.includes('min-height:48px;height:48px'));
assert(!launcher.replace(/\/\*[\s\S]*?\*\//g,'').includes('#basicRoot'),
 'Do not resize iframe/touch scroll');
assert((await read('app/src/launcher.js')).includes('openExtension(type)'),'Launcher still binds creation');
assert((await read('app/src/editor/editor.js')).includes('getVisualization'),'Native canvas renderer retained');
for(const textCSS of [css,launcher]){
 const c=textCSS.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((c.match(/{/g)||[]).length,(c.match(/}/g)||[]).length);
}
assert((await read('cloud/analytics-config.js')).includes('enabled:false'));
assert((await read('cloud/ad-layout.js')).includes('if(!requestedPreview())return'));
console.log('R77 white extension editor and compact launcher, chart isolation/privacy PASS');
