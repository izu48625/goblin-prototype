// R87 one-time read-only production check. Neither DB writes nor ad impressions.
import assert from 'node:assert/strict';
const origin='https://statsmaker.app';
const request=async path=>{
 const r=await fetch(origin+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
 assert.equal(r.status,200,'HTTP '+r.status+' on '+path);
 return {r,text:await r.text()};
};
async function audit(){
 const home=await request('/index.html');
 assert(home.text.includes('id="r87HomeGuide"'),'Root content not deployed');
 assert(home.text.includes('採点をグラフ・ランキング・Tier表で見比べる'),'First-party home help not visible in source');
 assert(home.text.includes("src='base/index.html"),'Instant editor must remain functional');
 const discover=await request('/discover.html');
 assert(discover.text.includes('r87EditorialTitle'),'Official sample gallery absent from Discover');
 assert(discover.text.includes('下のユーザー公開作品とは別のコンテンツ'),'Samples must not impersonate user Public works');
 for(const image of ['cafe','routes','study'])assert(discover.text.includes('usecase-'+image+'.png'));
 const id='1eed295e-9a79-449d-9fd7-e4405e0ae426';
 const publicWork=await request('/work/'+id);
 assert(publicWork.text.includes('公開作品の採点データ'),'Real Public scores not served');
 assert(publicWork.text.includes('リオネル・メッシ'),'Wrong work content');
 assert(publicWork.text.includes('<td>9</td>'),'Actual score missing');
 assert(publicWork.text.includes('href="https://statsmaker.app/work/'+id+'"'));
 assert.equal(publicWork.r.headers.get('Cache-Control'),'no-store',
   'Private/unlisted visibility change must not keep public HTML cached');
 const staticSitemap=await request('/sitemap-static.xml');
 assert(staticSitemap.text.includes('/ja/use-cases.html'),'Sitemap examples removed');
 const sitemap=await request('/sitemap.xml');
 assert(sitemap.text.includes('sitemap-works-1.xml'),'Public sitemap gone');
 const publisher=await request('/ads.txt');
 assert(publisher.text.includes('pub-2734957009365610'),'AdSense authorization changed');
 for(const [p,s] of [['/ja/use-cases.html','カフェドリンクの好みを比較'],['/en/use-cases.html','Compare café drinks by preference']]){
  const page=await request(p);
  assert(page.text.includes(s),'Existing sample page regressed '+p);
 }
 const broken=await fetch(origin+'/work/not-a-real-uuid',{signal:AbortSignal.timeout(10000)});
 assert.equal(broken.status,404,'Malformed work ID must never index');
 console.log('R87 LIVE PASS: instant editor, editorial sample gallery, real Public score SSR, visibility cache, sitemaps and ad account');
}
for(let attempt=1;attempt<=18;attempt++){
 try{await audit();process.exit(0)}
 catch(e){console.log('R87 deployment check '+attempt+'/18:',String(e.message));if(attempt===18)throw e;await new Promise(r=>setTimeout(r,8000));}
}
