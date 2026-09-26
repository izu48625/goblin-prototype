const BASE_STORAGE_KEY="statsMakerV014Library";

function num(v){
  if(v===null || v===undefined || String(v).trim()==="")return null;
  const x=Number(v);
  return Number.isFinite(x)?x:null;
}

function normalizeMetricKey(sheet,value){
  if(value==="avg" || value===null || value===undefined)return "avg";
  if(typeof value==="string" && value.startsWith("c:")){
    const i=Number(value.slice(2));
    return Number.isInteger(i)?`c:${i}`:"avg";
  }
  const i=Number(value);
  return Number.isInteger(i)?`c:${i}`:"avg";
}

export function readBaseLibrary(){
  try{
    const raw=localStorage.getItem(BASE_STORAGE_KEY);
    const parsed=raw?JSON.parse(raw):null;
    return parsed && Array.isArray(parsed.sheets)?parsed:null;
  }catch{
    return null;
  }
}

export function getSourceSheet(project,explicitSheet=null){
  if(explicitSheet)return explicitSheet;

  const library=readBaseLibrary();
  if(!library?.sheets?.length)return null;

  const wanted=project?.settings?.sourceSheetId;
  return library.sheets.find(s=>s.id===wanted)
    || library.sheets.find(s=>s.id===library.activeId)
    || library.sheets[0]
    || null;
}

export function getSourceModel(project,explicitSheet=null){
  const sheet=getSourceSheet(project,explicitSheet);
  if(!sheet)return null;

  const scale=sheet.scale===10?10:100;
  const weighted=!!sheet.weighted;

  // A criterion is active when:
  // 1) it has a non-empty label, and
  // 2) it is not an untouched auto-generated trailing criterion (評価N)
  //    with no numeric values at all.
  const rawColumns=(sheet.cols||[]).map((c,rawIndex)=>{
    const label=String(c??"").trim();
    const hasValue=(sheet.rows||[]).some(row=>Number.isFinite(num(row?.scores?.[rawIndex])));
    const untouchedDefault=/^評価\d+$/.test(label) && !hasValue;
    return {rawIndex,label,hasValue,untouchedDefault};
  });

  const activeColumns=rawColumns.filter(col=>col.label && !col.untouchedDefault);
  const criteria=activeColumns.map(col=>col.label);
  const rawToFiltered=new Map(activeColumns.map((col,i)=>[col.rawIndex,i]));

  const weights=activeColumns.map(col=>{
    const w=Number(sheet.weights?.[col.rawIndex]);
    return Number.isFinite(w)&&w>=0?w:1;
  });

  // Only named rows become extension targets.
  const rows=(sheet.rows||[]).map((row,rawIndex)=>{
    const name=String(row?.name??"").trim();
    if(!name)return null;
    return {
      rawIndex,
      name,
      note:String(row?.note??"").trim(),
      image:typeof row?.image==="string"?row.image:"",
      scores:activeColumns.map(col=>num(row?.scores?.[col.rawIndex]))
    };
  }).filter(Boolean);

  const average=row=>{
    let total=0,den=0;
    row.scores.forEach((score,ci)=>{
      if(!Number.isFinite(score))return;
      const w=weighted?weights[ci]:1;
      total+=score*w;
      den+=w;
    });
    return den?Math.round(total/den*10)/10:0;
  };

  let metricKey="avg";
  if(sheet.rankMetric!=="avg" && sheet.rankMetric!==null && sheet.rankMetric!==undefined){
    const rawMetric=Number(String(sheet.rankMetric).replace("c:",""));
    const filtered=rawToFiltered.get(rawMetric);
    if(Number.isInteger(filtered))metricKey=`c:${filtered}`;
  }

  const metricLabel=key=>{
    if(key==="avg")return "総合平均";
    const ci=Number(String(key).replace("c:",""));
    return criteria[ci]||`評価${ci+1}`;
  };

  const metricValue=(row,key)=>{
    if(key==="avg")return average(row);
    const ci=Number(String(key).replace("c:",""));
    const value=row?.scores?.[ci];
    return Number.isFinite(value)?value:0;
  };

  const criterionMean=ci=>{
    const values=rows.map(r=>r.scores[ci]).filter(Number.isFinite);
    return values.length
      ? Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10
      : 0;
  };

  const validByRaw=new Map(rows.map(r=>[r.rawIndex,r]));
  const compare=(sheet.compare||[])
    .map(Number)
    .filter(Number.isInteger)
    .filter(i=>validByRaw.has(i));

  return {
    sheet,
    criteria,
    activeColumns,
    scale,
    rows,
    average,
    metricKey,
    metricLabel,
    metricValue,
    criterionMean,
    compare
  };
}

export function getMetricOptions(model){
  if(!model)return [];
  return [
    {value:"avg",label:"総合平均"},
    ...model.criteria.map((label,i)=>({value:`c:${i}`,label}))
  ];
}

export function getCriterionOptions(model){
  if(!model)return [];
  return model.criteria.map((label,i)=>({value:i,label}));
}

export function getSubjectOptions(model){
  if(!model)return [];
  return model.rows.map(r=>({value:r.rawIndex,label:r.name}));
}

function sourceRow(model,rawIndex){
  return model.rows.find(r=>r.rawIndex===Number(rawIndex))
    || model.rows[0]
    || null;
}

function criterionIndex(model,value,fallback=0){
  const i=Number(value);
  if(Number.isInteger(i) && i>=0 && i<model.criteria.length)return i;
  return Math.max(0,Math.min(model.criteria.length-1,fallback));
}

function setSourceBasics(project,model){
  project.settings.sourceLinked=true;
  project.settings.sourceSheetId=model.sheet.id;
  project.meta.title=String(model.sheet.title||"Stats Maker").trim()||"Stats Maker";
  project.meta.subtitle=String(model.sheet.desc||"").trim();
}

function syncMetricItems(project,model,key){
  key=normalizeMetricKey(model.sheet,key);
  const label=model.metricLabel(key);
  project.settings.sourceMetricKey=key;

  project.data.items=model.rows.map(r=>({
    id:`src_${r.rawIndex}`,
    sourceRawIndex:r.rawIndex,
    name:r.name,
    value:model.metricValue(r,key),
    note:r.note,
    category:"",
    imageData:r.image,
    imageRef:null,
    imageShape:"circle",
    enabled:true
  }));

  if(project.type==="ranking-card"){
    project.data.items.sort((a,b)=>
      Number(b.value)-Number(a.value)
      || Number(a.sourceRawIndex)-Number(b.sourceRawIndex)
    );

    const currentTop=Number(project.settings.topN);
    project.settings.topN=Number.isFinite(currentTop)&&currentTop>0
      ? Math.min(20,Math.max(1,currentTop))
      : Math.min(20,Math.max(1,project.data.items.length));
    project.settings.unit="";
    project.settings.headerLabel=label;
    project.settings.showCategory=false;
    project.meta.subtitle=`${label}ランキング`;
  }else if(project.type==="bar"){
    const currentTop=Number(project.settings.topN);
    project.settings.topN=Number.isFinite(currentTop)&&currentTop>0
      ? Math.min(30,Math.max(1,currentTop))
      : Math.min(30,Math.max(1,project.data.items.length));
    project.settings.unit="";
    project.settings.showCategory=false;
    project.settings.autoMax=false;
    project.settings.max=model.scale;
    project.meta.subtitle=label;
  }else if(project.type==="dot"){
    project.settings.unit="";
    project.settings.min=0;
    project.settings.max=model.scale;
    project.settings.autoRange=false;
    project.meta.subtitle=label;
  }else if(project.type==="tier-list"){
    project.meta.subtitle=label;
    const cut=model.scale===10?[9,8,7,6]:[90,80,70,60];
    project.data.tiers=[
      {id:"tier_s",label:"S",min:cut[0],max:model.scale},
      {id:"tier_a",label:"A",min:cut[1],max:cut[0]-0.01},
      {id:"tier_b",label:"B",min:cut[2],max:cut[1]-0.01},
      {id:"tier_c",label:"C",min:cut[3],max:cut[2]-0.01},
      {id:"tier_d",label:"D",min:0,max:cut[3]-0.01}
    ];
    project.data.items=project.data.items.map(item=>({
      id:item.id,
      sourceRawIndex:item.sourceRawIndex,
      name:item.name,
      value:item.value,
      tier:""
    }));
    project.settings.mode="auto";
  }
}

function syncStatCard(project,model,rawIndex){
  const row=sourceRow(model,rawIndex);
  project.settings.sourceSubjectIndex=row?.rawIndex??null;
  project.data.name=row?.name||project.meta.title;
  project.data.subtitle=String(model.sheet.title||"");
  project.data.overall=row?model.average(row):0;
  project.data.team="";
  project.data.tier="";
  project.data.imageData=row?.image||"";
  project.data.imageRef=null;
  project.data.imageShape="rounded";
  project.data.stats=model.criteria
    .map((label,ci)=>({
      id:`stat_${ci}`,
      label,
      value:row?.scores?.[ci],
      ci
    }))
    .filter(stat=>Number.isFinite(stat.value))
    .slice(0,12)
    .map(({id,label,value})=>({id,label,value}));
  project.meta.title=row?.name||String(model.sheet.title||"Stats Maker");
  project.meta.subtitle="評価サマリー";
}

function syncXY(project,model,xValue,yValue){
  const xi=criterionIndex(model,xValue,0);
  let yi=criterionIndex(model,yValue,model.criteria.length>1?1:0);
  if(model.criteria.length>1 && yi===xi){
    yi=(xi+1)%model.criteria.length;
  }
  project.settings.sourceXIndex=xi;
  project.settings.sourceYIndex=yi;

  const xLabel=model.criteria[xi]||`評価${xi+1}`;
  const yLabel=model.criteria[yi]||`評価${yi+1}`;

  project.data.items=model.rows.map(r=>({
    id:`src_${r.rawIndex}`,
    sourceRawIndex:r.rawIndex,
    name:r.name,
    x:Number.isFinite(r.scores[xi])?r.scores[xi]:0,
    y:Number.isFinite(r.scores[yi])?r.scores[yi]:0,
    category:"",
    enabled:true,
    imageData:r.image,
    imageRef:null,
    imageShape:"circle"
  }));

  project.settings.xAxis={
    ...(project.settings.xAxis||{}),
    label:xLabel,min:0,max:model.scale,split:model.scale/2
  };
  project.settings.yAxis={
    ...(project.settings.yAxis||{}),
    label:yLabel,min:0,max:model.scale,split:model.scale/2
  };
  project.meta.subtitle=`${xLabel} × ${yLabel}`;

  if(project.type==="quadrant"){
    project.settings.quadrants={
      topLeft:`${yLabel}高 / ${xLabel}低`,
      topRight:`${xLabel}高 / ${yLabel}高`,
      bottomLeft:`${xLabel}低 / ${yLabel}低`,
      bottomRight:`${xLabel}高 / ${yLabel}低`
    };
  }
}

function syncRange(project,model,aValue,bValue){
  const ai=criterionIndex(model,aValue,0);
  let bi=criterionIndex(model,bValue,model.criteria.length>1?1:0);
  if(model.criteria.length>1 && bi===ai){
    bi=(ai+1)%model.criteria.length;
  }
  project.settings.sourceRangeA=ai;
  project.settings.sourceRangeB=bi;
  project.settings.labelA=model.criteria[ai]||`評価${ai+1}`;
  project.settings.labelB=model.criteria[bi]||`評価${bi+1}`;
  project.settings.min=0;
  project.settings.max=model.scale;
  project.settings.autoRange=false;
  project.meta.subtitle=`${project.settings.labelA} → ${project.settings.labelB}`;
  project.data.items=model.rows.map(r=>({
    id:`src_${r.rawIndex}`,
    sourceRawIndex:r.rawIndex,
    name:r.name,
    value:Number.isFinite(r.scores[ai])?r.scores[ai]:0,
    value2:Number.isFinite(r.scores[bi])?r.scores[bi]:0
  }));
}

function syncRing(project,model,rawIndex){
  const row=sourceRow(model,rawIndex);
  project.settings.sourceSubjectIndex=row?.rawIndex??null;
  project.data.items=model.criteria
    .map((label,ci)=>({
      id:`ring_${ci}`,
      label,
      value:row?.scores?.[ci],
      max:model.scale,
      unit:"",
      ci
    }))
    .filter(item=>Number.isFinite(item.value))
    .slice(0,6)
    .map(({id,label,value,max,unit})=>({id,label,value,max,unit}));
  project.meta.title=row?.name||String(model.sheet.title||"Stats Maker");
  project.meta.subtitle=row?String(model.sheet.title||""):"項目平均";
}

function syncRadar(project,model,rawIndices){
  const valid=new Set(model.rows.map(r=>r.rawIndex));
  let indices=Array.isArray(rawIndices)
    ? rawIndices.map(Number).filter(Number.isInteger).filter(i=>valid.has(i))
    : [];

  if(!indices.length){
    indices=model.compare.filter(i=>valid.has(i));
  }
  if(!indices.length){
    indices=model.rows.slice(0,Math.min(3,model.rows.length)).map(r=>r.rawIndex);
  }
  indices=[...new Set(indices)].slice(0,6);

  project.settings.sourceSeriesIndices=indices;

  const selectedRows=indices
    .map(rawIndex=>sourceRow(model,rawIndex))
    .filter(Boolean);

  // Drop only axes that have no score for every selected subject.
  const axisIndices=model.criteria
    .map((_,ci)=>ci)
    .filter(ci=>selectedRows.some(row=>Number.isFinite(row.scores[ci])))
    .slice(0,12);

  project.data.axes=axisIndices.map(ci=>({
    id:`axis_${ci}`,
    sourceCriterionIndex:ci,
    label:model.criteria[ci],
    max:model.scale
  }));

  const palette=["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"];
  project.data.series=selectedRows.map((row,si)=>({
    id:`series_${row.rawIndex}`,
    sourceRawIndex:row.rawIndex,
    name:row.name,
    color:palette[si%palette.length],
    values:axisIndices.map(ci=>
      Number.isFinite(row.scores[ci])?row.scores[ci]:0
    )
  }));

  project.meta.subtitle=`${project.data.axes.length}項目比較`;
}

export function syncSourceProject(project,changes={},explicitSheet=null){
  const model=getSourceModel(project,explicitSheet);
  if(!model)return project;

  setSourceBasics(project,model);

  const type=project.type;
  if(["ranking-card","bar","dot","tier-list"].includes(type)){
    const key=changes.metricKey
      ?? project.settings.sourceMetricKey
      ?? model.metricKey;
    syncMetricItems(project,model,key);
  }else if(type==="stat-card"){
    syncStatCard(
      project,model,
      changes.subjectIndex
        ?? project.settings.sourceSubjectIndex
        ?? model.rows[0]?.rawIndex
    );
  }else if(type==="quadrant"||type==="scatter"){
    syncXY(
      project,model,
      changes.xIndex
        ?? project.settings.sourceXIndex
        ?? 0,
      changes.yIndex
        ?? project.settings.sourceYIndex
        ?? (model.criteria.length>1?1:0)
    );
  }else if(type==="range"){
    syncRange(
      project,model,
      changes.aIndex
        ?? project.settings.sourceRangeA
        ?? 0,
      changes.bIndex
        ?? project.settings.sourceRangeB
        ?? (model.criteria.length>1?1:0)
    );
  }else if(type==="ring"){
    syncRing(
      project,model,
      changes.subjectIndex
        ?? project.settings.sourceSubjectIndex
        ?? model.rows[0]?.rawIndex
    );
  }else if(type==="radar"){
    syncRadar(
      project,model,
      changes.seriesIndices
        ?? project.settings.sourceSeriesIndices
        ?? model.compare
    );
  }
  return project;
}
