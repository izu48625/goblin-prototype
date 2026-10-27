import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=JSON.parse(await read('scripts/r84-use-cases-data.json')).cases;
const presets=JSON.parse(await read('cloud/r89-usecase-presets.json')).cases;
assert.equal(source.length,5);assert.equal(presets.length,5);
for(const [i,x] of source.entries()){
 const p=presets[i];
 for(const k of ['slug','type','theme','width','height','title','subtitle'])assert.deepEqual(p[k],x[k],k+' mismatch '+x.slug);
 assert.deepEqual(p.rows,x.rows,x.slug+' differs from PNG');
 assert.deepEqual(p.fields,x.fields,x.slug+' labels differ');
 assert.equal(p.ja.title,x.ja.title);assert.equal(p.en.title,x.en.title);
}
const root=await read('index.html'),launcher=await read('app/src/launcher.js'),css=await read('cloud/r89-home-intro.css'),js=await read('cloud/r89-home-intro.js');
assert(root.includes('id="r89HomeIntro"'));assert(root.includes('<div id="basicRoot"><iframe'), 'instant editor removed');
assert(root.includes('id="r87HomeGuide"'));assert(root.includes('r89-home-intro.js?v=r89p1'));
assert(css.includes('body.hasGlobalLocaleBar.homeHost:not(.communityShell) #basicRoot{top:93px}'));
assert(css.includes('body.homeHost.r89IntroDismissed'));
assert(js.includes('window.SM_R89_LANGUAGE=setLanguage')&&launcher.includes('SM_R89_LANGUAGE?.(language)'));
assert(js.includes("lang==='en'")&&js.includes('en:{title:'));
const discover=await read('cloud/discover.js'),d=await read('discover.html');
assert(d.includes('discover.js?v=r89i18n1'));
assert(discover.includes("all.href='/'+locale+'/use-cases.html'"));
assert(discover.includes("a.href='/'+locale+'/use-cases.html#'"));
assert(discover.includes("a.href='/'+locale+'/legal.html#'+kind"));
const editor=await read('cloud/r89-example-editor.js');
for(const q of ["createProject(x.type)","applyTheme(p,x.theme)","saveProject(projectFor(sample))","visibility:'private'"]){
 assert(editor.includes(q),'missing '+q);
}
assert(!/supabase|\.rpc\(|\.insert\(|\.upsert\(/i.test(editor),'editor sample copy must never touch remote public data');
for(const p of ['ja/use-cases.html','en/use-cases.html']){
 const html=await read(p);assert(html.includes('r89-example-editor.js?v=r89p1'));
 assert.equal((html.match(/class="case" id=/g)||[]).length,5);
 assert(html.includes('r89-example-editor.css?v=r89p1'));
 assert(html.includes('<meta name="robots" content="index,follow">'));
}
console.log('R89 static PASS: bilingual Home UX, JA/EN Discover, 5 exact source-backed private editable examples');
