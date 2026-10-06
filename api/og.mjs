import React from 'react';
import {ImageResponse} from '@vercel/og';

export const config={
  runtime:'edge'
};

const h=React.createElement;
const SUPABASE_URL='https://ibpdxbeltdwkquowjeay.supabase.co';
const SUPABASE_KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';

function safeTopicId(value){
  const id=String(value||'').trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(id)?id:'';
}

function numberOrNull(value){
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

async function fetchTopic(topicId){
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
  if(!response.ok)throw new Error(`Supabase topic fetch failed (${response.status})`);
  const rows=await response.json();
  return Array.isArray(rows)&&rows[0]?rows[0]:null;
}

function topicCardData(topic){
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
  const labels={
    sports:'SPORTS',manga_anime:'MANGA / ANIME',movie_tv:'MOVIES / TV',
    food:'FOOD',game:'GAMES',music:'MUSIC',books:'BOOKS',travel:'TRAVEL / PLACES',
    tech:'TECHNOLOGY',lifestyle:'LIFESTYLE',other:'OTHER'
  };
  const category=String(snapshot?.metadata?.category||'other').toLowerCase();
  return {
    title:String(topic?.title||'Stats Maker').trim()||'Stats Maker',
    description:String(topic?.description||'').trim(),
    language:topic?.language_code==='en'?'en':'ja',
    scale,
    targets:rows.length,
    metrics:criteria.length,
    ranking,
    category:labels[category]||labels.other
  };
}

function meta(label,value){
  return h('div',{style:{
    display:'flex',flexDirection:'column',justifyContent:'center',
    width:150,height:72,padding:'10px 14px',
    border:'1px solid #294768',borderRadius:12,backgroundColor:'#0a1728'
  }},
    h('div',{style:{display:'flex',fontSize:13,fontWeight:800,color:'#7087a6'}},label),
    h('div',{style:{display:'flex',marginTop:5,fontSize:24,fontWeight:900,color:'#edf4ff'}},String(value))
  );
}

export default async function handler(request){
  const url=new URL(request.url);
  const debug=url.searchParams.get('debug')==='1';
  try{
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

    const title=String(card.title||'Stats Maker').slice(0,54);
    const description=String(card.description||'').slice(0,96);
    const top=(card.ranking||[]).slice(0,3);

    const rankRows=top.length?top.map((item,index)=>h('div',{
      key:String(index),
      style:{
        display:'flex',alignItems:'center',width:'100%',height:78,
        borderBottom:index<top.length-1?'1px solid #203752':'0 solid transparent'
      }
    },
      h('div',{style:{
        display:'flex',alignItems:'center',justifyContent:'center',
        width:34,height:34,borderRadius:9,
        backgroundColor:index===0?'#244d87':'#182c48',
        color:'#dbe8fb',fontSize:16,fontWeight:900
      }},String(index+1)),
      h('div',{style:{
        display:'flex',marginLeft:14,width:210,fontSize:18,fontWeight:800,color:'#edf4ff'
      }},String(item.name||'').slice(0,18)),
      h('div',{style:{
        display:'flex',justifyContent:'flex-end',width:70,marginLeft:'auto',
        fontSize:24,fontWeight:900,color:'#8fb2ff'
      }},String(item.value))
    )):[h('div',{key:'empty',style:{
      display:'flex',alignItems:'center',justifyContent:'center',
      height:230,fontSize:18,color:'#7186a3'
    }},card.language==='en'?'No scored data yet':'採点データなし')];

    const element=h('div',{style:{
      display:'flex',width:'100%',height:'100%',padding:'54px 62px',
      backgroundColor:'#07101f',color:'#edf4ff'
    }},
      h('div',{style:{display:'flex',flexDirection:'column',width:650,height:'100%'}},
        h('div',{style:{display:'flex',alignItems:'center'}},
          h('div',{style:{
            display:'flex',alignItems:'center',justifyContent:'center',
            width:42,height:42,borderRadius:12,backgroundColor:'#315da2',
            fontSize:22,fontWeight:900
          }},'S'),
          h('div',{style:{
            display:'flex',marginLeft:13,fontSize:20,fontWeight:900,
            letterSpacing:2,color:'#9db9ff'
          }},'STATS MAKER')
        ),
        h('div',{style:{
          display:'flex',marginTop:34,fontSize:16,fontWeight:900,
          letterSpacing:2,color:'#6ddaa2'
        }},String(card.category||'STATS')),
        h('div',{style:{
          display:'flex',marginTop:12,fontSize:title.length>34?48:58,
          fontWeight:900,lineHeight:1.1,color:'#f3f7ff'
        }},title),
        description?h('div',{style:{
          display:'flex',marginTop:20,width:620,fontSize:20,lineHeight:1.45,color:'#9fb1c9'
        }},description):null,
        h('div',{style:{display:'flex',gap:12,marginTop:'auto'}},
          meta(card.language==='en'?'TARGETS':'対象',card.targets),
          meta(card.language==='en'?'METRICS':'項目',card.metrics),
          meta(card.language==='en'?'SCALE':'尺度',card.scale)
        )
      ),
      h('div',{style:{
        display:'flex',flexDirection:'column',marginLeft:54,width:368,height:'100%',
        padding:'28px 30px',border:'1px solid #36577d',borderRadius:24,backgroundColor:'#081322'
      }},
        h('div',{style:{
          display:'flex',fontSize:15,fontWeight:900,letterSpacing:1.5,color:'#879dbc'
        }},card.language==='en'?'CREATOR OVERALL TOP 3':'作成者 総合 TOP 3'),
        h('div',{style:{display:'flex',flexDirection:'column',marginTop:20,width:'100%'}},...rankRows),
        h('div',{style:{
          display:'flex',justifyContent:'flex-end',marginTop:'auto',
          fontSize:14,fontWeight:800,color:'#657d9c'
        }},'Created with Stats Maker')
      )
    );

    return new ImageResponse(element,{
      width:1200,
      height:630,
      headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}
    });
  }catch(error){
    console.error('[Stats Maker OGP] edge image generation failed',error);
    const message=String(error?.stack||error?.message||error||'Unknown OG error').slice(0,4000);
    return new Response(debug?message:'Failed to generate Stats Maker OG image',{
      status:500,
      headers:{'content-type':'text/plain; charset=utf-8'}
    });
  }
}
