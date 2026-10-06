import {ImageResponse} from '@vercel/og';
import {fetchTopic,safeTopicId,topicCardData} from '../server/og-data.js';

const pillStyle={
  display:'flex',
  flexDirection:'column',
  justifyContent:'center',
  width:150,
  height:72,
  padding:'10px 14px',
  border:'1px solid #294768',
  borderRadius:12,
  backgroundColor:'#0a1728'
};

export default async function handler(request){
  try{
    const {searchParams}=new URL(request.url);
    const id=safeTopicId(searchParams.get('id'));
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

    const title=card.title.length>54?card.title.slice(0,52)+'…':card.title;
    const description=card.description.length>96?card.description.slice(0,94)+'…':card.description;
    const ranking=(card.ranking||[]).slice(0,3);

    return new ImageResponse(
      <div style={{
        display:'flex',
        width:'100%',
        height:'100%',
        padding:'54px 62px',
        backgroundColor:'#07101f',
        color:'#edf4ff'
      }}>
        <div style={{
          display:'flex',
          flexDirection:'column',
          width:650,
          height:'100%'
        }}>
          <div style={{display:'flex',alignItems:'center'}}>
            <div style={{
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              width:42,
              height:42,
              borderRadius:12,
              backgroundColor:'#315da2',
              fontSize:22,
              fontWeight:900
            }}>S</div>
            <div style={{
              marginLeft:13,
              fontSize:20,
              fontWeight:900,
              letterSpacing:2,
              color:'#9db9ff'
            }}>STATS MAKER</div>
          </div>

          <div style={{
            marginTop:34,
            fontSize:16,
            fontWeight:900,
            letterSpacing:2,
            color:'#6ddaa2'
          }}>{card.category}</div>

          <div style={{
            display:'flex',
            marginTop:12,
            fontSize:title.length>34?48:58,
            fontWeight:900,
            lineHeight:1.1,
            color:'#f3f7ff'
          }}>{title}</div>

          {description?(
            <div style={{
              display:'flex',
              marginTop:20,
              fontSize:20,
              lineHeight:1.45,
              color:'#9fb1c9',
              width:620
            }}>{description}</div>
          ):null}

          <div style={{display:'flex',gap:12,marginTop:'auto'}}>
            <div style={pillStyle}>
              <div style={{fontSize:13,fontWeight:800,color:'#7087a6'}}>
                {card.language==='en'?'TARGETS':'対象'}
              </div>
              <div style={{marginTop:5,fontSize:24,fontWeight:900,color:'#edf4ff'}}>
                {String(card.targets)}
              </div>
            </div>
            <div style={pillStyle}>
              <div style={{fontSize:13,fontWeight:800,color:'#7087a6'}}>
                {card.language==='en'?'METRICS':'項目'}
              </div>
              <div style={{marginTop:5,fontSize:24,fontWeight:900,color:'#edf4ff'}}>
                {String(card.metrics)}
              </div>
            </div>
            <div style={pillStyle}>
              <div style={{fontSize:13,fontWeight:800,color:'#7087a6'}}>
                {card.language==='en'?'SCALE':'尺度'}
              </div>
              <div style={{marginTop:5,fontSize:24,fontWeight:900,color:'#edf4ff'}}>
                {String(card.scale)}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display:'flex',
          flexDirection:'column',
          marginLeft:54,
          width:368,
          height:'100%',
          padding:'28px 30px',
          border:'1px solid #36577d',
          borderRadius:24,
          backgroundColor:'#081322'
        }}>
          <div style={{
            display:'flex',
            fontSize:15,
            fontWeight:900,
            letterSpacing:1.5,
            color:'#879dbc'
          }}>
            {card.language==='en'?'CREATOR OVERALL TOP 3':'作成者 総合 TOP 3'}
          </div>

          <div style={{
            display:'flex',
            flexDirection:'column',
            marginTop:20,
            width:'100%'
          }}>
            {ranking.length?ranking.map((item,index)=>(
              <div key={index} style={{
                display:'flex',
                alignItems:'center',
                width:'100%',
                height:78,
                borderBottom:index<ranking.length-1?'1px solid #203752':'0 solid transparent'
              }}>
                <div style={{
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
                }}>{index+1}</div>
                <div style={{
                  display:'flex',
                  flexDirection:'column',
                  marginLeft:14,
                  width:210
                }}>
                  <div style={{
                    display:'flex',
                    fontSize:18,
                    fontWeight:800,
                    color:'#edf4ff'
                  }}>{String(item.name).slice(0,18)}</div>
                </div>
                <div style={{
                  display:'flex',
                  justifyContent:'flex-end',
                  width:70,
                  marginLeft:'auto',
                  fontSize:24,
                  fontWeight:900,
                  color:'#8fb2ff'
                }}>{String(item.value)}</div>
              </div>
            )):(
              <div style={{
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                height:230,
                fontSize:18,
                color:'#7186a3'
              }}>
                {card.language==='en'?'No scored data yet':'採点データなし'}
              </div>
            )}
          </div>

          <div style={{
            display:'flex',
            justifyContent:'flex-end',
            marginTop:'auto',
            fontSize:14,
            fontWeight:800,
            color:'#657d9c'
          }}>Created with Stats Maker</div>
        </div>
      </div>,
      {
        width:1200,
        height:630,
        headers:{
          'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      }
    );
  }catch(error){
    console.error('[Stats Maker OGP] image generation failed',error);
    return new Response('Failed to generate Stats Maker OG image',{status:500});
  }
}
