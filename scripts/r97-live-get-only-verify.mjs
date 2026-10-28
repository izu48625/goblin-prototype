const site='https://statsmaker.app';
const pages=[
  ['/ja/game-balance.html',['id="r97Lab"','重みを動かして順位を比較','/cloud/r97-game-balance.js?v=r97lab1','rel="canonical"']],
  ['/en/game-balance.html',['id="r97Lab"','Balance five game weapons','/cloud/r97-game-balance.js?v=r97lab1','rel="canonical"']],
  ['/cloud/r97-game-balance.js',['data-r97-result','Wind Dagger','疾風の短剣','data-r97-scenario']],
  ['/discover.html',['id="r97BalanceLink"','cloud/discover.js?v=r97balance1']],
  ['/cloud/discover.js',['game-balance.html','r97BalanceLink']],
  ['/my.html',['id="r97DupOnlyBtn"','cloud/my.js?v=r97dup1','noindex,follow']],
  ['/cloud/my.js',['publicDuplicatesAmongOwnedWorks()','data-stage-unlisted',"select.value='unlisted'"]],
  ['/sitemap-static.xml',['/ja/game-balance.html','/en/game-balance.html']]
];
const wait=ms=>new Promise(done=>setTimeout(done,ms));
async function check(path,markers){
 const r=await fetch(site+path,{redirect:'follow',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
 const body=await r.text();
 return {path,status:r.status,chars:body.length,missing:markers.filter(x=>!body.includes(x))};
}
let failures=[];
for(let i=1;i<=12;i++){
 const rows=await Promise.all(pages.map(async ([path,markers])=>{
  try{return await check(path,markers)}catch(e){return {path,status:0,missing:[String(e)]}}
 }));
 failures=rows.filter(r=>r.status!==200||r.missing.length);
 console.log('R97 LIVE AUDIT attempt',i,JSON.stringify(rows));
 if(!failures.length){console.log('R97 LIVE PASS: 8/8 public endpoints and expected shipped markers; no writes');process.exit(0)}
 if(i<12)await wait(12000);
}
console.error('R97 LIVE FAIL',JSON.stringify(failures));
process.exitCode=1;