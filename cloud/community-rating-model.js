// Pure rating model: the Community page reuses the Home UI but does not
// share its local sheet data. Scores remain associated with immutable item IDs.
export function buildCommunitySheet(topic,items,criteria,existingScores=[]){
  const values=new Map(existingScores.map(score=>[
    score.item_id+'|'+score.criterion_id,
    score.score===null?null:Number(score.score)
  ]));
  return {
    id:'community_'+topic.id,title:topic.title,desc:topic.description||'',
    sourceTopicId:topic.id,
    cols:criteria.map(criterion=>criterion.name),
    rows:items.map(item=>({
      name:item.name,image:'',note:'',sourceItemId:item.id,
      scores:criteria.map(criterion=>{
        const value=values.get(item.id+'|'+criterion.id);
        return Number.isFinite(value)?value:null;
      })
    })),
    sortKey:null,sortDesc:true,rankMetric:'avg',
    compare:items.slice(0,Math.min(items.length,3)).map((_,i)=>i),
    compareView:'radar',viewMode:'sheet',fitMode:'auto',fitZoom:1,
    weighted:!!topic.weighted,
    weights:criteria.map(criterion=>Math.max(0,Number(criterion.weight)||0)),
    scale:Number(topic.score_scale)===10?10:100,
    updatedAt:Date.now()
  };
}

export function collectCommunityScores(sheet,context){
  if(!sheet||!context||sheet.sourceTopicId!==context.topic.id)
    throw new Error('Community sheet has not loaded.');
  if(sheet.rows.length!==context.items.length||sheet.cols.length!==context.criteria.length ||
    sheet.cols.some((label,i)=>label!==context.criteria[i].name))
    throw new Error('The published rating structure changed.');
  const validItems=new Map(context.items.map(item=>[item.id,item.name]));
  const seen=new Set(),entries=[];
  let completed=0;
  const scale=Number(context.topic.score_scale)===10?10:100;
  for(const row of sheet.rows){
    if(!validItems.has(row.sourceItemId)||seen.has(row.sourceItemId) ||
      row.name!==validItems.get(row.sourceItemId))
      throw new Error('The published rating items no longer match.');
    seen.add(row.sourceItemId);
    let complete=true;
    for(let j=0;j<context.criteria.length;j++){
      const raw=row.scores?.[j];
      if(raw===null||raw===undefined||String(raw).trim()===''){complete=false;continue;}
      const value=Number(raw);
      if(!Number.isFinite(value)||value<0||value>scale)
        throw new Error('Scores must be within the published rating scale.');
      entries.push({item_id:row.sourceItemId,criterion_id:context.criteria[j].id,score:value});
    }
    if(complete)completed++;
  }
  return {entries,completed};
}
