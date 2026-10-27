import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const home=await readFile(new URL('../index.html',import.meta.url),'utf8');
const h1=[...home.matchAll(/<h1>(.*?)<\\/h1>/g)].map(x=>x[1]);
assert.deepEqual(h1,['好きなものを採点・比較しよう'],'Home should have one prominent user-first heading');
assert(home.includes('<h2>採点をグラフ・ランキング・Tier表で見比べる</h2>'));
assert(home.includes('<h3>何から始める？</h3>'));
assert(home.includes('<h3>完成した作例から選べます</h3>'));
assert(home.includes('.r87HomeGuideBody h2{font-size:19px'));
assert(home.includes('.r87HomeGuideBody h3{font-size:15px'));
assert(home.includes('id="basicRoot"') && home.includes('id="basicFrame"'));
assert(home.includes('id="extLauncher"'));
assert(home.includes('href="/ja/use-cases.html"'));
console.log('R95 PASS: one Home H1, semantic nested guide headings, preserved editor and examples links');
