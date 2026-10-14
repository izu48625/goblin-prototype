import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyticsRegionResponse} from '../worker/analytics-region.js';

const cfReq=(country,extra='')=>{
  const r=new Request('https://statsmaker.app/api/analytics-region?country=JP&region=JP'+extra,{
    headers:{'CF-IPCountry':'JP','X-User-Country':'JP','Accept-Language':'ja-JP'}
  });
  if(country!==undefined)Object.defineProperty(r,'cf',{value:{country}});
  return r;
};
for(const [country,expected] of [
  ['JP','jp'],['DE','consent_required'],['FR','consent_required'],
  ['GB','consent_required'],['CH','consent_required'],
  ['NO','consent_required'],['US','consent_required'],
  ['AU','consent_required'],['XX','consent_required'],
  ['', 'consent_required'],[null,'consent_required'],
  [undefined,'consent_required']
]){
  const response=analyticsRegionResponse(cfReq(country));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  const result=await response.json();
  assert.deepEqual(result,{mode:expected});
  assert.equal(Object.keys(result).length,1,'No IP/country/user data may be returned');
}
const fakeHeader=cfReq(undefined);
assert.equal((await analyticsRegionResponse(fakeHeader).json()).mode,'consent_required',
  'Spoofed CF-IPCountry header and query flags must not grant JP mode');
for(const method of ['POST','PUT','DELETE']){
  const r=analyticsRegionResponse({method,cf:{country:'JP'}});
  assert.equal(r.status,405);
}
assert.equal((await analyticsRegionResponse({method:'HEAD',cf:{country:'JP'}}).text()),'');
const wrangler=JSON.parse((await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8')));
assert(wrangler.assets.run_worker_first.includes('/api/analytics-region'),
  'Cloudflare must run Worker before static assets for geo decisions');
const worker=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
assert(worker.includes("url.pathname==='/api/analytics-region'"),
  'Trusted region endpoint must be reachable from Workers');
const analytics=await readFile(new URL('../cloud/analytics.js',import.meta.url),'utf8');
assert(analytics.includes("consentKey='sm-analytics-consent-v2'"));
assert(analytics.includes("mode==='jp'")===false || analytics.includes("region==='jp'"));
assert(analytics.includes("source='jp_default'"));
assert(!/const\s+geo\s*=\s*.*navigator\.language/.test(analytics));
const ad=await readFile(new URL('../cloud/ad-layout.js',import.meta.url),'utf8');
assert(ad.includes("get('adPreview')==='1'"),'AdSense must remain preview only');
console.log('R44 Cloudflare trusted region, spoof resistance, no-cache, no-data-leak unit PASS');
