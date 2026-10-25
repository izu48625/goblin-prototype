// Read-only R83 production release verification. Bounded requests; no mutations, no auth, no ad calls.
import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||'https://statsmaker.app';
assert(/^https:\/\/statsmaker\.app\/?$/.test(origin),'Use only the official production origin');
const expected=[
 ['/ja/scoring-guide.html',['scoringPlayground','/cloud/scoring-guide.mjs?v=r83p2','点数が同じでも','hreflang="en"']],
 ['/en/scoring-guide.html',['scoringPlayground','/cloud/scoring-guide.mjs?v=r83p2','Equal averages can hide','hreflang="ja"']],
 ['/ja/',['/ja/scoring-guide.html']],
 ['/en/',['/en/scoring-guide.html']],
 ['/ja/examples.html',['/ja/scoring-guide.html']],
 ['/en/examples.html',['/en/scoring-guide.html']],
 ['/cloud/scoring-guide.mjs',['export function weightedAverage','export function rankSample']],
 ['/sitemap-static.xml',['/ja/scoring-guide.html','/en/scoring-guide.html']]
];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function audit(){
  const errors=[];
  for(const [path,markers] of expected){
    try{
      const signal=AbortSignal.timeout(10000);
      const response=await fetch(origin+path,{signal,headers:{'Cache-Control':'no-cache'}});
      const value=await response.text();
      if(response.status!==200){errors.push(path+' status='+response.status);continue;}
      for(const marker of markers)if(!value.includes(marker))errors.push(path+' missing '+marker);
      if(/adsbygoogle\.js|googletagmanager\.com/i.test(value))errors.push(path+' unexpected tracking/ad script');
    }catch(error){errors.push(path+' '+String(error.message));}
  }
  return errors;
}
let errors=[];
for(let attempt=1;attempt<=18;attempt++){
  errors=await audit();
  if(errors.length===0){console.log('R83 production read-only audit PASS: eight routes and expected content');process.exit(0);}
  console.log('R83 audit attempt '+attempt+'/18: '+errors.slice(0,4).join(' | '));
  if(attempt<18)await sleep(10000);
}
console.error('R83 production content not verified:\n'+errors.join('\n'));
process.exitCode=1;
