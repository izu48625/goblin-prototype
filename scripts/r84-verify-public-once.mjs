// One-time read-only production check of new R84 pages and native PNG images.
import assert from 'node:assert/strict';
const origin='https://statsmaker.app';
const slugs=['cafe','routes','study','plan','hero'];
const pages=[
 ['/ja/use-cases.html',['<html lang="ja">','usecase-cafe.png','usecase-routes.png','usecase-study.png','usecase-plan.png','usecase-hero.png']],
 ['/en/use-cases.html',['<html lang="en">','usecase-cafe.png','usecase-routes.png','usecase-study.png','usecase-plan.png','usecase-hero.png']],
 ['/ja/',['/ja/use-cases.html']],
 ['/en/',['/en/use-cases.html']],
 ['/ja/examples.html',['/ja/use-cases.html']],
 ['/en/examples.html',['/en/use-cases.html']],
 ['/sitemap-static.xml',['/ja/use-cases.html','/en/use-cases.html']]
];
const request=async path=>{
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}});
 assert.equal(r.status,200,'HTTP '+r.status+' '+path);
 return r;
};
async function run(){
 for(const [path,marks] of pages){
   const html=await (await request(path)).text();
   for(const text of marks)assert(html.includes(text),path+' missing '+text);
 }
 for(const slug of slugs){
   const path='/ja/example-images/usecase-'+slug+'.png';
   const r=await request(path);
   const buf=Buffer.from(await r.arrayBuffer());
   assert(buf.length>5000&&buf.length<2000000,'Invalid size for '+path);
   assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a',path+' PNG signature');
   assert.equal(buf.readUInt32BE(16),slug==='study'?1600:1080,path+' width');
   assert.equal(buf.readUInt32BE(20),slug==='study'?900:1080,path+' height');
 }
}
let lastError;
for(let i=1;i<=12;i++){
 try{await run(); console.log('R84 production HTTP PASS: 2 guides, 4 entrances, sitemap, five first-party actual PNGs');process.exit(0)}
 catch(e){lastError=e;console.log('R84 production check '+i+'/12: '+String(e.message));if(i<12)await new Promise(resolve=>setTimeout(resolve,6000))}
}
console.error('R84 production verification failed: '+lastError);
process.exitCode=1;
