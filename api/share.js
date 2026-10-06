import {escapeHtml,fetchTopic,publicPageUrl,safeTopicId,topicCardData} from '../server/og-data.js';

function requestOrigin(req){
  const proto=String(req.headers?.['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=String(req.headers?.host||'').trim();
  return host?`${proto}://${host}`:'';
}

export default async function handler(req,res){
  const origin=requestOrigin(req);
  const requestUrl=new URL(req.url||'/',origin||'https://stats-maker.invalid');
  const id=safeTopicId(requestUrl.searchParams.get('id'));

  let topic=null;
  try{topic=id?await fetchTopic(id):null}catch(error){
    console.error('[Stats Maker OGP] share topic fetch failed',error);
  }

  const exists=!!topic;
  const card=exists?topicCardData(topic):{
    title:'Stats Maker',
    description:'Create, compare and share scored rankings.',
    language:'en',
    updatedAt:''
  };
  const title=exists?`${card.title} - Stats Maker`:'Stats Maker';
  const description=card.description||(
    card.language==='ja'
      ?'Stats Makerで作成された公開評価シート'
      :'A public rating sheet created with Stats Maker'
  );
  const appUrl=exists?publicPageUrl(id):'https://izu48625.github.io/goblin-prototype/';
  const shareUrl=origin&&id?`${origin}/p/${encodeURIComponent(id)}`:appUrl;
  const version=encodeURIComponent(String(card.updatedAt||Date.now()));
  const imageUrl=origin&&id?`${origin}/api/og?id=${encodeURIComponent(id)}&v=${version}`:'';

  const html=`<!doctype html>
<html lang="${escapeHtml(card.language||'ja')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="noindex,follow">
  <link rel="canonical" href="${escapeHtml(appUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Stats Maker">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  ${imageUrl?`<meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">`:''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${imageUrl?`<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`:''}
  <meta http-equiv="refresh" content="2;url=${escapeHtml(appUrl)}">
  <style>
    html,body{margin:0;min-height:100%;background:#07101f;color:#edf4ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
    main{width:min(560px,100%);padding:28px;border:1px solid #294565;border-radius:18px;background:#0d192a;text-align:center}
    b{font-size:22px}p{color:#91a5c0;line-height:1.6}a{color:#9bbcff;font-weight:800}
  </style>
</head>
<body>
  <main>
    <b>${escapeHtml(card.title)}</b>
    <p>${escapeHtml(card.language==='ja'?'Stats Makerの公開ページを開いています…':'Opening this Stats Maker work…')}</p>
    <a href="${escapeHtml(appUrl)}">${escapeHtml(card.language==='ja'?'開かない場合はこちら':'Open the public page')}</a>
  </main>
  <script>setTimeout(()=>location.replace(${JSON.stringify(appUrl)}),60);</script>
</body>
</html>`;

  res.statusCode=exists?200:404;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control',exists?'public, s-maxage=300, stale-while-revalidate=3600':'no-store');
  res.end(html);
}
