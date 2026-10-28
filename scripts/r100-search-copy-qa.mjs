import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [home,launcher,base,mobile,guide,landing,intro,analytics]=await Promise.all([
 'index.html','app/src/launcher.js','base/index.html','base/js/r80-scoring-first.js',
 'ja/chart-guide.html','ja/index.html','cloud/r89-home-intro.js','cloud/analytics-config.js'
].map(read));
for(const [page,label] of [[home,'actual home'],[landing,'JA landing'],[guide,'JA comparison guide']]){
 assert(page.includes('キャラ比較'),'Natural Japanese character-comparison query missing: '+label);
 assert(page.includes('rel="canonical"'),'Canonical missing: '+label);
 assert(page.includes('name="description"'),'Description missing: '+label);
 assert(!page.includes('adsbygoogle.js'),'Ads reactivated unexpectedly: '+label);
}
assert(home.includes('id="launcherTitle" class="launchTitle">データやグラフ'));
assert(home.includes('<h2 id="pickerTitle">データやグラフ</h2>'));
assert(home.includes('app/src/launcher.js?v=r100labels1'));
assert(home.includes('cloud/r89-home-intro.js?v=r100labels1'));
assert(launcher.includes('launcherTitle:"データやグラフ"'));
assert(launcher.includes('pickerTitle:"データやグラフ"'));
assert(launcher.includes('launcherTitle:"Data & Charts"'));
assert(base.includes('id="r80VisualsBtn"'));
assert(base.includes('aria-label="データやグラフを開く">データやグラフ'));
assert(base.includes('js/r80-scoring-first.js?v=r100labels1'));
assert(mobile.includes("en?'Data & Charts':'データやグラフ'"));
assert(mobile.includes("type:'statsmaker:open-extensions'"),
 'Do not break the actual extension picker bridge');
assert(intro.includes('「データやグラフ」から目的に合うグラフ'));
assert(!guide.includes('拡張機能'));
assert(guide.includes('<h2>キャラ比較の具体例：攻撃・防御・素早さ</h2>'));
assert(guide.includes('<th scope="row">キャラA</th>'));
assert(guide.includes('<th scope="row">キャラB</th>'));
assert(guide.includes('攻撃の重要度を2'));
assert(landing.includes('href="/ja/chart-guide.html#character-stats"'));
assert(home.includes('キャラ比較・能力値グラフ・ランキング作成'));
assert(landing.includes('キャラ比較・能力値グラフ作成'));
assert(guide.includes('キャラ比較の作り方'));
assert(analytics.includes('enabled:false'));
console.log('R100 PASS: clear JP/EN chart controls, real two-character score example, natural search intent, canonical links, ads/analytics OFF');
