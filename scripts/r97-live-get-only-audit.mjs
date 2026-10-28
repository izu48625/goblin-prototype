const base='https://statsmaker.app';
const checks=[
 ['/ja/game-balance.html',['ゲーム装備5種類','data-r97-result','/cloud/r97-game-balance.js?v=r97lab1','index,follow','/ja/scoring-guide.html']],
 ['/en/game-balance.html',['Balance five game weapons','data-r97-result','/cloud/r97-game-balance.js?v=r97lab1','index,follow','/en/scoring-guide.html']],
 ['/cloud/r97-game-balance.js',['Wind Dagger','疾風の短剣','data-r97-scenario','Math.abs']],
 ['/discover.html',['id="r97BalanceLink"','cloud/discover.js?v=r97balance1']],
 ['/cloud/discover.js',["'/'+locale+'/game-balance.html'",'r97BalanceLink']],
 ['/my.html',['id="r97DupOnlyBtn"','cloud/my.js?v=r97dup1','noindex,follow']],
 ['/cloud/my.js',['publicDuplicatesAmongOwnedWorks','data-stage-unlisted',"select.value='unlisted'",".eq('owner_id',state.user.id)"]],
 ['/sitemap-static.xml',['https://statsmaker.app/ja/game-balance.html','https://statsmaker.app/en/game-balance.html']],
 ['/ja/use-cases.html',['/ja/game-balance.html']],
 ['/en/use-cases.html',['/en/game-balance.html']]
];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function get(path){const response=await fetch(base+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000),redirect:'follow'});return {status:response.status,body:await response.text()};}
let success=false;let problems=[];
for(let attempt=1;attempt<=15;attempt++){
 problems=[];
 for(let offset=0;offset<checks.length;offset+=4){
  const parts=await Promise.all(checks.slice(offset,offset+4).map(async ([path,required])=>{
   try{
    const r=await get(path);
    const issues=[];if(r.status!==200)issues.push('HTTP '+r.status);
    for(const item of required)if(!r.body.includes(item))issues.push('missing '+item);
    return issues.length?{path,issues}:null;
   }catch(error){return {path,issues:[String(error)]}}
  }));
  problems.push(...parts.filter(Boolean));
 }
 console.log('R97 GET-ONLY attempt',attempt,problems.length?'pending '+JSON.stringify(problems):'ALL PASS');
 if(!problems.length){success=true;break}
 if(attempt<15)await pause(12000);
}
if(!success)throw Error('New official pages or owner duplicate review not deployed: '+JSON.stringify(problems));
const publicId='1eed295e-9a79-449d-9fd7-e4405e0ae426';
const work=await get('/work/'+publicId);
const notfound=await get('/work/00000000-0000-4000-8000-000000000000');
const sitemap=await get('/sitemap-works-1.xml');
const snapshot={
  checked:checks.length,
  publicWorkOk:work.status===200&&work.body.includes('seoScores'),
  unchangedPublicInSitemap:sitemap.status===200&&sitemap.body.includes(publicId),
  unknown404:notfound.status===404,unknownNoindex:notfound.body.includes('noindex'),
  sitemapIncludesTwoNewGuides:true
};
console.log('R97 LIVE VERIFIED',JSON.stringify(snapshot));
if(!snapshot.publicWorkOk||!snapshot.unchangedPublicInSitemap||!snapshot.unknown404||!snapshot.unknownNoindex)process.exitCode=1;
