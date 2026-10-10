// Production must fail closed if the security-config endpoint is unavailable.
// Non-production GitHub Pages/local previews intentionally retain the legacy RPC.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../cloud/community-gateway.js',import.meta.url),'utf8');
const params={p_topic_id:'57b432ed-fbf2-4261-b57d-9e0f27356d2e',p_scores:[],p_submit:false};
const disabled={communityGatewayEnabled:false,siteKey:null,turnstileConfigured:true};
const enabledWithoutSiteKey={communityGatewayEnabled:true,siteKey:null,turnstileConfigured:true};

function createHarness(hostname,fetchImpl){
  const calls={rpc:0,fetch:0};
  const win={location:{hostname}};
  const ctx={
    window:win,
    fetch:async (...args)=>{calls.fetch++;return fetchImpl(...args)},
  };
  vm.runInNewContext(source,ctx,{filename:'cloud/community-gateway.js'});
  const client={rpc:async (...args)=>{
    calls.rpc++;
    assert.equal(args[0],'save_my_topic_rating');
    return {data:[{rating_status:'submitted'}],error:null};
  }};
  return {calls,save:()=>win.SM_COMMUNITY_GATEWAY.save(client,params)};
}

const http=(body,status=200)=>({ok:status>=200&&status<300,json:async()=>body});
let h=createHarness('statsmaker.app',async()=>http(null,404));
let r=await h.save();
assert(r.error instanceof Error);
assert.equal(h.calls.rpc,0,'production 404 must not downgrade to direct RPC');

h=createHarness('statsmaker.app',async()=>{throw new Error('offline')});
r=await h.save();
assert(r.error instanceof Error);
assert.equal(h.calls.rpc,0,'production network failure must not downgrade');

h=createHarness('statsmaker.app',async()=>http({siteKey:null}));
r=await h.save();
assert(r.error instanceof Error);
assert.equal(h.calls.rpc,0,'malformed config must not downgrade');

h=createHarness('statsmaker.app',async()=>http(enabledWithoutSiteKey));
r=await h.save();
assert(r.error instanceof Error);
assert.equal(h.calls.rpc,0,'an enabled gateway with missing key must not downgrade');

h=createHarness('statsmaker.app',async()=>http(disabled));
r=await h.save();
assert.equal(r.error,null,'explicitly disabled gateway should preserve current writes');
assert.equal(h.calls.rpc,1);
assert.equal(h.calls.fetch,1);

h=createHarness('www.statsmaker.app',async()=>http(disabled));
r=await h.save();
assert.equal(r.error,null);
assert.equal(h.calls.rpc,1);

h=createHarness('izu48625.github.io',async()=>{throw new Error('must not fetch config on preview')});
r=await h.save();
assert.equal(r.error,null);
assert.equal(h.calls.rpc,1,'GitHub Pages preview should retain RPC');
assert.equal(h.calls.fetch,0);

h=createHarness('statsmaker.app',(()=>{let n=0;return async()=>++n===1?http(null,503):http(disabled)})());
r=await h.save();
assert(r.error instanceof Error);
r=await h.save();
assert.equal(r.error,null,'failed config request should be retriable');
assert.equal(h.calls.rpc,1);
assert.equal(h.calls.fetch,2);

console.log('R26 P3 browser gateway fail-closed tests PASS');
