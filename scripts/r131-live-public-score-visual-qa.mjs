// Read-only production crawlability check for the R131 first-response charts.
// The user controls Public visibility, so discover current IDs rather than
// hardcode old fixtures or read private/unlisted items.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const ORIGIN=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/+$/,'');
const fetchHtml=async path=>{
  const res=await fetch(ORIGIN+path,{
    headers:{Accept:'text/html','Cache-Control':'no-cache'},
    cache:'no-store',signal:AbortSignal.timeout(16000)
  });
  return {res,body:await res.text()};
};
async function currentIds(){
  const {res,body}=await fetchHtml('/discover?lang=ja');
  assert.equal(res.status,200,'Public Discover SSR must be reachable');
  const json=body.match(/<script type="application\/json" id="discover-ssr-data">([^<]*)<\/script>/)?.[1];
  assert(json,'Current Public Discover SSR data is required');
  const data=JSON.parse(json);
  return (data?.data?.rows||[]).filter(row=>
    row.visibility==='public'&&/^[0-9a-f-]{36}$/i.test(row.id)).map(row=>row.id);
}
let ids=[];
for(let i=1;i<=3;i++){
  try{ids=await currentIds();if(ids.length)break}catch(e){
    console.log('Public SSR discovery unavailable, attempt '+i+': '+e.message);
  }
  if(i<3)await delay(4000);
}
assert(ids.length>0,'No Public work available to inspect');
let works=0,visuals=0,radars=0,hasScoreExcerpt=0;
for(let attempt=1;attempt<=8;attempt++){
  works=0;visuals=0;radars=0;hasScoreExcerpt=0;
  for(const id of ids.slice(0,12)){
    const {res,body}=await fetchHtml('/work/'+id);
    assert.equal(res.status,200,'Public work indexable page missing '+id);
    assert.match(res.headers.get('Cache-Control')||'',/no-store/);
    assert(body.includes('<meta name="robots" content="index,follow">'));
    assert(body.includes('<link rel="canonical" href="'+ORIGIN+'/work/'+id+'">'));
    assert(body.includes('/public.html?id='+id),'Open full visual viewer link missing');
    works++;
    if(body.includes('class="seoScores"'))hasScoreExcerpt++;
    if(body.includes('class="seoVisual"')){
      visuals++;
      assert(body.includes('class="seoVisualBars"'),'Charts must include actual per-criterion bars');
      assert(body.includes('class="seoVisualBarHeading"'),'Bars must have text and score values');
      assert(body.includes('class="seoVisualTrack"'),'Bars must render bounded scale widths');
      assert(body.includes('seoVisualGrid'),'Mobile comparison grid must be styled');
      assert(body.includes('先頭6対象')||body.includes('first six subjects'),
        'Never imply snippet is an all-subject overall ranking');
      assert(!body.includes('width:NaN%')&&!body.includes('width:Infinity%'));
      if(body.includes('class="seoVisualRadar"')){
        radars++;
        assert(body.includes('<svg role="img" aria-labelledby="seoPreviewTitle seoPreviewDescription"'));
      }
    }
  }
  if(visuals>0)break;
  console.log('R131 Public visuals not yet deployed, check '+attempt+'/8');
  if(attempt<8)await delay(12000);
}
assert(visuals>0,'New Public score visual absent from all current indexable work pages');
console.log('LIVE R131 PASS',JSON.stringify({works,hasScoreExcerpt,visuals,radars}));
