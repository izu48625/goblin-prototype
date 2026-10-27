// Read-only AdSense/SEO user journey audit against actual production, no DB or advertising writes.
const root='https://statsmaker.app';
const paths=[
  '/','/index.html','/ja/','/en/',
  '/ja/use-cases.html','/en/use-cases.html',
  '/ja/examples.html','/en/examples.html',
  '/ja/scoring-guide.html','/en/scoring-guide.html',
  '/ja/chart-guide.html','/en/chart-guide.html',
  '/ja/png-guide.html','/en/png-guide.html',
  '/ja/legal.html','/en/legal.html',
  '/discover.html',
  '/robots.txt','/ads.txt','/sitemap.xml','/sitemap-static.xml','/sitemap-works-1.xml',
  '/work/b879b7c4-7470-416e-89b4-c682a09a49fa',
  '/work/1eed295e-9a79-449d-9fd7-e4405e0ae426',
  '/cloud/global-locale.js?v=r85examples1'
];
async function probe(path){
  let error='';
  try{
    const r=await fetch(root+path,{redirect:'follow',signal:AbortSignal.timeout(12500),headers:{'cache-control':'no-cache','user-agent':'Mozilla/5.0 (compatible; StatsMakerReadOnlyAudit/1.0)'}});
    const s=await r.text();
    const title=s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';
    const description=s.match(/<meta name="description" content="([^"]*)"/i)?.[1]||'';
    const robotsMeta=s.match(/<meta name="robots" content="([^"]*)"/i)?.[1]||'';
    const canonical=s.match(/<link rel="canonical" href="([^"]*)"/i)?.[1]||'';
    const h1=(s.match(/<h1\b/gi)||[]).length;
    const paragraphs=(s.match(/<p\b/gi)||[]).length;
    const images=(s.match(/<img\b/gi)||[]).length;
    const internalLinks=(s.match(/<a\s[^>]*href="\/[^"]*"/gi)||[]).length;
    const adsMeta=s.includes('ca-pub-2734957009365610');
    const htmlText=s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const latestUseCase=path.includes('use-cases')?['usecase-cafe.png','usecase-routes.png','usecase-study.png','usecase-plan.png','usecase-hero.png'].every(x=>s.includes(x)):null;
    return {path,status:r.status,type:r.headers.get('content-type')||'',bytes:s.length,title:title.slice(0,90),descriptionChars:description.length,robots:robotsMeta,xRobots:r.headers.get('x-robots-tag')||'',canonical,h1,paragraphs,images,internalLinks,visibleTextChars:htmlText.length,adsMeta,hasAdsScript:/adsbygoogle\.js/i.test(s),hasGA4:/googletagmanager\.com|google-analytics\.com/i.test(s),hasAllFiveExamples:latestUseCase,hasLinkToNewExamples:s.includes('/ja/use-cases.html')||s.includes('/en/use-cases.html'),hasPublicIndex:s.includes('/work/'),preview:s.slice(0,155).replace(/\n/g,' '),sitemapHasStatic:s.includes('sitemap-static.xml'),sitemapHasWorks:s.includes('sitemap-works-1.xml'),exampleImageUrls:s.includes('example-images'),isBotBlocked:/cf-chl|just a moment|access denied/i.test(s),adstxtPublisher:path==='/ads.txt'?s.trim():undefined};
  }catch(e){error=String(e.message);return {path,error};}
}
const results=await Promise.all(paths.map(probe));
for(const r of results)console.log('AUDIT_ROUTE '+JSON.stringify(r));
const flagged=results.filter(x=>x.error||x.status!==200);
console.log('AUDIT_SUMMARY '+JSON.stringify({total:results.length,non200:flagged.map(x=>({path:x.path,status:x.status,error:x.error})),seenTitle:results.filter(x=>x.title).length,rootInitialHtml:results.find(x=>x.path==='/'),indexedPublic:results.filter(x=>x.path.startsWith('/work/')).map(x=>({path:x.path,status:x.status,title:x.title,robots:x.robots,canonical:x.canonical}))}));
if(flagged.length)process.exitCode=1;
