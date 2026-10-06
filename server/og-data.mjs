const DEFAULT_SUPABASE_URL='https://ibpdxbeltdwkquowjeay.supabase.co';
const DEFAULT_SUPABASE_KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';

export const APP_ORIGIN=(process.env.STATS_MAKER_APP_ORIGIN||'https://izu48625.github.io/goblin-prototype').replace(/\/+$/,'');
export const SUPABASE_URL=(process.env.SUPABASE_URL||DEFAULT_SUPABASE_URL).replace(/\/+$/,'');
export const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||DEFAULT_SUPABASE_KEY;

const CATEGORY_LABELS={
  sports:'SPORTS',
  manga_anime:'MANGA / ANIME',
  movie_tv:'MOVIES / TV',
  food:'FOOD',
  game:'GAMES',
  music:'MUSIC',
  books:'BOOKS',
  travel:'TRAVEL / PLACES',
  tech:'TECHNOLOGY',
  lifestyle:'LIFESTYLE',
  other:'OTHER'
};

export function safeTopicId(value){
  const id=String(value||'').trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(id)?id:'';
}

export function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

export function numberOrNull(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function average(scores,criteria,weighted){
  const values=Array.isArray(scores)?scores:[];
  let numerator=0;
  let denominator=0;
  criteria.forEach((criterion,index)=>{
    const score=numberOrNull(values[index]);
    if(score===null)return;
    const weight=weighted?Math.max(0,numberOrNull(criterion?.weight)??1):1;
    if(weight<=0)return;
    numerator+=score*weight;
    denominator+=weight;
  });
  return denominator?Math.round((numerator/denominator)*10)/10:null;
}

export async function fetchTopic(topicId){
  const id=safeTopicId(topicId);
  if(!id)return null;
  const query=new URLSearchParams({
    select:'id,title,description,language_code,score_scale,weighted,snapshot,snapshot_updated_at,published_at,visibility',
    id:`eq.${id}`,
    visibility:'in.(public,unlisted)',
    limit:'1'
  });
  const response=await fetch(`${SUPABASE_URL}/rest/v1/topics?${query.toString()}`,{
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`
    }
  });
  if(!response.ok){
    throw new Error(`Supabase topic fetch failed (${response.status})`);
  }
  const rows=await response.json();
  return Array.isArray(rows)&&rows[0]?rows[0]:null;
}

export function topicCardData(topic){
  const snapshot=topic?.snapshot&&typeof topic.snapshot==='object'&&!Array.isArray(topic.snapshot)
    ?topic.snapshot:{};
  const criteria=Array.isArray(snapshot.criteria)?snapshot.criteria:[];
  const rows=Array.isArray(snapshot.rows)?snapshot.rows:[];
  const scale=Number(snapshot.scale||topic?.score_scale||100)===10?10:100;
  const weighted=typeof snapshot.weighted==='boolean'?snapshot.weighted:!!topic?.weighted;
  const ranking=rows.map((row,index)=>({
    index,
    name:String(row?.name||'').trim()||`Target ${index+1}`,
    value:average(row?.scores,criteria,weighted)
  })).filter(item=>item.value!==null)
    .sort((a,b)=>b.value-a.value||a.index-b.index)
    .slice(0,3);
  const category=String(snapshot?.metadata?.category||'other').toLowerCase();
  return {
    title:String(topic?.title||'Stats Maker').trim()||'Stats Maker',
    description:String(topic?.description||'').trim(),
    language:topic?.language_code==='en'?'en':'ja',
    scale,
    weighted,
    targets:rows.length,
    metrics:criteria.length,
    ranking,
    category:CATEGORY_LABELS[category]||CATEGORY_LABELS.other,
    updatedAt:topic?.snapshot_updated_at||topic?.published_at||''
  };
}

export function publicPageUrl(topicId){
  return `${APP_ORIGIN}/public.html?id=${encodeURIComponent(topicId)}&v=r23p3b`;
}
