/* R131: no-JavaScript, truthful comparison charts from the existing bounded
 * 6-subject/5-criterion Public-only SEO excerpt. No queries or writes.
 */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const clean=(value,max=90)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const score=(raw,scale)=>{
  if(raw===null||raw===undefined||raw===''||typeof raw==='boolean')return null;
  const value=typeof raw==='number'?raw:typeof raw==='string'?Number(raw):NaN;
  return Number.isFinite(value)&&value>=0&&value<=scale?value:null;
};
const fmt=value=>String(Number(value.toFixed(2)));
const colors=['#efad89','#80c5dd','#bea6ef'];
const polygon=values=>values.map((value,i)=>{
  const angle=-Math.PI/2+i*2*Math.PI/values.length;
  const distance=72*Math.max(0,Math.min(1,value));
  return (115+Math.cos(angle)*distance).toFixed(1)+','+
    (106+Math.sin(angle)*distance).toFixed(1);
}).join(' ');

export function renderPublicScoreVisual(subjects,criteria,scoreRows,lang='ja',scale=100){
  if(scale!==10&&scale!==100)return '';
  if(!Array.isArray(subjects)||!Array.isArray(criteria)||!Array.isArray(scoreRows))return '';
  const en=lang==='en';
  const names=subjects.slice(0,6).map(name=>clean(name,90));
  const metrics=criteria.slice(0,5).map(name=>clean(name,90));
  const matrix=names.map((_,i)=>metrics.map((__,j)=>score(scoreRows[i]?.[j],scale)));
  if(!names.some(Boolean)||!metrics.some(Boolean))return '';

  const panels=metrics.map((metric,j)=>{
    if(!metric)return '';
    const ranking=names.map((name,i)=>({name,index:i,value:matrix[i][j]}))
      .filter(row=>row.name&&row.value!==null)
      .sort((a,b)=>b.value-a.value||a.index-b.index).slice(0,3);
    if(ranking.length<2)return '';
    return '<div class="seoVisualMetric"><h3>'+esc(metric)+'</h3>'+
      ranking.map(item=>
        '<div class="seoVisualBar"><div class="seoVisualBarHeading"><span>'+esc(item.name)+'</span>'+
        '<strong>'+fmt(item.value)+' / '+scale+'</strong></div>'+
        '<div class="seoVisualTrack" aria-hidden="true"><i style="width:'+
        (item.value/scale*100).toFixed(1)+'%"></i></div></div>').join('')+
      '</div>';
  }).filter(Boolean).slice(0,3);
  if(!panels.length)return '';

  const fields=metrics.map((name,index)=>({name,index})).filter(x=>x.name);
  const radar=fields.length>=3?names.map((name,i)=>({
    name,index:i,values:fields.map(x=>matrix[i][x.index])
  })).filter(row=>row.name&&row.values.every(value=>value!==null)).slice(0,3):[];
  let radarHtml='';
  if(radar.length>=2){
    const sides=fields.length;
    const rings=[.25,.5,.75,1].map(f=>
      '<polygon class="seoVisualRing" points="'+polygon(Array(sides).fill(f))+'"/>').join('');
    const axes=fields.map((field,i)=>{
      const angle=-Math.PI/2+i*2*Math.PI/sides;
      const labelX=(115+Math.cos(angle)*91).toFixed(1);
      const labelY=(106+Math.sin(angle)*91+3).toFixed(1);
      const points=polygon(fields.map((_,j)=>i===j?1:0)).split(' ')[i].split(',');
      return '<line class="seoVisualAxis" x1="115" y1="106" x2="'+points[0]+
        '" y2="'+points[1]+'"/><text class="seoVisualAxisLabel" text-anchor="middle" x="'+
        labelX+'" y="'+labelY+'">'+(i+1)+'</text>';
    }).join('');
    const shapes=radar.map((row,i)=>
      '<polygon points="'+polygon(row.values.map(value=>value/scale))+
      '" fill="'+colors[i]+'" fill-opacity=".17" stroke="'+colors[i]+
      '" stroke-width="2.4" stroke-linejoin="round"/>').join('');
    radarHtml='<figure class="seoVisualRadar"><h3>'+
      (en?'Radar · first fully rated subjects':'レーダー · 採点済み対象の抜粋')+'</h3>'+
      '<svg role="img" aria-labelledby="seoPreviewTitle seoPreviewDescription" viewBox="0 0 230 215">'+
      '<title id="seoPreviewTitle">'+(en?'Criterion ratings for public work excerpt':'公開作品の項目別レーダーチャート')+'</title>'+
      '<desc id="seoPreviewDescription">'+esc(fields.map((c,i)=>(i+1)+'. '+c.name).join(' / '))+'</desc>'+
      rings+axes+shapes+'</svg>'+
      '<figcaption><div class="seoVisualLegend">'+radar.map((row,i)=>
        '<span><i style="background:'+colors[i]+'"></i>'+esc(row.name)+'</span>').join('')+
      '</div><div class="seoVisualCriteria">'+fields.map((c,i)=>
        '<span>'+(i+1)+'. '+esc(c.name)+'</span>').join('')+'</div></figcaption>'+
      '</figure>';
  }
  return '<section class="seoVisual" aria-labelledby="seoVisualHeading">'+
    '<h2 id="seoVisualHeading">'+(en?'Visual comparison of published scores':'公開スコアをグラフで比較')+'</h2>'+
    '<p>'+(en
      ?'A sample of the first six subjects and up to five criteria, based only on the creator’s published scores. Bars rank subjects within each criterion, not overall.'
      :'先頭6対象・最大5項目の抜粋です。点数は作成者の公開データに基づき、棒グラフは項目ごとの比較であり総合順位ではありません。')+'</p>'+
    '<div class="seoVisualGrid"><div class="seoVisualBars" aria-label="'+
      (en?'Criterion-by-criterion score bars':'評価項目別の点数比較')+'">'+panels.join('')+'</div>'+
      (radarHtml||'<div class="seoVisualHint">'+(en
        ?'The radar needs at least two subjects with all displayed criteria scored. Missing values are never treated as zero.'
        :'レーダーは表示項目をすべて採点済みの対象が2つ以上の場合だけ表示します。未採点を0点にはしません。')+'</div>')+
    '</div></section>';
}
