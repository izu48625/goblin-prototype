import assert from 'node:assert/strict';
// R54: production GET-only smoke. No Supabase SQL writes, no account tokens,
// no Community publishing, no load/flood testing.
const base=process.env.BASE_URL||'https://statsmaker.app';
const cases=[
  ['newest',new URLSearchParams({query:'',category:'all',view:'all',sort:'newest',locale:'ja',limit:'12',offset:'0'})],
  ['popular',new URLSearchParams({query:'',category:'all',view:'all',sort:'popular',locale:'en',limit:'12',offset:'0'})],
  ['category',new URLSearchParams({query:'',category:'sports',view:'all',sort:'newest',locale:'ja',limit:'12',offset:'0'})],
  ['search',new URLSearchParams({query:'サッカー',category:'all',view:'all',sort:'newest',locale:'ja',limit:'12',offset:'0'})]
];
for (const [name,params] of cases){
  const url=new URL('/api/discover?'+params.toString(),base);
  const start=performance.now();
  const res=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  assert.equal(res.status,200,name+' endpoint must return 200');
  assert.match(res.headers.get('content-type')||'',/application\/json/i);
  assert.match(res.headers.get('cache-control')||'',/no-store/i);
  const body=await res.json();
  assert(Array.isArray(body.rows),name+' rows must be array');
  assert(body.rows.length<=12);
  assert(Number.isSafeInteger(Number(body.total))&&body.total>=body.rows.length);
  assert(typeof body.has_more==='boolean'&&typeof body.anchor==='string');
  assert(body.rows.every(x=>x.visibility==='public'));
  assert.equal(new Set(body.rows.map(x=>x.id)).size,body.rows.length);
  console.log('R54 live',name,'PASS',{cards:body.rows.length,total:body.total,
    cache:res.headers.get('x-stats-maker-discover-cache'),
    elapsedMs:Math.round(performance.now()-start)});
}
console.log('R54 GET-only Public Discover production smoke PASS');
