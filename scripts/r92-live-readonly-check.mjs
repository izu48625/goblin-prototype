const origin='https://statsmaker.app';
const resources=[
['/index.html',['cloud/global-locale.js?v=r92myworks1','id="basicRoot"','id="basicFrame"']],
['/cloud/global-locale.js',['data-global-myworks','/my.html?lang=','自分の作品を管理','My Works']],
['/my.html',['自分の公開作品','r91SuggestBtn','r91BatchSaveBtn','noindex']],
['/discover.html',['Discover']],
['/ja/use-cases.html',['Stats Maker']]
];
const snooze=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let attempt=1;attempt<=12;attempt++){
 const problems=[];
 for(const [path,markers] of resources){
  try{
   const res=await fetch(origin+path,{signal:AbortSignal.timeout(14000),redirect:'follow',headers:{'Cache-Control':'no-cache'}});
   const body=await res.text();
   if(res.status!==200){problems.push(path+' HTTP '+res.status);continue;}
   for(const marker of markers)if(!body.includes(marker))problems.push(path+' missing '+marker);
  }catch(e){problems.push(path+' '+(e?.message||String(e)))}
 }
 console.log('R92 LIVE GET-only attempt',attempt,problems.length?'PENDING: '+problems.join('; '):'PASS');
 if(!problems.length){console.log('R92 LIVE PASS: Home menu, My Works destination and existing app assets available');process.exit(0)}
 if(attempt<12)await snooze(12000);
}
process.exitCode=1;
