(() => {
  'use strict';
  const STORAGE_KEY='statsMakerV014Library';
  const makeId=()=>`s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  function buildSheet(topic,snapshot,criteriaFallback=[],itemsFallback=[],locale='ja'){
    const criteria=(Array.isArray(snapshot?.criteria)&&snapshot.criteria.length)
      ? snapshot.criteria
      : criteriaFallback.map(c=>({name:c.name,weight:Number(c.weight??1)}));

    const sourceRows=(Array.isArray(snapshot?.rows)&&snapshot.rows.length)
      ? snapshot.rows
      : itemsFallback.map(i=>({name:i.name,note:'',scores:Array(criteria.length).fill(null)}));

    const cols=criteria.map(c=>String(c.name||'').trim()).filter(Boolean);
    const rows=sourceRows.map(row=>({
      name:String(row.name||'').trim(),
      image:'',
      note:'',
      // Remix starts as the user's own scoring sheet.
      scores:Array(cols.length).fill(null)
    })).filter(row=>row.name);

    const orderedItems=[...itemsFallback].sort((a,b)=>Number(a.position)-Number(b.position));
    const orderedCriteria=[...criteriaFallback].sort((a,b)=>Number(a.position)-Number(b.position));
    const scale=Number(snapshot?.scale||topic.score_scale||100)===10?10:100;

    return {
      id:makeId(),
      // Prevent repeated "(Remix)" suffixes when copying a copy.
      title:(String(topic.title||'').replace(/(?:\s*[（(]\s*(?:Remix|Copy|コピー)\s*[)）])+\s*$/gi,'').trim()||String(topic.title||'').trim())+(locale==='ja'?'（コピー）':' (Copy)'),
      desc:topic.description||'',
      cols,
      rows,
      sortKey:null,sortDesc:true,rankMetric:'avg',compare:[],compareView:'radar',
      viewMode:'sheet',fitMode:'auto',fitZoom:1,
      weighted:typeof snapshot?.weighted==='boolean'?snapshot.weighted:!!topic.weighted,
      weights:criteria.map(c=>Number.isFinite(Number(c.weight))?Math.max(0,Number(c.weight)):1),
      scale,
      sourceTopicId:topic.id,
      sourceTopicTitle:topic.title,
      sourceCommunity:{
        scale,
        rowNames:rows.map(r=>r.name),
        columnNames:cols.slice(),
        itemIds:orderedItems.map(i=>i.id),
        criterionIds:orderedCriteria.map(c=>c.id)
      },
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