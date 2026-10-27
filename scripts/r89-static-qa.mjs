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
const original=JSON.parse(await read('cloud/r89-original-presets.json'));
const generator=await read('scripts/r70-generate-native-examples.mjs');
assert.deepEqual(original.cases.map(c=>c.slug),['radar','ranking','tier']);
assert.deepEqual(original.cases.map(c=>c.type),['radar','ranking-card','tier-list']);
assert.deepEqual(original.axes,['Attack','Defense','Speed','Teamwork']);
assert.deepEqual(original.teams.map(t=>[t.name,t.scores,t.color]),[
 ['Green Team',[95,90,95,90],'#38cda0'],
 ['Purple Team',[80,85,90,80],'#ad8cff'],
 ['Red Team',[90,60,70,90],'#ff887e'],
 ['Blue Team',[60,90,80,70],'#74adff'],
 ['Yellow Team',[55,60,65,60],'#e7be6b'],
 ['Gray Team',[40,50,55,45],'#9ba5b5']]);
for(const team of original.teams){
 assert(generator.includes("name:'"+team.name+"'")&&generator.includes('scores:['+team.scores.join(',')+']'),
   'Original chart sample differs from native exporter: '+team.name);
}
const root=await read('index.html'),launcher=await read('app/src/launcher.js'),css=await read('cloud/r89-home-intro.css'),js=await read('cloud/r89-home-intro.js');
assert(root.includes('id="r89HomeIntro"'));assert(root.includes('<div id="basicRoot"><iframe'), 'instant editor removed');
assert(root.includes('id="r87HomeGuide"'));assert(root.includes('r89-home-intro.js?v=r89p1'));
assert(css.includes('body.hasGlobalLocaleBar.homeHost:not(.communityShell) #basicRoot{top:93px}'));
assert(css.includes('body.homeHost.r89IntroDismissed'));
assert(js.includes('window.SM_R89_LANGUAGE=setLanguage')&&launcher.includes('SM_R89_LANGUAGE?.(language)'));
assert(js.includes("lang==='en'")&&js.includes('en:{title:'));
assert(js.includes("HIDDEN_KEY='statsMaker.r89HomeIntroHidden'")&&js.includes("statsmaker:home-intro-show"));
const globalLocale=await read('cloud/global-locale.js');
assert(globalLocale.includes('data-global-intro')&&globalLocale.includes('ホーム案内を再表示'));
assert(css.includes('r89HomeIntroCopy h1')&&css.includes('[data-sm-theme="dark"]'));

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
assert(editor.includes("messages.retry")&&editor.includes("void initialize()"),'Missing network failure retry');
assert(editor.includes("originalTeams")&&editor.includes("originalAxes"),'Native original data not loaded');
for(const lang of ['ja','en']){
 const html=await read(lang+'/examples.html');
 assert(html.includes('r89-example-editor.js?v=r89p2'),'Missing original edit action '+lang);
 assert(html.includes('r89-example-editor.css?v=r89p2'));
 assert(html.includes('r89OriginalExamples'));
 assert.equal((html.match(/class="explain" id="/g)||[]).length,3);
}
for(const p of ['ja/use-cases.html','en/use-cases.html']){
 const html=await read(p);assert(html.includes('r89-example-editor.js?v=r89p1'));
 assert.equal((html.match(/class="case" id=/g)||[]).length,5);
 assert(html.includes('r89-example-editor.css?v=r89p1'));
 assert(html.includes('<meta name="robots" content="index,follow">'));
}
console.log('R89 static PASS: Home persisted Help/i18n/theme, JA/EN Discover, 8 source-backed private editable examples and retry');
