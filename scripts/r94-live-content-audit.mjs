const site='https://statsmaker.app';
const publicIds=[
'1eed295e-9a79-449d-9fd7-e4405e0ae426',
'a2ca13fa-48b8-42b6-bbd2-b4945acf3aba',
'2d263df1-17d2-433a-947c-c2b55b6dbecc',
'20dbd99d-d8ca-4254-88bc-3753f597b93a',
'57b432ed-fbf2-4261-b57d-9e0f27356d2e',
'5ffb1644-b5f8-434f-b216-27012c90bbfe',
'336d4f99-a9a3-4c12-964d-082a589bdf4c',
'8a6fec8a-dec2-4764-b5c0-91cebf2a0481',
'071a2bf3-2a17-490d-a2f5-b5b0a5832438',
'2582c53e-7f4e-47b1-a34b-0986e43ea218',
'b879b7c4-7470-416e-89b4-c682a09a49fa'];
const editorial=['/','/ja/','/en/','/discover','/ja/use-cases.html','/en/use-cases.html','/ja/examples.html','/en/examples.html','/ja/scoring-guide.html','/en/scoring-guide.html','/ja/chart-guide.html','/en/chart-guide.html','/ja/png-guide.html','/en/png-guide.html'];
const textOf=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi,' ').replace(/\s+/g,' ').trim();
const match=(s,re)=>re.exec(s)?.[1]||'';
async function fetchGet(path){
 let lastError;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(site+path,{redirect:'follow',signal:AbortSignal.timeout(18000),headers:{'Cache-Control':'no-cache'}});
   const body=await response.text();
   if(response.status>=500&&attempt<3){await new Promise(r=>setTimeout(r,600*attempt));continue;}
   return {path,status:response.status,finalUrl:response.url,body,headers:response.headers};
  }catch(error){lastError=error; if(attempt<3)await new Promise(r=>setTimeout(r,600*attempt));}
 }
 return {path,status:-1,body:'',error:String(lastError)};
}
// R95 release gate: the deployed root is allowed to lag the GitHub main merge.
for(let i=1;i<=24;i++){
 const response=await fetchGet('/');
 const h1Count=(response.body||'').split('<h1').length-1;
 if(response.status===200&&h1Count===1){console.log('R95 deployment detected after attempt',i);break;}
 if(i===24)throw new Error('R95 has not reached production: home H1='+h1Count+' status='+response.status);
 await new Promise(resolve=>setTimeout(resolve,15000));
}
const paths=[...editorial,...publicIds.map(id=>'/work/'+id),'/work/00000000-0000-4000-8000-000000000000','/robots.txt','/sitemap.xml','/sitemap-static.xml','/sitemap-works-1.xml'];
const records=[];
for(let i=0;i<paths.length;i+=4){
 const batch=await Promise.all(paths.slice(i,i+4).map(fetchGet));records.push(...batch);
}
const publicRecords=records.filter(r=>r.path.startsWith('/work/')&&r.path.includes('-')&&r.status===200);
const results=records.map(r=>{
 const html=r.body||'';
 const h1=[...html.matchAll(/<h1\b/gi)].length;
 const meta=match(html,/<meta\s+name=["']description["']\s+content=["']([^"']*)/i);
 const canonical=match(html,/<link\s+rel=["']canonical["']\s+href=["']([^"']*)/i);
 const robots=match(html,/<meta\s+name=["']robots["']\s+content=["']([^"']*)/i);
 return {path:r.path,status:r.status,final:r.finalUrl,bytes:html.length,h1,visibleTextChars:textOf(html).length,title:match(html,/<title[^>]*>([^<]*)<\/title>/i),metaDescChars:meta.length,canonical,robots,hasDataTable:/<table\b/i.test(html),error:r.error||null};
});
console.log('R94 LIVE META REPORT',JSON.stringify(results,null,2));
const broken=results.filter(r=>r.status!==200 && !r.path.includes('00000000-0000'));
const thin=results.filter(r=>editorial.includes(r.path)&&r.status===200&&r.visibleTextChars<500);
const rootH1=results.find(r=>r.path==='/')?.h1;
const sitemapIndex=records.find(r=>r.path==='/sitemap.xml')?.body||'';
const staticSitemap=records.find(r=>r.path==='/sitemap-static.xml')?.body||'';
const workSitemap=records.find(r=>r.path==='/sitemap-works-1.xml')?.body||'';
const missingIds=publicIds.filter(id=>!workSitemap.includes(id));
const privacy=results.find(r=>r.path==='/work/00000000-0000-4000-8000-000000000000');
const warnings=[];
if(rootH1!==1)warnings.push('Root home expected one H1, got '+rootH1);
if(thin.length)warnings.push('Low visible copy on '+thin.map(x=>x.path).join(','));
if(missingIds.length)warnings.push('Not in work sitemap '+missingIds.join(','));
if(!staticSitemap.includes('/ja/use-cases.html'))warnings.push('JA examples absent in static sitemap');
if(!staticSitemap.includes('/en/use-cases.html'))warnings.push('EN examples absent in static sitemap');
if(!sitemapIndex.includes('sitemap-static.xml'))warnings.push('Sitemap index lacks static sitemap');
if(!(privacy?.status===404 && /noindex/i.test(privacy?.robots||records.find(x=>x.path===privacy?.path)?.body||'')))warnings.push('Unknown work is not explicit 404 noindex');
const metrics={editorialTotal:editorial.length,editorialOk:results.filter(r=>editorial.includes(r.path)&&r.status===200).length,publicTotal:publicIds.length,publicOk:publicRecords.length,publicWithTable:results.filter(r=>r.path.startsWith('/work/')&&r.status===200&&r.hasDataTable).length,missingIds,broken,warnings,workSitemapEntries:(workSitemap.match(/<loc>/g)||[]).length,sitemapIndexLength:sitemapIndex.length};
console.log('R94 LIVE SUMMARY',JSON.stringify(metrics,null,2));
if(broken.length || publicRecords.length!==publicIds.length || missingIds.length || warnings.length || !(privacy?.status===404))process.exitCode=1;
