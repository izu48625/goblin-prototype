// One-time read-only live deployment check. No Supabase writes, tracking or credentials.
import assert from 'node:assert/strict';
const origin='https://statsmaker.app';
const checks=[
 ['/index.html',['global-locale.js?v=r85examples1']],
 ['/ja/',['global-locale.js?v=r85examples1','class="r71SectionLinks"','href="/ja/use-cases.html"','href="/ja/examples.html"']],
 ['/en/',['global-locale.js?v=r85examples1','class="r71SectionLinks"','href="/en/use-cases.html"','href="/en/examples.html"']],
 ['/cloud/global-locale.js?v=r85examples1',['globalIntroBtn globalExamplesBtn','作例','Demos','data-global-about','use-cases.html']],
 ['/ja/use-cases.html',['<html lang="ja">','usecase-cafe.png','usecase-routes.png','usecase-study.png','usecase-plan.png','usecase-hero.png']],
 ['/en/use-cases.html',['<html lang="en">','usecase-cafe.png','usecase-routes.png','usecase-study.png','usecase-plan.png','usecase-hero.png']]
];
async function test(){
 for(const [path,marks] of checks){
  const r=await fetch(origin+path,{signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}});
  assert.equal(r.status,200,'R85 production status '+r.status+' for '+path);
  const txt=await r.text();
  for(const mark of marks)assert(txt.includes(mark),'R85 production '+path+' missing '+mark);
  if(/adsbygoogle\.js|googletagmanager\.com/.test(txt))throw Error('Unexpected live ads or GA4');
 }
}
for(let i=1;i<=16;i++){
 try{await test();console.log('R85 LIVE PASS: new shared home button code, localized gallery links, two real use-case destinations');process.exit(0)}
 catch(e){console.log('R85 LIVE attempt '+i+'/16: '+e.message);if(i===16)throw e;await new Promise(r=>setTimeout(r,7000));}
}
