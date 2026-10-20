import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./perf-isolated-http-load.mjs',import.meta.url));
test('refuses production URLs',()=>{
 const r=spawnSync(process.execPath,[script,'--url','https://statsmaker.app/','--requests','1'],{encoding:'utf8'});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/only loopback hosts/);
});
test('measures a loopback HTTP server at 100 concurrent requests',async()=>{
 const server=createServer((req,res)=>{res.setHeader('content-type','application/json');res.end('{"ok":true}')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 const port=server.address().port;
 const output=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[script,'--url',`http://127.0.0.1:${port}/`,'--concurrency','100','--requests','1000'],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
  child.on('error',reject);child.on('close',code=>code===0?resolve(stdout):reject(Error(stderr||stdout)));
 });
 const report=JSON.parse(output);
 assert.equal(report.success,1000);assert.equal(report.failed,0);
 assert.equal(report.concurrency,100);assert.ok(report.latencyMs.p95>=0);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
