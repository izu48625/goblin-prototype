// One-time read-only verification of R86 production pages (no DB, no ads, no writes).
import assert from 'node:assert/strict';
const origin='https://statsmaker.app';
const checks=[
 ['/ja/use-cases.html',['カフェドリンクの好みを比較','散歩ルートを2軸で比較','サンプルドリンク','サンプルデータ']],
 ['/en/use-cases.html',['Compare café drinks by preference','Compare walking routes on two axes','An original adventurer stat card']],
 ['/ja/examples.html',['旅行プランのサンプル']],
 ['/en/examples.html',['six sample teams']],
 ['/ja/scoring-guide.html',['旅行プランのサンプル3案','サンプル点数']],
 ['/en/scoring-guide.html',['three sample trip plans','sample scores above']]
];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function probe(){
 for(const [path,parts] of checks){
  const r=await fetch(origin+path,{signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}});
  assert.equal(r.status,200,'HTTP '+r.status+' '+path);
  const html=await r.text();
  for(const part of parts)assert(html.includes(part),'Missing new public wording '+path+': '+part);
  assert(!html.includes('架空'),'Old word still served '+path);
  if(path.startsWith('/en/'))assert(!/\bfictional\b|\binvented\b|\bimaginary\b/i.test(html),'Old English wording still served '+path);
 }
 for(const slug of ['cafe','routes','study','plan']){
  const path='/ja/example-images/usecase-'+slug+'.png';
  const r=await fetch(origin+path,{signal:AbortSignal.timeout(12000)});
  assert.equal(r.status,200,'Native PNG not served '+path);
  const bytes=Buffer.from(await r.arrayBuffer());
  assert(bytes.length>5000,'Tiny image '+path);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 }
}
for(let i=1;i<=12;i++){
 try{await probe();console.log('R86 LIVE PASS: six bilingual production pages display new example wording and four native PNGs are served');process.exit(0)}
 catch(e){console.log('R86 LIVE attempt '+i+'/12 '+e.message);if(i===12)throw e;await pause(7000);}
}
