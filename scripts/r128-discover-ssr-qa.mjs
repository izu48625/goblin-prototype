import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../worker/index.js';

const shell=await readFile(new URL('../discover.html',import.meta.url),'utf8');
const source=await readFile(new URL('../cloud/discover.js',import.meta.url),'utf8');
const conf=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
for(const path of ['/discover','/discover.html'])
  assert(conf.assets.run_worker_first.includes(path),'SSR must run before static assets');

const publicId='071a2bf3-2a17-490d-a2f5-b5b0a5832438';
const hiddenId='8a6fec8a-dec2-4764-b5c0-91cebf2a0481';
const malicious='</script><img src=x onerror=alert(1)>';
const publicRow={id:publicId,visibility:'public',title:'Football <all-stars> '+malicious,
  description:'Ronaldo & Messi comparison',language_code:'en',score_scale:10,
  snapshot:{scale:10,metadata:{category:'sports'},
    rows:[{name:'Messi & Rival',scores:[8,9]},{name:'Ronaldo',scores:[7,8]}],
    criteria:[{name:'Skill'},{name:'Goals'}]},
  participants:2,remixCount:1};
let rpcCalls=0,rateCalls=0,fail=false,forceHidden=false,apiArgs=null,assetCalls=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  const target=new URL(String(url));
  if(target.hostname!=='ibpdxbeltdwkquowjeay.supabase.co')
    throw Error('Unexpected direct external fetch');
  assert.equal(target.pathname,'/rest/v1/rpc/discover_public_works_v1');
  assert.equal(options.method,'POST');
  rpcCalls++;
  apiArgs=JSON.parse(options.body);
  return fail?new Response('upstream down',{status:502}):
    Response.json({rows:forceHidden?[{...publicRow,id:hiddenId,visibility:'unlisted'}]:[publicRow],
      total:1,has_more:false,anchor:'2026-11-09T00:00:00Z'});
};
const env={
  ASSETS:{async fetch(request){
    assetCalls++;
    assert.equal(new URL(request.url).pathname,'/discover.html');
    return new Response(shell,{headers:{'Content-Type':'text/html'}});
  }},
  DISCOVER_RATE_LIMIT:{async limit(){rateCalls++;return {success:true}}}
};
const run=(path,options)=>worker.fetch(new Request('https://statsmaker.app'+path,options),env);
try{
  let r=await run('/discover');
  assert.equal(r.status,200);
  assert.equal(r.headers.get('Cache-Control'),'private, no-store');
  assert(!r.headers.get('X-Robots-Tag'),'Valid Public cards should remain indexable');
  let html=await r.text();
  assert(html.includes('<main id="grid" class="discoverGrid">'));
  assert(html.includes('/work/'+publicId));
  assert(html.includes('Football &lt;all-stars&gt;'));
  assert(html.includes('Messi &amp; Rival'));
  assert(html.includes('Skill / Goals'));
  assert(html.includes('<div class="visualValue">8.5</div>'));
  assert(!html.includes(malicious),'User HTML must not run in the SSR document');
  assert(!html.includes('onerror=alert(1)>'));
  const jsonMatch=html.match(/<script type="application\/json" id="discover-ssr-data">([^<]*)<\/script>/);
  assert(jsonMatch,'SSR JSON must be safe within a script tag');
  const hydrated=JSON.parse(jsonMatch[1]);
  assert.equal(hydrated.data.rows[0].title,publicRow.title);
  assert.equal(hydrated.data.rows[0].visibility,'public');
  assert.equal(rpcCalls,1,'Single Public-only RPC per initial render');
  assert.equal(rateCalls,1,'SSR request must use the bounded limiter');

  r=await run('/discover.html?category=sports&view=community&lang=en');
  assert.equal(r.status,200);
  html=await r.text();
  assert(html.includes('1 Public works'));
  assert.equal(apiArgs.p_category,'sports');
  assert.equal(apiArgs.p_view,'community');
  assert.equal(apiArgs.p_locale,'en');

  const before=rpcCalls,rateBefore=rateCalls;
  r=await run('/discover',{method:'HEAD'});
  assert.equal(r.status,200);
  assert.equal(await r.text(),'');
  assert.equal(rpcCalls,before,'HEAD must not query Supabase');
  assert.equal(rateCalls,rateBefore,'HEAD must not consume limiter');
  assert.equal((await run('/discover',{method:'POST'})).status,405);

  forceHidden=true;
  r=await run('/discover');
  assert.equal(r.status,503,'Transient SSR failure must be retryable, not a durable 200/noindex');
  assert.equal(r.headers.get('X-Robots-Tag'),'noindex,follow');
  html=await r.text();
  assert(!html.includes(hiddenId));
  assert(!html.includes(publicRow.title));
  forceHidden=false;

  fail=true;
  r=await run('/discover');
  assert.equal(r.status,503,'Transient SSR failure must be retryable, not a durable 200/noindex');
  assert.equal(r.headers.get('X-Robots-Tag'),'noindex,follow');
  assert(!(await r.text()).includes(publicId));
  fail=false;

  // Execute the browser bootstrap with a real server payload. It must paint
  // the Public work without even one initial API or direct Supabase request.
  function el(dataset={}){
    const classes=new Set();
    return {dataset,textContent:'',innerHTML:'',value:'',disabled:false,
      classList:{add(v){classes.add(v)},remove(v){classes.delete(v)},
        toggle(v,force){if(force)classes.add(v);else classes.delete(v)},
        contains(v){return classes.has(v)}},
      addEventListener(){},setAttribute(){}};
  }
  const ids=Object.fromEntries(['grid','status','searchInput','resultMeta',
    'sectionTitle','moreBtn','refreshBtn'].map(id=>[id,el()]));
  const categories=['all','sports','manga_anime','movie_tv','food','game',
    'music','books','travel','tech','lifestyle','other'].map(category=>el({category}));
  const views=['all','community'].map(view=>el({view}));
  const sorts=['newest','popular','community','remix'].map(sort=>el({sort}));
  const selectors=new Map();
  for(const selector of ['.hero h1','.hero p','.privacyNote','.createLink','.footer a'])
    selectors.set(selector,el());
  for(const item of [...views,...sorts]){
    const key=item.dataset.view?'view':'sort';
    selectors.set('[data-'+key+'="'+item.dataset[key]+'"]',item);
  }
  const doc={
    documentElement:{lang:'ja'},
    getElementById(id){
      return id==='discover-ssr-data'?{textContent:JSON.stringify({
        locale:'ja',category:'all',view:'all',data:{
          rows:[publicRow],total:1,has_more:false,anchor:'2026-11-09T00:00:00Z'
        }
      })}:ids[id];
    },
    querySelector(s){if(!selectors.has(s))throw Error('Unexpected DOM selector: '+s);return selectors.get(s)},
    querySelectorAll(s){return s==='.categoryBtn'?categories:s==='.browseTab'?views:
      s==='.sortBtn'?sorts:[]}
  };
  let unexpectedNetwork=0;
  vm.runInNewContext(source,{
    document:doc,window:{location:{hostname:'statsmaker.app',search:''},
      SM_SUPABASE:{client:{async rpc(){unexpectedNetwork++;throw Error('duplicate initial RPC')}}}},
    localStorage:{getItem(){return null}},navigator:{language:'ja-JP'},
    fetch(){unexpectedNetwork++;throw Error('duplicate initial API call')},
    console:{warn(){},error(){}},Intl,Date,URLSearchParams,Number,Set,
    setTimeout(){throw Error('Unexpected reload scheduling')},
    clearTimeout(){},
  },{filename:'cloud/discover.js'});
  assert.equal(unexpectedNetwork,0,'SSR hydration must not duplicate first-page fetch');
  assert(ids.grid.innerHTML.includes('Football &lt;all-stars&gt;'));
  assert(!ids.grid.innerHTML.includes('<img src=x'));
  assert(!ids.grid.classList.contains('hidden'));

  // Browser can consume the validated SSR JSON without an extra first-page RPC.
  // Preserve the existing non-SSR R40 path for previews and old static hosts.
  assert(source.includes("document.getElementById('discover-ssr-data')"));
  assert(source.includes('if(!hydratePublicSsr())reload();'));
  assert(source.includes("topic.visibility!=='public'"));
  assert(assetCalls>=4);

  console.log('R128 Discover SSR Public-only/no-store/escape/limit/fallback PASS');
}finally{globalThis.fetch=oldFetch}
