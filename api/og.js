const React=require('react');
const {ImageResponse}=require('@vercel/og');

const h=React.createElement;

module.exports=async function handler(request,response){
  let debug=false;
  try{
    const {fetchTopic,safeTopicId,topicCardData}=await import('../server/og-data.mjs');

    const proto=String(request.headers?.['x-forwarded-proto']||'https').split(',')[0].trim();
    const host=String(request.headers?.host||request.headers?.['x-forwarded-host']||'stats-maker-ogp.vercel.app').split(',')[0].trim();
    const url=new URL(request.url||'/api/og',`${proto}://${host}`);
    debug=url.searchParams.get('debug')==='1';
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

    const meta=(label,value)=>h('div',{
      style:{
        display:'flex',
        flexDirection:'column',
        justifyContent:'center',
        width:150,
        height:72,
        padding:'10px 14px',
        border:'1px solid #294768',
        borderRadius:12,
        backgroundColor:'#0a1728'
      }
    },
      h('div',{style:{display:'flex',fontSize:13,fontWeight:800,color:'#7087a6'}},label),
      h('div',{style:{display:'flex',marginTop:5,fontSize:24,fontWeight:900,color:'#edf4ff'}},String(value))
    );

    const rankRows=top.length
      ?top.map((item,index)=>h('div',{
          key:String(index),
          style:{
            display:'flex',
            alignItems:'center',
            width:'100%',
            height:78,
            borderBottom:index<top.length-1?'1px solid #203752':'0 solid transparent'
          }
        },
          h('div',{
            style:{
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              width:34,
              height:34,
              borderRadius:9,
              backgroundColor:index===0?'#244d87':'#182c48',
              color:'#dbe8fb',
              fontSize:16,
              fontWeight:900
            }
          },String(index+1)),
          h('div',{
            style:{
              display:'flex',
              marginLeft:14,
              width:210,
              fontSize:18,
              fontWeight:800,
              color:'#edf4ff'
            }
          },String(item.name||'').slice(0,18)),
          h('div',{
            style:{
              display:'flex',
              justifyContent:'flex-end',
              width:70,
              marginLeft:'auto',
              fontSize:24,
              fontWeight:900,
              color:'#8fb2ff'
            }
          },String(item.value))
        ))
      :[h('div',{
          key:'empty',
          style:{
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            height:230,
            fontSize:18,
            color:'#7186a3'
          }
        },card.language==='en'?'No scored data yet':'採点データなし')];

    const element=h('div',{
      style:{
        display:'flex',
        width:'100%',
        height:'100%',
        padding:'54px 62px',
        backgroundColor:'#07101f',
        color:'#edf4ff'
      }
    },
      h('div',{
        style:{
          display:'flex',
          flexDirection:'column',
          width:650,
          height:'100%'
        }
      },
        h('div',{style:{display:'flex',alignItems:'center'}},
          h('div',{
            style:{
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              width:42,
              height:42,
              borderRadius:12,
              backgroundColor:'#315da2',
              fontSize:22,
              fontWeight:900
            }
          },'S'),
          h('div',{
            style:{
              display:'flex',
              marginLeft:13,
              fontSize:20,
              fontWeight:900,
              letterSpacing:2,
              color:'#9db9ff'
            }
          },'STATS MAKER')
        ),
        h('div',{
          style:{
            display:'flex',
            marginTop:34,
            fontSize:16,
            fontWeight:900,
            letterSpacing:2,
            color:'#6ddaa2'
          }
        },String(card.category||'STATS')),
        h('div',{
          style:{
            display:'flex',
            marginTop:12,
            fontSize:title.length>34?48:58,
            fontWeight:900,
            lineHeight:1.1,
            color:'#f3f7ff'
          }
        },title),
        description?h('div',{
          style:{
            display:'flex',
            marginTop:20,
            width:620,
            fontSize:20,
            lineHeight:1.45,
            color:'#9fb1c9'
          }
        },description):null,
        h('div',{style:{display:'flex',gap:12,marginTop:'auto'}},
          meta(card.language==='en'?'TARGETS':'対象',card.targets),
          meta(card.language==='en'?'METRICS':'項目',card.metrics),
          meta(card.language==='en'?'SCALE':'尺度',card.scale)
        )
      ),
      h('div',{
        style:{
          display:'flex',
          flexDirection:'column',
          marginLeft:54,
          width:368,
          height:'100%',
          padding:'28px 30px',
          border:'1px solid #36577d',
          borderRadius:24,
          backgroundColor:'#081322'
        }
      },
        h('div',{
          style:{
            display:'flex',
            fontSize:15,
            fontWeight:900,
            letterSpacing:1.5,
            color:'#879dbc'
          }
        },card.language==='en'?'CREATOR OVERALL TOP 3':'作成者 総合 TOP 3'),
        h('div',{
          style:{
            display:'flex',
            flexDirection:'column',
            marginTop:20,
            width:'100%'
          }
        },...rankRows),
        h('div',{
          style:{
            display:'flex',
            justifyContent:'flex-end',
            marginTop:'auto',
            fontSize:14,
            fontWeight:800,
            color:'#657d9c'
          }
        },'Created with Stats Maker')
      )
    );

    const imageResponse=new ImageResponse(element,{
      width:1200,
      height:630,
      headers:{
        'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });

    const body=Buffer.from(await imageResponse.arrayBuffer());
    imageResponse.headers.forEach((value,key)=>response.setHeader(key,value));
    response.statusCode=imageResponse.status||200;
    response.end(body);
    return;
  }catch(error){
    console.error('[Stats Maker OGP] image generation failed',error);
    const message=String(error?.stack||error?.message||error||'Unknown OG error').slice(0,4000);
    response.statusCode=500;
    response.setHeader('content-type','text/plain; charset=utf-8');
    response.end(debug?message:'Failed to generate Stats Maker OG image');
    return;
  }
}
