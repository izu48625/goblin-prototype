// Read-only check of consent-based Community CTA on actual Public canonical pages.
// Public works can change participation settings. Never use hardcoded topics.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const base=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/$/,'');
const fetchHtml=async path=>{
  const res=await fetch(base+path,{headers:{Accept:'text/html','Cache-Control':'no-cache'},
    cache:'no-store',signal:AbortSignal.timeout(15000)});
  return {res,html:await res.text()};
};
const discover=await fetchHtml('/discover?lang=ja');
assert.equal(discover.res.status,200);
const payload=discover.html.match(/<script type="application\/json" id="discover-ssr-data">([^<]*)<\/script>/)?.[1];
assert(payload,'No Public SSR to cross-check current author preferences');
const rows=JSON.parse(payload)?.data?.rows;
assert(Array.isArray(rows)&&rows.length>0&&rows.length<=12);
const topics=rows.filter(row=>row?.visibility==='public'&&/^[0-9a-f-]{36}$/i.test(row.id));
assert(topics.length>0);
let checked=0,eligible=0;
for(let attempt=1;attempt<=7;attempt++){
  checked=0;eligible=0;let stale=false;
  for(const topic of topics){
    const id=topic.id;
    const {res,html}=await fetchHtml('/work/'+id);
    assert.equal(res.status,200,'Public canonical page should exist');
    assert.match(res.headers.get('Cache-Control')||'',/no-store/);
    assert(html.includes('<meta name="robots" content="index,follow">'));
    assert(html.includes('href="'+base+'/public.html?id='+id+'"'));
    const hasCTA=html.includes('<a class="communityJoin" href="'+base+'/index.html?community='+id+'">');
    const mayParticipate=topic.show_community===true&&topic.allow_ratings===true;
    if(mayParticipate){eligible++;if(!hasCTA)stale=true;}
    else assert(!hasCTA,'Disabled Community work must never promote a rating link');
    assert(!hasCTA||html.includes('集計結果は参加人数などの条件')||
      html.includes('may depend on participation thresholds'),
      'Participation results must not be promised prematurely');
    checked++;
  }
  if(!stale)break;
  console.log('R132 CTA not yet deployed; retry '+attempt+'/7');
  if(attempt<7)await delay(12000);
}
assert(checked>0,'No current Public topic checked');
const active=topics.filter(row=>row.show_community===true&&row.allow_ratings===true);
if(active.length){
  const result=await fetchHtml('/work/'+active[0].id);
  assert(result.html.includes('<a class="communityJoin" href="'+base+
    '/index.html?community='+active[0].id+'">'),
    'Eligible work must offer an actual Community entry after rollout');
}
console.log('LIVE R132 Community CTA PASS',JSON.stringify({checked,eligible}));
