// R88: independent, temporary, read-only AdSense readiness re-audit.
// No production writes, sign-ins, account creation, ad calls, or schema changes.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
const ORIGIN='https://statsmaker.app', LOCAL='http://127.0.0.1:4173';
const safe=async path=>{
 const response=await fetch(ORIGIN+path,{method:'GET',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(16000)});
 const body=await response.text();
 return {path,code:response.status,body,headers:response.headers};
};
const pages=['/','/ja/','/en/','/discover.html','/ja/use-cases.html','/en/use-cases.html',
 '/ja/examples.html','/en/examples.html','/ja/scoring-guide.html','/en/scoring-guide.html',
 '/ja/chart-guide.html','/en/chart-guide.html','/ja/png-guide.html','/en/png-guide.html',
 '/ja/legal.html','/en/legal.html','/robots.txt','/ads.txt','/sitemap.xml',
 '/sitemap-static.xml','/sitemap-works-1.xml'];
const results=[];
for(const path of pages){
 const r=await safe(path);
 const html=r.body;
 const obj={path,http:r.code,chars:html.length,canonical:html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]||'',
   h1:(html.match(/<h1\b/g)||[]).length,
   images:(html.match(/<img\b/g)||[]).length,
   paragraphs:(html.match(/<p\b/g)||[]).length,
   adsActive:/adsbygoogle\.js/i.test(html),ga4Active:/googletagmanager\.com\/gtag\/js/i.test(html),
   malformedRobots:/noindex/i.test(html),r87:html.includes('r87HomeGuide')||html.includes('r87EditorialTitle')};
 console.log('R88_LIVE_PAGE',JSON.stringify(obj));results.push(obj);
}
const sitemap=(await safe('/sitemap-works-1.xml')).body;
const ids=[...sitemap.matchAll(/<loc>https:\/\/statsmaker\.app\/work\/([0-9a-f-]{36})<\/loc>/g)].map(m=>m[1]);
const works=[];
for(const id of ids){
 const r=await safe('/work/'+id),h=r.body;
 works.push({status:r.code,canonical:h.includes('/work/'+id),hasTable:h.includes('class="seoTableScroll"'),
   ratingCells:(h.match(/<td>/g)||[]).length,rows:(h.match(/<th scope="row">/g)||[]).length,
   sections:(h.match(/<section/g)||[]).length,noStore:(r.headers.get('cache-control')||'').includes('no-store'),
   userMeta:h.match(/<meta name="description" content="([^"]*)"/)?.[1]?.length||0});
}
console.log('R88_PUBLIC_PAGES',JSON.stringify({sitemapCount:ids.length,checked:works.length,
  passes:works.filter(w=>w.status===200&&w.hasTable&&w.noStore).length,works}));
const generic=await safe('/work/does-not-exist');
console.log('R88_SAFETY',JSON.stringify({unknownWorkHttp:generic.code,
  homepageFirstH1:results[0].h1,homeInitialGuidePresent:(await safe('/')).body.includes('id="r87HomeGuide"'),
  discoverEditorialPresent:(await safe('/discover.html')).body.includes('r87EditorialTitle')}));
for(const browserType of [chromium,webkit]){
 const browser=await browserType.launch({headless:true});
 try{
  for(const width of [390,1180]){
   const ctx=await browser.newContext({viewport:{width,height:850},locale:'en-US',
     isMobile:width<700,hasTouch:width<700});
   await ctx.route('**/*',route=>{
     const u=new URL(route.request().url());
     if(u.hostname!=='127.0.0.1'||route.request().method()!=='GET')return route.abort();
     return route.continue();
   });
   const page=await ctx.newPage();
   const errors=[];
   page.on('pageerror',error=>errors.push(String(error.message).slice(0,300)));
   let h=await page.goto(LOCAL+'/index.html?lang=en',{waitUntil:'domcontentloaded',timeout:20000});
   const home=await page.evaluate(()=>{
     const guide=document.querySelector('#r87HomeGuide');
     const tab=document.querySelector('#extLauncher');
     const h1=[...document.querySelectorAll('h1')];
     return {language:document.documentElement.lang,guideInDom:!!guide,
       guideVisible:!!guide?.getClientRects().length,
       h1Visible:h1.filter(n=>!!n.getClientRects().length).length,
       launcherVisible:!!tab?.getClientRects().length,
       guideJapanese:guide?.textContent?.includes('採点をグラフ・ランキング'),
       bodyTextVisible:document.body.innerText?.length,
       overflow:document.documentElement.scrollWidth-innerWidth};
   });
   let expansion={status:'not tried'};
   if(width>700){
    try{
     await page.locator('#extLauncher').click({timeout:8000});
     expansion={opened:await page.locator('#r87HomeGuide').isVisible()};
     await page.locator('#extClose').click();
    }catch(e){expansion={error:String(e.message).slice(0,160)}}
   }else{
    try{
     await page.frameLocator('#basicFrame').locator('#r80VisualsBtn').click({timeout:8000});
     expansion={opened:await page.locator('#r87HomeGuide').isVisible()};
    }catch(e){expansion={error:String(e.message).slice(0,160)}}
   }
   const d=await page.goto(LOCAL+'/discover.html?lang=en',{waitUntil:'domcontentloaded',timeout:20000});
   const discover=await page.evaluate(()=>{
    const editorial=document.querySelector('.r87Editorial');
    const links=[...editorial.querySelectorAll('a[href]')].map(n=>n.getAttribute('href'));
    return {language:document.documentElement.lang,editorialJapanese:editorial.textContent.includes('グラフの使い道'),
      editorialEnglish:editorial.textContent.includes('Explore chart uses'),
      editorialLinks:links,images:editorial.querySelectorAll('img').length,
      grid:!!document.querySelector('#grid'),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   console.log('R88_BROWSER',JSON.stringify({engine:browserType.name(),width,home,expansion,discover,pageErrors:errors}));
   await ctx.close();
  }
 }finally{await browser.close()}
}
console.log('R88 AUDIT COMPLETE: read-only fresh production pages, live public data, independent local WebKit/Chromium UX observations');
