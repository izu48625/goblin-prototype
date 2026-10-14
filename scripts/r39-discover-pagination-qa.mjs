// The original R39 client-side 200-row pagination was replaced in R40.
// Keep the historical CI entrypoint, but test the newer 12-row server contract.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../cloud/discover.js',import.meta.url),'utf8');
assert(!source.includes('.limit(60)'));
assert(!source.includes('.limit(500)'));
assert(!source.includes('allPublicTopics('));
assert(source.includes("sb.rpc('discover_public_works_v1'"));
assert(source.includes('const PAGE_SIZE=12'));
await import('./r40-discover-server-pagination-qa.mjs');
console.log('R39 compatibility gate PASS: upgraded R40 server-side pagination');
