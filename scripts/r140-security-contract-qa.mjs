import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [sql,doc,worker]=await Promise.all([
  read('security/R140_RATING_CONSENT_SERVER_GATE.sql'),
  read('security/R140_SECURITY_DEFINER_REVIEW.md'),
  read('worker/index.js')
]);
assert(sql.includes('CREATE OR REPLACE FUNCTION public.topic_accepts_my_ratings'));
assert(sql.includes('AND t.allow_ratings IS TRUE')&&sql.includes('AND t.show_community IS TRUE'));
assert(sql.includes("t.visibility IN ('public', 'unlisted')"));
assert(sql.includes('t.owner_id = auth.uid()'));
assert(doc.includes('topic_has_submissions')&&doc.includes('authenticated EXECUTE'));
const endpoint=worker.match(/const SUPABASE_URL='(https:\/\/[^']+)'/)?.[1];
const key=worker.match(/const SUPABASE_KEY='(sb_publishable_[^']+)'/)?.[1];
assert(endpoint&&key,'Production Public API config needed');
const headers={apikey:key,Accept:'application/json'};
const publicWorks=await fetch(endpoint+'/rest/v1/topics?select=id,visibility,show_community,allow_ratings&visibility=eq.public&limit=20',{
  headers,cache:'no-store',signal:AbortSignal.timeout(16000)
});
assert.equal(publicWorks.status,200);
const list=await publicWorks.json();
assert(Array.isArray(list)&&list.length>=1);
assert(list.every(x=>x.visibility==='public'));
const denied=await fetch(endpoint+'/rest/v1/rpc/topic_accepts_my_ratings?p_topic_id=00000000-0000-4000-8000-000000000000',{
  headers,cache:'no-store',signal:AbortSignal.timeout(16000)
});
assert([401,403,404].includes(denied.status),
  'Anonymous clients must not execute the authenticated consent helper: HTTP '+denied.status);
console.log('R140 PASS: Community backend consent source, no anonymous helper RPC, Public GET intact',list.length);
