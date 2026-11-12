// Read-only production permission smoke; must never sign in or write data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const origin='https://ibpdxbeltdwkquowjeay.supabase.co';
const worker=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
const key=worker.match(/const SUPABASE_KEY='(sb_publishable_[^']+)'/)?.[1];
assert(key,'Public publishable key unavailable');
const headers={apikey:key,Accept:'application/json'};
const unknown='00000000-0000-4000-8000-000000000000';
const rpc=await fetch(origin+'/rest/v1/rpc/topic_has_submissions?p_topic_id='+unknown,{
  method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(15000)
});
assert([401,403,404].includes(rpc.status),
  'A browser-only anonymous client must not invoke the private SECURITY DEFINER helper; HTTP '+rpc.status);
const works=await fetch(origin+'/rest/v1/topics?select=id,visibility&visibility=eq.public&limit=20',{
  method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(15000)
});
assert.equal(works.status,200,'Revoking the helper must not break Public topic access');
const data=await works.json();
assert(Array.isArray(data)&&data.length>0);
assert(data.every(r=>r?.visibility==='public'));
console.log('R136 PASS: anon helper RPC denied; current Public topic visibility unaffected',JSON.stringify({published:data.length,denialStatus:rpc.status}));
