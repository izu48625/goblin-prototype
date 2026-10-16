import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const file=async p=>readFile(new URL(p,root),'utf8');
const messages=await file('base/js/i18n.js');
const viz=await file('app/src/core/i18n.js');
const discover=await file('cloud/discover.js');
function keysByLocale(source,label){
  const jaStart=source.indexOf('ja:{'),enStart=source.indexOf('en:{',jaStart+1);
  assert(jaStart>=0&&enStart>jaStart,label+' language groups missing');
  const pick=block=>[...block.matchAll(/^\s*['"]([^'"]+)['"]\s*:/gm)].map(m=>m[1]);
  const ja=pick(source.slice(jaStart,enStart));
  const en=pick(source.slice(enStart));
  const unique=(list,lang)=>{
    assert.equal(new Set(list).size,list.length,label+' duplicate '+lang+' keys');
    return new Set(list);
  };
  const a=unique(ja,'ja'),b=unique(en,'en');
  const missingJa=[...b].filter(k=>!a.has(k)),missingEn=[...a].filter(k=>!b.has(k));
  assert.deepEqual(missingJa,[],label+' missing Japanese translations');
  assert.deepEqual(missingEn,[],label+' missing English translations');
  console.log('R52',label,'ja/en keys',ja.length,en.length);
}
keysByLocale(messages,'base HOME');
keysByLocale(viz,'expanded editor');
for(const legacy of [
  'R18のSupabase移行SQLをもう一度実行してください。',
  'Run the updated R18 Supabase migration SQL again.',
  'R15では対象画像はまだクラウドへ送りません。',
  'Images remain local in R15.'
]){
  assert(!messages.includes(legacy),'Outdated user-facing instruction: '+legacy);
}
assert(messages.includes("'action.hideMetrics':'Hide Metric Controls'"));
assert(messages.includes("'publish.migrationRequired':'公開データの確認中に問題が発生しました。"));
assert(messages.includes("'publish.migrationRequired':'A publishing data check failed."));
assert(discover.includes("popularSort.title=popularExplanation"));
assert(discover.includes("popularSort.setAttribute('aria-label'"));
assert(discover.includes('参加者数と公開Remix数を基に並べます。'));
assert(discover.includes('Ranked by participants and public Remix count.'));
assert(discover.includes("const PAGE_SIZE=12;"),'Discover paging accidentally modified');
console.log('R52 copy correctness, localization parity, Popular meaning PASS');
