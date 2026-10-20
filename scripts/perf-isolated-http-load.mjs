#!/usr/bin/env node
// Isolated HTTP load harness. Refuses production hosts and non-loopback targets by default.
// Usage: node scripts/perf-isolated-http-load.mjs --url http://127.0.0.1:8787/ --concurrency 10 --requests 200
import {performance} from 'node:perf_hooks';
const args=Object.fromEntries(process.argv.slice(2).flatMap((v,i,a)=>v.startsWith('--')?[[v.slice(2),a[i+1]]]:[]));
const raw=args.url;
if(!raw)throw Error('Missing --url');
const url=new URL(raw);
const allowed=new Set(['localhost','127.0.0.1','::1','[::1]']);
if(!allowed.has(url.hostname))throw Error('Safety stop: only loopback hosts are allowed. Use an isolated local server.');
if(!['http:','https:'].includes(url.protocol))throw Error('Unsupported protocol');
if(url.username||url.password)throw Error('Credentials in URL forbidden');
const concurrency=Number(args.concurrency||10), requests=Number(args.requests||200);
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>1000||!Number.isInteger(requests)||requests<1||requests>20000)throw Error('Invalid limits');
const timeout=Number(args.timeout||10000);
if(!Number.isFinite(timeout)||timeout<100||timeout>30000)throw Error('Invalid timeout');
let next=0,failed=0,success=0,bytes=0;const samples=[],codes={};
const started=performance.now();
await Promise.all(Array.from({length:Math.min(concurrency,requests)},async()=>{
  while(true){
    const i=next++;if(i>=requests)break;
    const t=performance.now();
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(timeout),redirect:'manual',headers:{'cache-control':'no-cache'}});
      const body=await response.arrayBuffer();bytes+=body.byteLength;
      codes[response.status]=(codes[response.status]||0)+1;
      if(response.ok)success++;else failed++;
    }catch(e){failed++;codes.ERROR=(codes.ERROR||0)+1;}
    samples.push(performance.now()-t);
  }
}));
samples.sort((a,b)=>a-b);const pct=p=>samples[Math.min(samples.length-1,Math.ceil(samples.length*p)-1)];
const seconds=(performance.now()-started)/1000;
const report={url:url.origin+url.pathname,concurrency,requests,success,failed,errorRate:failed/requests,seconds:+seconds.toFixed(3),rps:+(requests/seconds).toFixed(2),bytes,statusCodes:codes,latencyMs:{p50:+pct(.5).toFixed(2),p95:+pct(.95).toFixed(2),p99:+pct(.99).toFixed(2),max:+samples.at(-1).toFixed(2)}};
console.log(JSON.stringify(report,null,2));
if(failed||report.latencyMs.p95>2000)process.exitCode=1;
