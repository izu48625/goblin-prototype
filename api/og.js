const sharp=require('sharp');

function escapeXml(value){
  return String(value??'').replace(/[<>&"']/g,ch=>({
    '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'
  }[ch]));
}

function wrapText(value,maxChars,maxLines){
  const text=String(value||'').trim();
  if(!text)return [];
  const lines=[];
  let rest=text;
  while(rest&&lines.length<maxLines){
    if(rest.length<=maxChars){
      lines.push(rest);
      rest='';
      break;
    }
    let cut=rest.lastIndexOf(' ',maxChars);
    if(cut<Math.floor(maxChars*0.55))cut=maxChars;
    lines.push(rest.slice(0,cut).trim());
    rest=rest.slice(cut).trim();
  }
  if(rest&&lines.length){
    const last=lines.length-1;
    lines[last]=(lines[last].slice(0,Math.max(1,maxChars-1)).trimEnd()+'…');
  }
  return lines;
}

function textBlock(lines,x,y,fontSize,lineHeight,fill,weight='700'){
  return lines.map((line,index)=>
    `<text x="${x}" y="${y+index*lineHeight}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" font-family="Noto Sans JP, Noto Sans CJK JP, Hiragino Sans, Yu Gothic, Arial, sans-serif">${escapeXml(line)}</text>`
  ).join('');
}

function metaBox(x,label,value){
  return `
    <rect x="${x}" y="493" width="150" height="74" rx="12" fill="#0a1728" stroke="#294768"/>
    <text x="${x+14}" y="519" font-size="13" font-weight="700" fill="#7087a6" font-family="Arial, sans-serif">${escapeXml(label)}</text>
    <text x="${x+14}" y="550" font-size="24" font-weight="800" fill="#edf4ff" font-family="Arial, sans-serif">${escapeXml(value)}</text>
  `;
}

function rankRow(item,index,y){
  const medalFill=index===0?'#244d87':'#182c48';
  const divider=index<2?'<line x1="772" y1="'+(y+58)+'" x2="1100" y2="'+(y+58)+'" stroke="#203752"/>':'';
  return `
    <rect x="772" y="${y+9}" width="34" height="34" rx="9" fill="${medalFill}"/>
    <text x="789" y="${y+32}" text-anchor="middle" font-size="16" font-weight="800" fill="#dbe8fb" font-family="Arial, sans-serif">${index+1}</text>
    <text x="820" y="${y+31}" font-size="18" font-weight="700" fill="#edf4ff" font-family="Noto Sans JP, Noto Sans CJK JP, Hiragino Sans, Yu Gothic, Arial, sans-serif">${escapeXml(String(item?.name||'').slice(0,18))}</text>
    <text x="1098" y="${y+32}" text-anchor="end" font-size="24" font-weight="800" fill="#8fb2ff" font-family="Arial, sans-serif">${escapeXml(item?.value??'')}</text>
    ${divider}
  `;
}

function renderSvg(card){
  const titleLines=wrapText(card.title||'Stats Maker',22,2);
  const descLines=wrapText(card.description||'',52,2);
  const top=(card.ranking||[]).slice(0,3);
  const titleSize=titleLines.join('').length>30?45:54;
  const targetLabel=card.language==='en'?'TARGETS':'TARGETS';
  const metricLabel=card.language==='en'?'METRICS':'METRICS';
  const scaleLabel=card.language==='en'?'SCALE':'SCALE';
  const rankingLabel=card.language==='en'?'CREATOR OVERALL TOP 3':'CREATOR OVERALL TOP 3';

  const rankings=top.length
    ?top.map((item,index)=>rankRow(item,index,150+index*82)).join('')
    :`<text x="936" y="300" text-anchor="middle" font-size="18" fill="#7186a3" font-family="Noto Sans JP, Arial, sans-serif">${card.language==='en'?'No scored data yet':'No scored data yet'}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#07101f"/>
    <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#07101f"/>
        <stop offset="58%" stop-color="#0c1b30"/>
        <stop offset="100%" stop-color="#15284a"/>
      </linearGradient>
    </defs>

    <rect x="62" y="54" width="42" height="42" rx="12" fill="#315da2"/>
    <text x="83" y="82" text-anchor="middle" font-size="22" font-weight="800" fill="#ffffff" font-family="Arial, sans-serif">S</text>
    <text x="117" y="83" font-size="20" font-weight="800" letter-spacing="2" fill="#9db9ff" font-family="Arial, sans-serif">STATS MAKER</text>

    <text x="62" y="146" font-size="16" font-weight="800" letter-spacing="2" fill="#6ddaa2" font-family="Arial, sans-serif">${escapeXml(card.category||'STATS')}</text>
    ${textBlock(titleLines,62,211,titleSize,61,'#f3f7ff','800')}
    ${textBlock(descLines,62,348,20,29,'#9fb1c9','500')}

    ${metaBox(62,targetLabel,card.targets)}
    ${metaBox(224,metricLabel,card.metrics)}
    ${metaBox(386,scaleLabel,card.scale)}

    <rect x="740" y="54" width="398" height="522" rx="24" fill="#081322" stroke="#36577d"/>
    <text x="770" y="105" font-size="15" font-weight="800" letter-spacing="1.5" fill="#879dbc" font-family="Arial, sans-serif">${rankingLabel}</text>
    ${rankings}
    <text x="1107" y="545" text-anchor="end" font-size="14" font-weight="700" fill="#657d9c" font-family="Arial, sans-serif">Created with Stats Maker</text>
  </svg>`;
}

module.exports=async function handler(request,response){
  try{
    const {fetchTopic,safeTopicId,topicCardData}=await import('../server/og-data.mjs');
    const proto=String(request.headers?.['x-forwarded-proto']||'https').split(',')[0].trim();
    const host=String(request.headers?.host||request.headers?.['x-forwarded-host']||'stats-maker-ogp.vercel.app').split(',')[0].trim();
    const url=new URL(request.url||'/api/og',`${proto}://${host}`);
    const id=safeTopicId(url.searchParams.get('id'));
    const topic=id?await fetchTopic(id):null;
    const card=topic?topicCardData(topic):{
      title:'Stats Maker',
      description:'Create, compare and share scored rankings.',
      category:'STATS',
      language:'en',
      targets:'—',
      metrics:'—',
      scale:100,
      ranking:[]
    };

    const svg=renderSvg(card);
    const png=await sharp(Buffer.from(svg))
      .png({compressionLevel:9,adaptiveFiltering:true})
      .toBuffer();

    response.statusCode=200;
    response.setHeader('Content-Type','image/png');
    response.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
    response.setHeader('Content-Length',String(png.length));
    response.end(png);
  }catch(error){
    console.error('[Stats Maker OGP] sharp renderer failed',error);
    response.statusCode=500;
    response.setHeader('Content-Type','text/plain; charset=utf-8');
    response.end('Failed to generate Stats Maker OG image');
  }
};
