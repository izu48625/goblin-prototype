(() => {
  'use strict';
  const STORAGE_KEY='statsMakerV014Library';
  const makeId=()=>`s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  function buildSheet(topic,snapshot,criteriaFallback=[],itemsFallback=[],locale='ja'){
    const criteria=(Array.isArray(snapshot?.criteria)&&snapshot.criteria.length)
      ? snapshot.criteria
      : criteriaFallback.map(c=>({name:c.name,weight:Number(c.weight??1)}));

    const rows=(Array.isArray(snapshot?.rows)&&snapshot.rows.length)
      ? snapshot.rows
      : itemsFallback.map(i=>({name:i.name,note:'',scores:Array(criteria.length).fill(null)}));

    return {
      id:makeId(),
      title:`${topic.title}${locale==='ja'?'（Remix）':' (Remix)'}`,
      desc:topic.description||'',
      cols:criteria.map(c=>String(c.name||'').trim()).filter(Boolean),
      rows:rows.map(row=>({
        name:String(row.name||'').trim(),
        image:'',
        note:String(row.note||''),
        scores:Array.isArray(row.scores)?row.scores.slice(0,criteria.length):Array(criteria.length).fill(null)
      })).filter(row=>row.name),
      sortKey:null,sortDesc:true,rankMetric:'avg',compare:[],compareView:'radar',
      viewMode:'sheet',fitMode:'auto',fitZoom:1,
      weighted:typeof snapshot?.weighted==='boolean'?snapshot.weighted:!!topic.weighted,
      weights:criteria.map(c=>Number.isFinite(Number(c.weight))?Math.max(0,Number(c.weight)):1),
      scale:Number(snapshot?.scale||topic.score_scale||100)===10?10:100,
      sourceTopicId:topic.id,
      sourceTopicTitle:topic.title,
      remixedAt:Date.now(),
      updatedAt:Date.now()
    };
  }

  function saveSheet(sheet){
    let library=null;
    try{library=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
    if(!library||!Array.isArray(library.sheets))library={activeId:sheet.id,sheets:[]};
    library.sheets.push(sheet);
    library.activeId=sheet.id;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(library));
    return sheet;
  }

  window.SM_REMIX={buildSheet,saveSheet};
})();
