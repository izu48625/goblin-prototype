import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [smoke,remix]=await Promise.all([
  readFile(new URL('./production-smoke.mjs',import.meta.url),'utf8'),
  readFile(new URL('../cloud/remix.js',import.meta.url),'utf8')
]);
assert(remix.includes("title:String(topic.title||'').replace("),
  'Production Remix strips legacy copy suffixes but keeps the source name');
assert(smoke.includes('const sourceTitle=await navigateRemix(page);'));
assert(smoke.includes('const publicTitle=(await page.locator('));
assert(smoke.includes('active.title===sourceTitle && active.sourceTopicTitle===sourceTitle'));
assert(smoke.includes("help.includes('点数と説明欄は空欄です')"),
  'Smoke must assert both scores and description are blank on Remix');
assert(!smoke.includes("active.title.endsWith('（コピー）')"),
  'Test must not demand the old Duplicate suffix from Remix');
console.log('R135 PASS: current source title contract matches production smoke test');
