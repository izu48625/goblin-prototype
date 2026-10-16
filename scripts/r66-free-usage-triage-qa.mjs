import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {triage,QUOTAS,classify} from './r66-free-usage-triage.mjs';

const now='2026-10-16T10:58:06Z';
assert.equal(QUOTAS.length,6);
assert.equal(classify(49.99),'normal');
assert.equal(classify(50),'watch');
assert.equal(classify(80),'high');
assert.equal(classify(90),'critical');
assert.equal(classify(100),'exceeded');
const snapshot={as_of_utc:now,database_bytes:12954771};
const base=triage(snapshot);
assert.equal(base.site,'statsmaker.app');
assert.equal(base.summary.status,'incomplete','Unknown quotas must NOT be green');
assert.equal(base.metrics.find(x=>x.key==='database_bytes').pct,2.47);
assert.equal(base.metrics.find(x=>x.key==='database_bytes').status,'normal');
assert.equal(base.metrics.filter(x=>x.status==='unmeasured').length,5);
assert.equal(base.errorSignal.status,'unmeasured');
const s={
 as_of_utc:now,
 database_bytes:524288000,
 worker_requests_utc_day:50000,
 worker_errors_utc_day:3,
 egress_uncached_bytes_billing_month:4e9,
 egress_cached_bytes_billing_month:4.5e9,
 auth_mau_billing_month:25000,
 storage_bytes:0
};
const flagged=triage(s);
assert.equal(flagged.summary.status,'critical');
assert.deepEqual(flagged.summary.unmeasured,[]);
assert.deepEqual(flagged.summary.flagged,
  ['database_bytes','worker_requests_utc_day','egress_uncached_bytes_billing_month','egress_cached_bytes_billing_month','auth_mau_billing_month']);
assert.equal(flagged.metrics[0].status,'exceeded');
assert.equal(flagged.metrics[1].status,'watch');
assert.equal(flagged.metrics[2].status,'high');
assert.equal(flagged.metrics[3].status,'critical');
assert.equal(flagged.errorSignal.status,'normal');
const error=triage({...s,worker_requests_utc_day:100,worker_errors_utc_day:5});
assert.equal(error.errorSignal.status,'critical');
for(const bad of [
 {...s,database_bytes:-1},
 {...s,worker_requests_utc_day:'50000'},
 {...s,worker_errors_utc_day:100001},
 {...s,as_of_utc:'not a date'}
])assert.throws(()=>triage(bad));
const testFolder=mkdtempSync(join(tmpdir(),'r66-usage-'));
try {
 const path=join(testFolder,'snapshot.json');
 writeFileSync(path,JSON.stringify(snapshot));
 const raw=execFileSync(process.execPath,[new URL('./r66-free-usage-triage.mjs',import.meta.url).pathname,path],{encoding:'utf8'});
 const cli=JSON.parse(raw);
 assert.equal(cli.summary.status,'incomplete');
 assert.equal(cli.metrics.find(x=>x.key==='database_bytes').pct,2.47);
}finally{rmSync(testFolder,{recursive:true,force:true})}
console.log('R66 quota evaluator PASS: missing metrics unknown, 50/80/90/100 thresholds, errors and CLI');
