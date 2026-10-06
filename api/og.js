import React from 'react';
import {ImageResponse} from '@vercel/og';
import {fetchTopic,safeTopicId,topicCardData} from '../server/og-data.js';

export const config={
  runtime:'edge'
};

const h=React.createElement;

function text(value){return String(value??'')}

function metaBox(label,value){
  return h('div',{
    style:{
      display:'flex',flexDirection:'column',justifyContent:'center',
      width:150,height:72,padding:'10px 14px',
      border:'1px solid #294768',borderRadius:12,background:'#0a1728'
    }
  },
    h('div',{style:{fontSize:13,fontWeight:800,color:'#7087a6'}},label),
    h('div',{style:{marginTop:5,fontSize:24,fontWeight:900,color:'#edf4ff'}},text(value))
  );
}

function rankRow(item,index,scale){
  const pct=Math.max(0,Math.min(100,Number(item?.value||0)/Number(scale||100)*100));
  return h('div',{
    style:{display:'flex',alignItems:'center',height:82,width:'100%'}
  },
    h('div',{
      style:{
        display:'flex',alignItems:'center',justifyContent:'center',
        width:34,height:34,borderRadius:9,background:index===0?'#244d87':'#182c48',
        color:'#dbe8fb',fontSize:16,fontWeight:900,flex:'0 0 auto'
      }
    },String(index+1)),
    h('div',{style:{display:'flex',flexDirection:'column',marginLeft:14,flex:1,minWidth:0}},
      h('div',{
        style:{fontSize:20,fontWeight:800,color:'#edf4ff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}
      },text(item?.name)),
      h('div',{style:{display:'flex',marginTop:9,width:'100%',height:7,borderRadius:99,background:'#1d314d',overflow:'hidden'}},
        h('div',{style:{width:`${pct}%`,height:'100%',background:'#6f9cff',borderRadius:99}})
      )
    ),
    h('div',{style:{marginLeft:16,width:74,textAlign:'right',fontSize:25,fontWeight:900,color:'#8fb2ff'}},text(item?.value))
  );
}

export default async function handler(req){
  const url=new URL(req.url||'https://stats-maker-ogp.vercel.app/api/og');
  const id=safeTopicId(url.searchParams.get('id'));

  let topic=null;
  try{topic=id?await fetchTopic(id):null}catch(error){
    console.error('[Stats Maker OGP] image topic fetch failed',error);
  }

  const card=topic?topicCardData(topic):{
    title:'Stats Maker',
    description:'Create, compare and share scored rankings.',
    category:'STATS',
    targets:'—',metrics:'—',scale:100,ranking:[]
  };
  const title=card.title.length>54?`${card.title.slice(0,52)}…`:card.title;
  const description=(card.description||'').length>94?`${card.description.slice(0,92)}…`:card.description;

  const element=h('div',{
    style:{
      display:'flex',width:'100%',height:'100%',padding:'58px 64px',
      background:'linear-gradient(135deg,#07101f 0%,#0c1b30 58%,#15284a 100%)',
      color:'#edf4ff',boxSizing:'border-box'
    }
  },
    h('div',{style:{display:'flex',flexDirection:'column',width:650,height:'100%'}},
      h('div',{style:{display:'flex',alignItems:'center'}},
        h('div',{
          style:{display:'flex',alignItems:'center',justifyContent:'center',width:42,height:42,borderRadius:12,background:'#315da2',fontSize:22,fontWeight:900}
        },'S'),
        h('div',{style:{marginLeft:13,fontSize:20,fontWeight:900,letterSpacing:2,color:'#9db9ff'}},'STATS MAKER')
      ),
      h('div',{style:{marginTop:34,fontSize:16,fontWeight:900,letterSpacing:2,color:'#6ddaa2'}},text(card.category)),
      h('div',{
        style:{marginTop:12,fontSize:title.length>34?48:58,fontWeight:900,lineHeight:1.1,color:'#f3f7ff'}
      },title),
      description?h('div',{
        style:{marginTop:20,fontSize:20,lineHeight:1.45,color:'#9fb1c9',maxWidth:620}
      },description):null,
      h('div',{style:{display:'flex',gap:12,marginTop:'auto'}},
        metaBox(card.language==='en'?'TARGETS':'対象',card.targets),
        metaBox(card.language==='en'?'METRICS':'項目',card.metrics),
        metaBox(card.language==='en'?'SCALE':'尺度',card.scale)
      )
    ),
    h('div',{
      style:{
        display:'flex',flexDirection:'column',marginLeft:54,width:368,height:'100%',
        padding:'28px 30px',border:'1px solid #36577d',borderRadius:24,background:'#081322',boxSizing:'border-box'
      }
    },
      h('div',{style:{fontSize:15,fontWeight:900,letterSpacing:1.5,color:'#879dbc'}},card.language==='en'?'CREATOR OVERALL TOP 3':'作成者 総合 TOP 3'),
      h('div',{style:{display:'flex',flexDirection:'column',marginTop:18,width:'100%'}},
        ...(card.ranking.length?card.ranking.slice(0,3).map((item,index)=>rankRow(item,index,card.scale)):[
          h('div',{key:'empty',style:{display:'flex',alignItems:'center',justifyContent:'center',height:230,fontSize:18,color:'#7186a3'}},card.language==='en'?'No scored data yet':'採点データなし')
        ])
      ),
      h('div',{style:{marginTop:'auto',fontSize:14,fontWeight:800,color:'#657d9c',textAlign:'right'}},'Created with Stats Maker')
    )
  );

  return new ImageResponse(element,{
    width:1200,
    height:630,
    headers:{
      'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
