#!/usr/bin/env node
// R66 Stats Maker Free usage triage.
// Reads a local JSON snapshot only. NO NETWORK, NO credentials, NO writes.
// Never treat missing metrics as healthy; classify each quota independently.
import {readFileSync} from 'node:fs';

export const QUOTAS=Object.freeze([
  {key:'database_bytes',label:'Supabase database size (conservative 500 MB)',limit:500000000,unit:'bytes',period:'current'},
  {key:'worker_requests_utc_day',label:'Cloudflare Worker requests (account-wide)',limit:100000,unit:'requests',period:'UTC day'},
  {key:'egress_uncached_bytes_billing_month',label:'Supabase uncached egress',limit:5e9,unit:'bytes',period:'organization billing month'},
  {key:'egress_cached_bytes_billing_month',label:'Supabase cached egress',limit:5e9,unit:'bytes',period:'organization billing month'},
  {key:'auth_mau_billing_month',label:'Supabase active users',limit:50000,unit:'MAU',period:'organization billing month'},
  {key:'storage_bytes',label:'Supabase Storage',limit:1e9,unit:'bytes',period:'current'}
]);
export function classify(percent) {
  return percent>=100?'exceeded':percent>=90?'critical':percent>=80?'high':percent>=50?'watch':'normal';
}
function validNumber(n,name) {
  if(n===null||n===undefined)return null;
  if(typeof n!=='number'||!Number.isFinite(n)||n<0)
    throw new Error(name+' must be a nonnegative finite number or null');
  return n;
}
export function triage(data) {
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('expected JSON object');
  if(typeof data.as_of_utc!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(data.as_of_utc)
      ||!Number.isFinite(Date.parse(data.as_of_utc)))
    throw new Error('as_of_utc must be an ISO timestamp');
  const metrics=QUOTAS.map(q=>{
    const current=validNumber(data[q.key],q.key);
    const pct=current===null?null:Math.round(current/q.limit*10000)/100;
    return {...q,observed:current,pct,status:pct===null?'unmeasured':classify(pct)};
  });
  const workerRequests=validNumber(data.worker_requests_utc_day,'worker_requests_utc_day');
  const workerErrors=validNumber(data.worker_errors_utc_day,'worker_errors_utc_day');
  if(workerRequests!==null&&workerErrors!==null&&workerErrors>workerRequests)
    throw new Error('worker_errors_utc_day exceeds requests');
  const workerErrorPct=workerRequests>0&&workerErrors!==null
    ?Math.round(workerErrors/workerRequests*10000)/100:null;
  const errorSignal={
    key:'worker_http_error_rate',label:'Worker error rate (internal action threshold)',
    pct:workerErrorPct,status:workerErrorPct===null?'unmeasured'
      :workerErrorPct>=5?'critical':workerErrorPct>=1?'watch':'normal',
    note:'Not a provider quota. Confirm whether errors are server 5xx; exclude expected client 4xx.'
  };
  const unknown=metrics.filter(m=>m.status==='unmeasured').map(m=>m.key);
  const flagged=metrics.filter(m=>['watch','high','critical','exceeded'].includes(m.status));
  return {
    site:'statsmaker.app',as_of_utc:data.as_of_utc,
    data_provenance:'Operator-supplied snapshot; never generated from mock limits',
    metrics,errorSignal,
    summary:{
      status:flagged.some(m=>['critical','exceeded'].includes(m.status))?'critical'
        :flagged.some(m=>m.status==='high')?'high':flagged.length?'watch'
        :unknown.length?'incomplete':'normal',
      flagged:flagged.map(m=>m.key),unmeasured:unknown,
      disclaimer:unknown.length?'Unmeasured quotas require provider dashboard; do NOT assume healthy.':'All quota metrics provided.'
    }
  };
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
  if(process.argv.length!==3) {
    console.error('Usage: node scripts/r66-free-usage-triage.mjs <snapshot.json>');
    process.exitCode=2;
  } else {
    try {
      const obj=JSON.parse(readFileSync(process.argv[2],'utf8'));
      console.log(JSON.stringify(triage(obj),null,2));
    }catch(err){console.error('R66 usage triage failed:',err.message);process.exitCode=1}
  }
}
