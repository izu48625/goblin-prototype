/* R34: public-only indexable work pages + bounded search sitemaps.
 * Every database lookup is anon/public RLS with visibility=eq.public.
 * No privileged key, analytics, Supabase mutation or paid component.
 */
const ORIGIN='https://statsmaker.app';
const API='https://ibpdxbeltdwkquowjeay.supabase.co/rest/v1/topics';
const KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';
const PER_PAGE=200,MAX_SITEMAP_PAGES=250;
// R65: request only the FIRST 18 target names and 10 criterion entries used
// by the SEO HTML. Never transfer scores/images/the whole published snapshot.
// PostgREST supports -> and ->> nested JSON projections.
const SEO_ROW_COUNT=18,SEO_METRIC_COUNT=10;
// Bounded public excerpt: six subject score arrays, at most five displayed columns.
const SEO_SCORE_ROWS=6,SEO_SCORE_COLUMNS=5;
const SEO_PROJECTION=[
  'id','title','description','language_code','published_at',
  'snapshot_updated_at','visibility',
  ...Array.from({length:SEO_ROW_COUNT},(_,i)=>'seo_row_'+i+':snapshot->rows->'+i+'->>name'),
  ...Array.from({length:SEO_METRIC_COUNT},(_,i)=>'seo_metric_'+i+':snapshot->criteria->'+i),
  ...Array.from({length:SEO_SCORE_ROWS},(_,i)=>'seo_scores_'+i+':snapshot->rows->'+i+'->scores'),
  'seo_scale:snapshot->>scale'
].join(',');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=x=>String(x??'').replace(/\s+/g,' ').trim();
const trim=(x,max=190)=>clean(x).slice(0,max);
const headers={apikey:KEY,Authorization:'Bearer '+KEY};
const safeId=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||'')?value:null;
const xmlHead='<?xml version="1.0" encoding="UTF-8"?>';
const xml=x=>esc(x);
function response(body,type,status=200,cache='public, max-age=0, s-maxage=300'){
  return new Response(body,{status,headers:{
    'Content-Type':type,'Cache-Control':cache,'X-Content-Type-Options':'nosniff'
  }});
}
async function publicQuery(query){
  const result=await fetch(API+'?'+query.toString(),{headers});
  if(!result.ok)throw new Error('SEO public query HTTP '+result.status);
  const data=await result.json();
  return {data,range:result.headers.get('Content-Range')||''};
}
// HEAD crawlers need only status and visibility, not 28 projected fields or
// snapshot content. Still check live Public RLS for immediate revocation.
export async function publicWorkHead(id){
  const valid=safeId(id);
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'};
  if(!valid)return new Response(null,{status:404,headers});
  const query=new URLSearchParams({select:'id',id:'eq.'+valid,visibility:'eq.public',limit:'1'});
  let rows;
  try{({data:rows}=await publicQuery(query))}
  catch(error){
    console.error('[R65 SEO] HEAD Public existence check failed',String(error));
    return new Response(null,{status:503,headers});
  }
  return new Response(null,{status:Array.isArray(rows)&&rows[0]?200:404,headers});
}

export async function publicWorkHtml(id){
  const valid=safeId(id);
  if(!valid)return response('<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Not found</body></html>','text/html; charset=utf-8',404,'no-store');
  const query=new URLSearchParams({select:SEO_PROJECTION,id:'eq.'+valid,visibility:'eq.public',limit:'1'});
  let rows;
  try{({data:rows}=await publicQuery(query))}catch(error){
    console.error('[R34 SEO] public work query failed',String(error));
    return response('Service temporarily unavailable','text/plain; charset=utf-8',503,'no-store');
  }
  const work=Array.isArray(rows)?rows[0]:null;
  if(!work)return response('<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Not found</body></html>','text/html; charset=utf-8',404,'no-store');
  const lang=work.language_code==='en'?'en':'ja',en=lang==='en';
  const title=trim(work.title,140)||'Untitled work';
  // The legacy snapshot branch keeps test/old mock compatibility; the live
  // projection above never requests the complete snapshot.
  const snapshot=work.snapshot&&typeof work.snapshot==='object'&&!Array.isArray(work.snapshot)?work.snapshot:null;
  const list=(snapshot&&Array.isArray(snapshot.rows)
    ?snapshot.rows.slice(0,SEO_ROW_COUNT).map(row=>trim(row?.name,90))
    :Array.from({length:SEO_ROW_COUNT},(_,i)=>trim(work['seo_row_'+i],90)))
    .filter(Boolean);
  const metrics=(snapshot&&Array.isArray(snapshot.criteria)
    ?snapshot.criteria.slice(0,SEO_METRIC_COUNT)
    :Array.from({length:SEO_METRIC_COUNT},(_,i)=>work['seo_metric_'+i]))
    .map(row=>trim(typeof row==='string'?row:row?.name,90)).filter(Boolean);
  // Keep the author's own description exactly as written (up to the
  // existing display limit). Only a missing description gets a truthful
  // summary derived from this currently Public work's real snapshot.
  // Never invent scores, opinions, category labels or translations.
  const fallback=en
    ?[list.length?'Compare '+list.slice(0,3).join(', ')+'.':'',
       metrics.length?'Rating criteria: '+metrics.slice(0,3).join(', ')+'.':'']
       .filter(Boolean).join(' ')
    :[list.length?'比較対象：'+list.slice(0,3).join('・')+'。':'',
       metrics.length?'評価項目：'+metrics.slice(0,3).join('・')+'。':'']
       .filter(Boolean).join(' ');
  const desc=trim(work.description,240)||trim(fallback,240)||(en
    ?'Explore a public comparison and rating sheet made with Stats Maker.'
    :'Stats Makerで作成された公開評価・比較シートです。');
  const canonical=ORIGIN+'/work/'+encodeURIComponent(id);
  const viewer=ORIGIN+'/public.html?id='+encodeURIComponent(id);
  // Links are created from server-owned host + validated UUID only.
  const titleText=title+' | Stats Maker';
  const intro=en?'Public rating sheet':'公開評価・比較シート';
  const open=en?'Explore ratings and rankings':'評価結果・ランキングを見る';
  const make=en?'Create your own charts':'自分のグラフを作る';
  const itemLabel=en?'Compared items':'比較対象';
  const metricLabel=en?'Rating criteria':'評価項目';
  const listHtml=items=>items.map(item=>'<li>'+esc(item)+'</li>').join('');
  // Read a bounded, genuine excerpt. Missing scores stay missing (never zero).
  // All cells belong to the same current Public-only Supabase response.
  const scoreRows=(snapshot&&Array.isArray(snapshot.rows)
    ?snapshot.rows.slice(0,SEO_SCORE_ROWS).map(row=>Array.isArray(row?.scores)?row.scores:[])
    :Array.from({length:SEO_SCORE_ROWS},(_,i)=>work['seo_scores_'+i]))
    .map(row=>Array.isArray(row)?row:[]);
  const scoreScale=Number(snapshot?.scale??work.seo_scale);
  const validScale=scoreScale===10||scoreScale===100?scoreScale:null;
  const displayMetrics=metrics.slice(0,SEO_SCORE_COLUMNS);
  const displaySubjects=list.slice(0,SEO_SCORE_ROWS);
  const tableRows=displaySubjects.map((name,index)=>{
    const scores=scoreRows[index]||[];
    return '<tr><th scope="row">'+esc(name)+'</th>'+displayMetrics.map((_,metricIndex)=>{
      const raw=scores[metricIndex];
      const valid=(typeof raw==='number'&&Number.isFinite(raw)
        &&raw>=0&&raw<=100)||(typeof raw==='string'&&raw.trim()!==''&&Number.isFinite(Number(raw))
        &&Number(raw)>=0&&Number(raw)<=100);
      return '<td>'+(valid?esc(String(raw)):'—')+'</td>';
    }).join('')+'</tr>';
  });
  const scoreTable=displayMetrics.length&&displaySubjects.length&&scoreRows.some(row=>row.length>0)
    ?'<section class="seoScores"><h2>'+(en?'Published rating excerpt':'公開作品の採点データ')+'</h2>'+
      '<p>'+(en?'Scores reflect the creator’s assessment, not independently measured facts.':'点数は投稿者による評価で、客観的な実測値ではありません。')+
      (validScale?' '+(en?'Maximum score: ':'満点：')+validScale+(en?' points.':'点。'):'')+
      (list.length>SEO_SCORE_ROWS||metrics.length>SEO_SCORE_COLUMNS
        ?' '+(en?'Showing up to six subjects and five criteria; open the work for all values.':'先頭6対象・5項目までを表示しています。全体は作品画面で確認できます。'):'')+
      '</p><div class="seoTableScroll" role="region" tabindex="0" aria-label="'+(en?'Public score table':'公開作品の採点表')+'">'+
      '<table><thead><tr><th scope="col">'+(en?'Subject':'比較対象')+'</th>'+
      displayMetrics.map(m=>'<th scope="col">'+esc(m)+'</th>').join('')+
      '</tr></thead><tbody>'+tableRows.join('')+'</tbody></table></div></section>':'';
  const insights=publicScoreInsights(displaySubjects,displayMetrics,scoreRows,lang,validScale||100);
  const insightHtml=insights.length
    ?'<section class="seoInsights"><h2>'+(en?'How to interpret these scores':'採点結果から読み取れること')+'</h2>'+
      '<p>'+(en?'Calculated only from the scored subjects and criteria in the excerpt above. These are creator-entered ratings, not verified objective measurements.'
                :'上の表に表示した範囲の採点値から計算しています。投稿者の評価をもとにした比較であり、客観的な実測・公式評価ではありません。')+'</p>'+
      '<ul>'+insights.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
      '<p><a href="'+ORIGIN+(en?'/en/scoring-guide.html':'/ja/scoring-guide.html')+'">'+
       (en?'Learn how to compare ratings and choose weights':'採点基準と重み付けの考え方を見る')+'</a></p></section>':'';
  // Do not fabricate an English translation of Japanese user content.
  // Only genuinely English-authored works use lang=en.
  const jsonld=JSON.stringify({
    '@context':'https://schema.org','@type':'WebPage',
    name:titleText,description:desc,inLanguage:lang,url:canonical,
    isPartOf:{'@type':'WebSite',name:'Stats Maker',url:ORIGIN+'/'}
  }).replace(/</g,'\\u003c');
  const last=work.snapshot_updated_at||work.published_at;
  const ogImage=ORIGIN+'/api/og?id='+encodeURIComponent(id)+(last?'&v='+encodeURIComponent(String(last)):'');
  const html='<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="robots" content="index,follow">'+
    '<title>'+esc(titleText)+'</title><meta name="description" content="'+esc(desc)+'">'+
    '<link rel="canonical" href="'+canonical+'">'+
    '<meta property="og:type" content="article"><meta property="og:site_name" content="Stats Maker">'+
    '<meta property="og:title" content="'+esc(titleText)+'"><meta property="og:description" content="'+esc(desc)+'">'+
    '<meta property="og:url" content="'+canonical+'"><meta property="og:image" content="'+esc(ogImage)+'">'+
    '<meta name="twitter:card" content="summary_large_image">'+
    '<script type="application/ld+json">'+jsonld+'</script>'+
    '<style>*{box-sizing:border-box}body{margin:0;background:#07101f;color:#edf4ff;font:16px/1.65 system-ui,-apple-system,sans-serif}header,main,footer{width:min(900px,calc(100% - 32px));margin:auto}header{padding:24px 0 14px}a{color:#a9c8ff}h1{font-size:clamp(25px,5vw,36px);line-height:1.3;overflow-wrap:anywhere}h2{font-size:19px;margin-bottom:4px}p{color:#bfcee2}section{background:#101f34;border:1px solid #294463;border-radius:14px;padding:16px 21px;margin:20px 0}ul{display:grid;gap:7px;padding-left:20px}li{overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:10px}.actions a{display:inline-block;padding:12px 16px;border-radius:10px;background:#315cab;color:white;text-decoration:none;font-weight:800}.actions a.secondary{background:#203951}.seoTableScroll{overflow-x:auto;max-width:100%}.seoScores table{border-collapse:collapse;min-width:440px;width:100%;font-size:14px}.seoScores th,.seoScores td{padding:9px 10px;border-bottom:1px solid #30465e;text-align:right}.seoScores th:first-child{text-align:left;white-space:nowrap}.seoScores thead th{background:#263b55}footer{padding:24px 0 48px;font-size:14px}</style>'+
    '</head><body><header><a href="'+ORIGIN+'/">Stats Maker</a> / <a href="'+ORIGIN+'/discover">'+(en?'Browse works':'作品を探す')+'</a></header>'+
    '<main><p>'+intro+'</p><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p>'+
    '<div class="actions"><a href="'+viewer+'">'+open+'</a><a class="secondary" href="'+ORIGIN+(en?'/en/':'/ja/')+'">'+make+'</a></div>'+
    (list.length?'<section><h2>'+itemLabel+'</h2><ul>'+listHtml(list)+'</ul></section>':'')+
    (metrics.length?'<section><h2>'+metricLabel+'</h2><ul>'+listHtml(metrics)+'</ul></section>':'')+
    scoreTable+insightHtml+
    '</main><footer>Stats Maker — '+(en?'Charts, comparisons and ratings':'グラフ・評価・比較')+
    ' · <a href="'+viewer+'">'+open+'</a>'+
    ' · <a href="'+ORIGIN+(en?'/en/legal.html#terms':'/ja/legal.html#terms')+'">'+(en?'Terms':'利用規約')+'</a>'+
    ' · <a href="'+ORIGIN+(en?'/en/legal.html#privacy':'/ja/legal.html#privacy')+'">'+(en?'Privacy':'プライバシー')+'</a>'+
    ' · <a href="'+ORIGIN+(en?'/en/legal.html#contact':'/ja/legal.html#contact')+'">'+(en?'Contact':'お問い合わせ')+'</a>'+
    '</footer></body></html>';
  // no-store is important: a formerly public work must not remain cached
  // after its owner switches it to private/unlisted.
  return response(html,'text/html; charset=utf-8',200,'no-store');
}

// R96: grounded, bounded editorial interpretation of the actual Public scores.
// Inputs are the same six-by-five, Public-only projection used for the score table.
// No author metadata, visibility, category, or database records are ever changed.
export function publicScoreInsights(subjects,criteria,scoreRows,lang='ja',scale=100){
  const en=lang==='en';
  const max=scale===10?10:100;
  const out=[];
  if(!Array.isArray(subjects)||!Array.isArray(criteria)||!Array.isArray(scoreRows))return out;
  for(let j=0;j<Math.min(3,criteria.length);j++){
    const criterion=trim(criteria[j],90);
    if(!criterion)continue;
    const scores=[];
    for(let i=0;i<Math.min(6,subjects.length);i++){
      const name=trim(subjects[i],90),raw=scoreRows[i]?.[j];
      if(!name||raw===null||raw===undefined||raw===''||typeof raw==='boolean')continue;
      const value=typeof raw==='number'?raw:typeof raw==='string'?Number(raw):NaN;
      if(!Number.isFinite(value)||value<0||value>max)continue;
      scores.push({name,value});
    }
    if(scores.length<2)continue;
    const hi=Math.max(...scores.map(x=>x.value)),lo=Math.min(...scores.map(x=>x.value));
    const f=n=>String(Number(n.toFixed(2)));
    const tops=scores.filter(x=>x.value===hi).map(x=>x.name);
    const lows=scores.filter(x=>x.value===lo).map(x=>x.name);
    if(hi===lo){
      out.push(en
        ?criterion+': all '+scores.length+' rated subjects have '+f(hi)+' points (a tie).'
        :criterion+'：採点済み'+scores.length+'対象がすべて'+f(hi)+'点で同点です。');
    }else{
      // Compact named range, not an overall or official judgment.
      const names=a=>a.slice(0,2).join(en?', ':'・')+(a.length>2?(en?' and others':'ほか'):'');
      out.push(en
        ?criterion+': '+names(tops)+' lead'+(tops.length===1?'s':'')+' with '+f(hi)+'; '+names(lows)+' '+(lows.length===1?'has':'have')+' '+f(lo)+' (spread '+f(hi-lo)+' points).'
        :criterion+'：最高は'+names(tops)+'の'+f(hi)+'点、最低は'+names(lows)+'の'+f(lo)+'点。差は'+f(hi-lo)+'点です。');
    }
  }
  return out;
}

const sitemapWrap=(content)=>xmlHead+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+content+'</urlset>';
const sitemapLoc=(loc,last)=>{
  const updated=/^\d{4}-\d\d-\d\d/.test(String(last||''))?String(last).slice(0,10):'';
  return '<url><loc>'+xml(loc)+'</loc>'+(updated?'<lastmod>'+updated+'</lastmod>':'')+'</url>';
};
export function staticSitemap(){
  return response(sitemapWrap(['/ja/','/en/','/ja/chart-guide.html','/en/chart-guide.html','/ja/png-guide.html','/en/png-guide.html','/ja/examples.html','/en/examples.html','/ja/scoring-guide.html','/en/scoring-guide.html','/ja/use-cases.html','/en/use-cases.html','/discover'].map(p=>sitemapLoc(ORIGIN+p)).join('')),'application/xml; charset=utf-8');
}
export async function sitemapIndex(){
  let count;
  try{
    const q=new URLSearchParams({select:'id',visibility:'eq.public',limit:'1'});
    const r=await fetch(API+'?'+q.toString(),{headers:{...headers,Prefer:'count=exact'}});
    if(!r.ok)throw new Error('SEO sitemap count '+r.status);
    const match=(r.headers.get('Content-Range')||'').match(/\/(\d+)$/);
    if(!match)throw new Error('Missing public topic count');
    count=Number(match[1]);
  }catch(e){console.error('[R34 SEO] sitemap count error',String(e));return response('Sitemap temporarily unavailable','text/plain; charset=utf-8',503,'no-store')}
  const total=Math.min(MAX_SITEMAP_PAGES,Math.ceil(count/PER_PAGE));
  const entries=['<sitemap><loc>'+ORIGIN+'/sitemap-static.xml</loc></sitemap>'];
  for(let i=1;i<=total;i++)entries.push('<sitemap><loc>'+ORIGIN+'/sitemap-works-'+i+'.xml</loc></sitemap>');
  return response(xmlHead+'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.join('')+'</sitemapindex>','application/xml; charset=utf-8');
}
export async function workSitemap(page){
  const p=Number(page);
  if(!Number.isSafeInteger(p)||p<1||p>MAX_SITEMAP_PAGES)
    return response('Not found','text/plain; charset=utf-8',404,'no-store');
  const q=new URLSearchParams({
    select:'id,visibility,snapshot_updated_at,published_at',visibility:'eq.public',
    order:'id.asc',limit:String(PER_PAGE),offset:String((p-1)*PER_PAGE)
  });
  let rows;try{({data:rows}=await publicQuery(q))}
  catch(e){console.error('[R34 SEO] works sitemap failed',String(e));return response('Sitemap temporarily unavailable','text/plain; charset=utf-8',503,'no-store')}
  const contents=(Array.isArray(rows)?rows:[]).filter(t=>t.visibility==='public'&&safeId(t.id))
    .map(t=>sitemapLoc(ORIGIN+'/work/'+encodeURIComponent(t.id),t.snapshot_updated_at||t.published_at)).join('');
  return response(sitemapWrap(contents),'application/xml; charset=utf-8');
}
