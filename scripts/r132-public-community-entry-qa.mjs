import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const publishedId='071a2bf3-2a17-490d-a2f5-b5b0a5832438';
const lockedId='8a6fec8a-dec2-4764-b5c0-91cebf2a0481';
let upstream=0,fail=false,permissions={show_community:true,allow_ratings:true};
let lang='ja';
const saved=globalThis.fetch;
globalThis.fetch=async url=>{
  const u=new URL(String(url));upstream++;
  assert.equal(u.hostname,'ibpdxbeltdwkquowjeay.supabase.co');
  assert.equal(u.searchParams.get('visibility'),'eq.public',
    'Never bypass visibility or RLS for participation entry');
  assert.equal(u.searchParams.get('limit'),'1');
  const projection=u.searchParams.get('select')||'';
  if(projection!=='id'){
    assert(projection.includes('show_community'),'Only actual author-enabled works can show CTA');
    assert(projection.includes('allow_ratings'),'Community participation also needs ratings allowed');
    assert(!projection.includes('snapshot,')&&!projection.startsWith('snapshot,'),
      'Never request an entire snapshot to determine CTA eligibility');
  }
  if(fail)return new Response('unavailable',{status:502});
  if(u.searchParams.get('id')==='eq.'+lockedId)return Response.json([]);
  const work={
    id:publishedId,title:'Comparison & <script>alert(1)</script>',
    description:'Compare rated works.',visibility:'public',
    language_code:lang,published_at:'2026-11-09T08:00:00Z',
    ...permissions,
    seo_row_0:'A',seo_row_1:'B',seo_row_2:'C',
    seo_metric_0:'Attack',seo_metric_1:'Defense',seo_metric_2:'Speed',
    seo_scores_0:[9,8,7],seo_scores_1:[7,8,9],seo_scores_2:[5,6,7],
    seo_scale:'10'
  };
  return Response.json([work]);
};
const env={ASSETS:{async fetch(){throw Error('Unexpected static path')}}};
const get=(id=publishedId)=>worker.fetch(new Request('https://statsmaker.app/work/'+id),env);
try{
  let res=await get();assert.equal(res.status,200);
  assert.equal(res.headers.get('Cache-Control'),'no-store');
  let html=await res.text();
  const join='https://statsmaker.app/index.html?community='+publishedId;
  assert(html.includes('<a class="communityJoin" href="'+join+'">この比較に自分も採点する</a>'),
    'Author-enabled Community work must offer a working rating entry');
  assert(html.includes('作成者がみんなで採点を許可している作品です。'));
  assert(html.includes('集計結果は参加人数などの条件によって表示されます。'),
    'Do not promise community results before participation threshold');
  assert(html.includes('公開スコアをグラフで比較'),'Keep original SEO score charts');
  assert(html.includes('公開作品の採点データ'),'Keep all original SEO score excerpts');
  assert(!html.includes('<script>alert(1)</script>'),'Escape user-supplied titles');

  permissions.allow_ratings=false;
  res=await get();html=await res.text();
  assert(!html.includes('communityJoin')&&!html.includes('seoJoinNote'),
    'Rating-disabled works must not invite submissions');
  assert(html.includes('評価結果・ランキングを見る'),
    'Standard open action must remain for non-participating works');

  permissions.allow_ratings=true;permissions.show_community=false;
  html=await (await get()).text();
  assert(!html.includes('communityJoin'),'Community-disabled works must not invite ratings');

  permissions={show_community:true,allow_ratings:true};lang='en';
  html=await (await get()).text();
  assert(html.includes('Add your ratings to this comparison'));
  assert(html.includes('Submit your own scores'));
  assert(html.includes('participation thresholds'));
  assert(html.includes('href="'+join+'"'));
  assert(!html.includes('この比較に自分も採点する'));

  const missing=await get(lockedId);
  assert.equal(missing.status,404,'Private and Unlisted must not appear as indexed Public works');
  assert(!((await missing.text()).includes('communityJoin')));

  fail=true;
  res=await get();
  assert.equal(res.status,503,'Supabase outage must not create cached participation links');
  assert.equal(res.headers.get('Cache-Control'),'no-store');
  assert(upstream<=7,'No additional network request was introduced per work');
  console.log('R132 PASS: live participation link shape, Public-only permissions, optional CTA, JA/EN, no misleading participant promise, fail-closed');
}finally{globalThis.fetch=saved}
