const SUPABASE_URL='https://ibpdxbeltdwkquowjeay.supabase.co';
const SUPABASE_KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';
const LEGACY_OG_ORIGIN='https://stats-maker-ogp.vercel.app';

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

function safeTopicId(value){
  const id=String(value||'').trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(id)?id:'';
}

async function fetchTopic(id){
  const topicId=safeTopicId(id);
  if(!topicId)return null;
  const query=new URLSearchParams({
    select:'id,title,description,language_code,snapshot_updated_at,published_at,visibility',
    id:'eq.'+topicId,
    visibility:'in.(public,unlisted)',
    limit:'1'
  });
  const response=await fetch(SUPABASE_URL+'/rest/v1/topics?'+query.toString(),{
    headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}
  });
  if(!response.ok)throw new Error('Supabase topic fetch failed ('+response.status+')');
  const rows=await response.json();
  return Array.isArray(rows)&&rows[0]?rows[0]:null;
}

function shareHtml({origin,id,topic}){
  const exists=!!topic;
  const language=topic?.language_code==='en'?'en':'ja';
  const title=exists?String(topic.title||'Stats Maker')+' - Stats Maker':'Stats Maker';
  const description=String(topic?.description||'').trim()||(language==='ja'?'Stats Makerで作成された公開評価シート':'A public rating sheet created with Stats Maker');
  const appUrl=exists?origin+'/public.html?id='+encodeURIComponent(id)+'&v=r25p2':origin+'/';
  const shareUrl=exists?origin+'/p/'+encodeURIComponent(id):appUrl;
  const version=encodeURIComponent(String(topic?.snapshot_updated_at||topic?.published_at||Date.now()));
  const imageUrl=exists?origin+'/api/og?id='+encodeURIComponent(id)+'&v='+version:'';
  const imageMeta=imageUrl
    ?'<meta property="og:image" content="'+escapeHtml(imageUrl)+'"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/png"><meta name="twitter:image" content="'+escapeHtml(imageUrl)+'">'
    :'';
  return '<!doctype html><html lang="'+escapeHtml(language)+'"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>'+escapeHtml(title)+'</title>' +
    '<meta name="description" content="'+escapeHtml(description)+'">' +
    '<meta name="robots" content="noindex,follow">' +
    '<link rel="canonical" href="'+escapeHtml(appUrl)+'">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Stats Maker">' +
    '<meta property="og:title" content="'+escapeHtml(title)+'"><meta property="og:description" content="'+escapeHtml(description)+'"><meta property="og:url" content="'+escapeHtml(shareUrl)+'">' +
    imageMeta +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+escapeHtml(title)+'"><meta name="twitter:description" content="'+escapeHtml(description)+'">' +
    '<meta http-equiv="refresh" content="2;url='+escapeHtml(appUrl)+'">' +
    '<style>html,body{margin:0;min-height:100%;background:#07101f;color:#edf4ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}main{width:min(560px,100%);padding:28px;border:1px solid #294565;border-radius:18px;background:#0d192a;text-align:center}b{font-size:22px}p{color:#91a5c0;line-height:1.6}a{color:#9bbcff;font-weight:800}</style>' +
    '</head><body><main><b>'+escapeHtml(topic?.title||'Stats Maker')+'</b><p>'+escapeHtml(language==='ja'?'Stats Makerの公開ページを開いています…':'Opening this Stats Maker work…')+'</p><a href="'+escapeHtml(appUrl)+'">'+escapeHtml(language==='ja'?'開かない場合はこちら':'Open the public page')+'</a></main>' +
    '<script>setTimeout(function(){location.replace('+JSON.stringify(appUrl)+')},60);<\/script></body></html>';
}

async function proxyLegacyOg(request){
  const requestUrl=new URL(request.url);
  const target=new URL('/api/og',LEGACY_OG_ORIGIN);
  target.search=requestUrl.search;
  const upstream=await fetch(target.toString(),{headers:{'User-Agent':request.headers.get('User-Agent')||'Stats-Maker-Cloudflare'}});
  const headers=new Headers(upstream.headers);
  headers.set('Cache-Control','public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  headers.set('X-Stats-Maker-OG-Backend','vercel-stage1');
  return new Response(upstream.body,{status:upstream.status,headers});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/health'){
      return Response.json({ok:true,service:'stats-maker',release:'r25p2',hosting:'cloudflare-workers',ogBackend:'vercel-stage1'},{headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname==='/api/og')return proxyLegacyOg(request);
    const match=url.pathname.match(/^\/p\/([a-zA-Z0-9_-]{8,128})\/?$/);
    if(match){
      const id=safeTopicId(match[1]);
      let topic=null;
      try{topic=await fetchTopic(id)}catch(error){console.error('[Stats Maker] share fetch failed',error)}
      const html=shareHtml({origin:url.origin,id,topic});
      return new Response(html,{status:topic?200:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':topic?'public, s-maxage=300, stale-while-revalidate=3600':'no-store'}});
    }
    return env.ASSETS.fetch(request);
  }
};
