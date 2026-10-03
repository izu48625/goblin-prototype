(() => {
  'use strict';

  function scoreNumber(value){
    if(value===null||value===undefined||String(value).trim()==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }

  function build(sheet,locale='ja'){
    if(!sheet||typeof sheet!=='object')throw new Error('Sheet is missing.');

    const namedRows=(sheet.rows||[])
      .map((row,rawIndex)=>({
        rawIndex,
        name:String(row?.name??'').trim(),
        note:String(row?.note??'').trim(),
        image:typeof row?.image==='string'?row.image:'',
        rawScores:Array.isArray(row?.scores)?row.scores:[]
      }))
      .filter(row=>row.name);

    const columns=(sheet.cols||[]).map((name,rawIndex)=>{
      const label=String(name??'').trim();
      const hasValue=namedRows.some(row=>scoreNumber(row.rawScores[rawIndex])!==null);
      const genericUnused=(
        (/^評価\d+$/.test(label)||/^Metric\s+\d+$/i.test(label))
        && !hasValue
      );
      const w=Number(sheet.weights?.[rawIndex]);
      return {
        rawIndex,
        label,
        genericUnused,
        weight:Number.isFinite(w)?Math.max(0,w):1
      };
    }).filter(col=>col.label&&!col.genericUnused);

    if(!String(sheet.title??'').trim())throw new Error(locale==='ja'?'タイトルを入力してください。':'Enter a title.');
    if(!namedRows.length)throw new Error(locale==='ja'?'対象を1件以上入力してください。':'Add at least one target.');
    if(!columns.length)throw new Error(locale==='ja'?'評価項目を1件以上作成してください。':'Add at least one metric.');

    const criteria=columns.map((col,position)=>({
      name:col.label,weight:col.weight,position,sourceIndex:col.rawIndex
    }));

    const rows=namedRows.map((row,position)=>({
      name:row.name,
      note:row.note,
      position,
      hasLocalImage:!!row.image,
      scores:columns.map(col=>scoreNumber(row.rawScores[col.rawIndex]))
    }));

    return {
      version:1,
      title:String(sheet.title??'').trim(),
      description:String(sheet.desc??'').trim(),
      language:locale==='en'?'en':'ja',
      scale:sheet.scale===10?10:100,
      weighted:!!sheet.weighted,
      criteria,
      rows,
      lineage:sheet.sourceTopicId?{
        relation:'remix',
        sourceTopicId:String(sheet.sourceTopicId),
        sourceTopicTitle:String(sheet.sourceTopicTitle||'')
      }:null
    };
  }

  window.SM_PUBLISH_MODEL={build};
})();
