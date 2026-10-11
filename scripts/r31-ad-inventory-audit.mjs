import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const pages=['base/index.html','app/editor.html','discover.html','public.html','my.html','rate.html'];
for(const p of pages){
  const s=await readFile(new URL('../'+p,import.meta.url),'utf8');
  const prefix=p.startsWith('base/')||p.startsWith('app/')?'../':'';
  assert(s.includes(prefix+'cloud/ad-layout.js?v=r31ad3'),p+' lacks ad preview script');
  assert(s.includes(prefix+'cloud/ad-layout.css?v=r31ad3'),p+' lacks ad preview stylesheet');
  assert(s.includes('data-sm-ad-page='),p+' lacks explicit ad page marker');
  assert(!/adsbygoogle|googlesyndication|doubleclick|data-ad-client/i.test(s),
    p+' unexpectedly embeds a real ad vendor');
}
const controller=await readFile(new URL('../cloud/ad-layout.js',import.meta.url),'utf8');
assert(controller.includes('adPreview'));
assert(controller.includes('dataset.smAdPage'),'Layout detection must survive URL rewrites');
assert(controller.includes('if(!requestedPreview())return'));
assert(!/adsbygoogle|googlesyndication|doubleclick|fetch\(/i.test(controller),
  'Preview controller must never serve or request ads');
const doc=await readFile(new URL('../ADS_INVENTORY_R31.md',import.meta.url),'utf8');
assert(doc.includes('全ての主要画面'));
console.log('R31 ad inventory static audit PASS: six route families, no provider or cost');
