const site='https://statsmaker.app';
const ids=[
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
'b879b7c4-7470-416e-89b4-c682a09a49fa'
];
const delay=ms=>new Promise(done=>setTimeout(done,ms));
async function read(p){const response=await fetch(site+p,{redirect:'follow',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});return {status:response.status,body:await response.text()};}
let ready=false;
for(let attempt=1;attempt<=20;attempt++){
 try{const r=await read('/work/'+ids[0]);if(r.status===200&&r.body.includes('seoInsights')){ready=true;break}}
 catch(e){console.error('Deployment probe:',String(e))}
 await delay(12000);
}
if(!ready)throw Error('Production did not deploy grounded Public score insights');
const works=[];
for(const id of ids){
 const r=await read('/work/'+id);
 works.push({id:id.slice(0,8),status:r.status,hasTable:r.body.includes('seoScores'),insights:r.body.includes('seoInsights'),noIndex:r.body.includes('name="robots" content="noindex"')});
}
const editorial=[
'/','/ja/','/en/','/discover','/ja/use-cases.html','/en/use-cases.html','/ja/examples.html','/en/examples.html','/ja/scoring-guide.html','/en/scoring-guide.html','/ja/chart-guide.html','/en/chart-guide.html','/ja/png-guide.html','/en/png-guide.html'
];
let editorialOk=0;
for(const path of editorial){const x=await read(path);if(x.status===200)editorialOk++;else console.error('BAD editorial',path,x.status)}
const sitemap=await read('/sitemap-works-1.xml');
const sitemapMissing=ids.filter(id=>!sitemap.body.includes(id));
const notFound=await read('/work/00000000-0000-4000-8000-000000000000');
const metrics={allPublic:works.length,all200:works.filter(x=>x.status===200).length,
 tables:works.filter(x=>x.hasTable).length,contextual:works.filter(x=>x.insights).length,
 editorialOk,editorialTotal:editorial.length,
 sitemapMissing,unknown404:notFound.status===404,unknownNoindex:notFound.body.includes('noindex'),works};
console.log('R96 LIVE GET-ONLY AUDIT',JSON.stringify(metrics,null,2));
if(metrics.all200!==11||metrics.tables!==11||metrics.contextual<8||
 metrics.editorialOk!==editorial.length||sitemapMissing.length||
 !metrics.unknown404||!metrics.unknownNoindex)process.exitCode=1;
