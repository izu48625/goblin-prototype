/* R34: public-only indexable work pages + bounded search sitemaps.
 * Every database lookup is anon/public RLS with visibility=eq.public.
 * No privileged key, analytics, Supabase mutation or paid component.
 */
const ORIGIN='https://statsmaker.app';
const API='https://ibpdxbeltdwkquowjeay.supabase.co/rest/v1/topics';
const KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';
const PER_PAGE=200,MAX_SITEMAP_PAGES=250;
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
export async function publicWorkHtml(id){
  const valid=safeId(id);
  if(!valid)return response('<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Not found</body></html>','text/html; charset=utf-8',404,'no-store');
  const query=new URLSearchParams({select:'id,title,description,language_code,snapshot,published_at,snapshot_updated_at,visibility',id:'eq.'+valid,visibility:'eq.public',limit:'1'});
  let rows;
  try{({data:rows}=await publicQuery(query))}catch(error){
    console.error('[R34 SEO] public work query failed',String(error));
    return response('Service temporarily unavailable','text/plain; charset=utf-8',503,'no-store');
  }
  const work=Array.isArray(rows)?rows[0]:null;
  if(!work)return response('<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Not found</body></html>','text/html; charset=utf-8',404,'no-store');
  const lang=work.language_code==='en'?'en':'ja',en=lang==='en';
  const title=trim(work.title,140)||'Untitled work';
  const snapshot=work.snapshot&&typeof work.snapshot==='object'&&!Array.isArray(work.snapshot)?work.snapshot:{};
  const list=(Array.isArray(snapshot.rows)?snapshot.rows:[]).slice(0,18)
    .map(row=>trim(row?.name,90)).filter(Boolean);
  const metrics=(Array.isArray(snapshot.criteria)?snapshot.criteria:[]).slice(0,10)
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
    '<style>*{box-sizing:border-box}body{margin:0;background:#07101f;color:#edf4ff;font:16px/1.65 system-ui,-apple-system,sans-serif}header,main,footer{width:min(900px,calc(100% - 32px));margin:auto}header{padding:24px 0 14px}a{color:#a9c8ff}h1{font-size:clamp(25px,5vw,36px);line-height:1.3;overflow-wrap:anywhere}h2{font-size:19px;margin-bottom:4px}p{color:#bfcee2}section{background:#101f34;border:1px solid #294463;border-radius:14px;padding:16px 21px;margin:20px 0}ul{display:grid;gap:7px;padding-left:20px}li{overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:10px}.actions a{display:inline-block;padding:12px 16px;border-radius:10px;background:#315cab;color:white;text-decoration:none;font-weight:800}.actions a.secondary{background:#203951}footer{padding:24px 0 48px;font-size:14px}</style>'+
    '</head><body><header><a href="'+ORIGIN+'/">Stats Maker</a> / <a href="'+ORIGIN+'/discover">'+(en?'Browse works':'作品を探す')+'</a></header>'+
    '<main><p>'+intro+'</p><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p>'+
    '<div class="actions"><a href="'+viewer+'">'+open+'</a><a class="secondary" href="'+ORIGIN+(en?'/en/':'/ja/')+'">'+make+'</a></div>'+
    (list.length?'<section><h2>'+itemLabel+'</h2><ul>'+listHtml(list)+'</ul></section>':'')+
    (metrics.length?'<section><h2>'+metricLabel+'</h2><ul>'+listHtml(metrics)+'</ul></section>':'')+
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
const sitemapWrap=(content)=>xmlHead+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+content+'</urlset>';
const sitemapLoc=(loc,last)=>{
  const updated=/^\d{4}-\d\d-\d\d/.test(String(last||''))?String(last).slice(0,10):'';
  return '<url><loc>'+xml(loc)+'</loc>'+(updated?'<lastmod>'+updated+'</lastmod>':'')+'</url>';
};
export function staticSitemap(){
  return response(sitemapWrap(['/ja/','/en/','/ja/chart-guide.html','/en/chart-guide.html','/ja/png-guide.html','/en/png-guide.html','/discover'].map(p=>sitemapLoc(ORIGIN+p)).join('')),'application/xml; charset=utf-8');
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
