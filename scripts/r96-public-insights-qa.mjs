import assert from 'node:assert/strict';
import {publicScoreInsights,publicWorkHtml} from '../worker/seo.js';

const source=publicScoreInsights(['Plan A','Plan B','Plan C'],['Fun','Budget','Transport'],
  [[9,5,8],[7,8,7],[6,9,6]],'en',10);
assert.equal(source.length,3);
assert(source[0].includes('Plan A')&&source[0].includes('9')&&source[0].includes('3 points'));
assert(source[1].includes('Plan C')&&source[1].includes('9')&&source[1].includes('4 points'));
assert.deepEqual(publicScoreInsights(['A','B'],['Power'],[[5],[5]],'ja',10),
 ['Power：採点済み2対象がすべて5点で同点です。']);
assert.equal(publicScoreInsights(['A','B'],['Power'],[[null],[5]],'ja',10).length,0,
 'Missing scores must not become zero or an invented comparison');
assert.equal(publicScoreInsights(['A','B'],['Power'],[[''],[5]],'ja',10).length,0);
assert.equal(publicScoreInsights(['A','B'],['Power'],[[false],[5]],'ja',10).length,0);
assert.equal(publicScoreInsights(['A','B'],['Power'],[[11],[5]],'ja',10).length,0,
 'Out-of-scale values must be skipped');
assert.equal(publicScoreInsights(['A','B'],['Power'],[[0],[5]],'ja',10).length,1,
 'A genuine zero rating must not disappear');

const publicId='1eed295e-9a79-449d-9fd7-e4405e0ae426';
const otherId='2582c53e-7f4e-47b1-a34b-0986e43ea218';
const originalFetch=globalThis.fetch;
const mockRows=(id)=>id===publicId?[{
 id,visibility:'public',title:'Scoring demo',language_code:'ja',
 description:'投稿者による比較です。',
 seo_row_0:'選手A',seo_row_1:'',seo_row_2:'選手C',
 seo_metric_0:{name:'速度'},seo_metric_1:{name:''},seo_metric_2:{name:'知力'},
 seo_scores_0:[9,99,3],seo_scores_1:[1,2,3],seo_scores_2:[5,8,7],
 seo_scale:'10'
}]:[];
const seen=[];
globalThis.fetch=async url=>{
 const x=new URL(String(url));
 seen.push(x);
 assert.equal(x.searchParams.get('visibility'),'eq.public','Only Public data may reach SEO');
 const select=x.searchParams.get('select')||'';
 assert(select.includes('seo_scores_0:snapshot->rows->0->scores'));
 assert(!select.includes('snapshot,'),'Avoid fetching complete snapshots');
 return Response.json(mockRows(x.searchParams.get('id')?.replace('eq.','')));
};
try{
 const result=await publicWorkHtml(publicId);
 assert.equal(result.status,200);
 const html=await result.text();
 assert(html.includes('<h2>採点結果から読み取れること</h2>'));
 assert(html.includes('速度：最高は選手Aの9点、最低は選手Cの5点。差は4点です。'));
 assert(html.includes('知力：最高は選手Cの7点、最低は選手Aの3点。差は4点です。'));
 assert(!html.includes('99</td>'),'Column index must not shift when a criterion has a blank name');
 assert(!html.includes('<td>8</td>'),'The omitted unnamed column must not enter the named table');
 assert(html.includes('/ja/scoring-guide.html'),'Offer a guide to score interpretation');
 assert.equal(html.includes('新規採点を生成'),false);
 const hidden=await publicWorkHtml(otherId);
 assert.equal(hidden.status,404,'A non-Public work must not get an indexed analysis');
 assert((await hidden.text()).includes('noindex'));
 assert.equal(seen.length,2,'No additional network calls for scoring commentary');
}finally{globalThis.fetch=originalFetch;}
console.log('R96 PASS: truthful per-criterion comparisons, alignment, missing values, and Public-only security');
