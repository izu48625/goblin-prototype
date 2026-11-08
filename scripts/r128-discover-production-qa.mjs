// Read-only verification that Cloudflare serves the new HTML-first Discover.
// The static GitHub Pages build alone does not prove Workers routing is live.
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';

const origin=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/$/,'');
const url=origin+'/discover?ssr_probe=1';
let last='not attempted';
for(let attempt=1;attempt<=5;attempt++){
  try{
    const resp=await fetch(url,{headers:{Accept:'text/html','Cache-Control':'no-cache'},
      signal:AbortSignal.timeout(12000)});
    const html=await resp.text();
    last='HTTP '+resp.status+', '+html.length+' bytes, SSR='+html.includes('id="discover-ssr-data"');
    if(resp.ok&&html.includes('id="discover-ssr-data"')){
      assert.match(resp.headers.get('Cache-Control')||'',/no-store/,
        'Public work HTML must never be persistently cached after revocation');
      const m=html.match(/<script type="application\/json" id="discover-ssr-data">([^<]*)<\/script>/);
      assert(m,'Safe JSON payload must be present in the initial HTML');
      const payload=JSON.parse(m[1]);
      assert(Array.isArray(payload?.data?.rows));
      assert(payload.data.rows.length<=12);
      assert(payload.data.rows.every(row=>row.visibility==='public'),'Non-Public record leaked into SSR');
      assert(html.includes('<main id="grid" class="discoverGrid">'));
      assert(!html.includes('<main id="grid" class="discoverGrid hidden">'));
      for(const row of payload.data.rows)
        assert(html.includes('/work/'+encodeURIComponent(row.id)),'Public card must link to its indexable scores');
      console.log('LIVE Discover SSR PASS',{origin,rows:payload.data.rows.length,
        cache:resp.headers.get('Cache-Control')});
      process.exit(0);
    }
  }catch(error){last=String(error?.message||error)}
  console.log('SSR not live on attempt '+attempt+': '+last);
  if(attempt<5)await sleep(15000);
}
throw new Error('Cloudflare Discover SSR did not become available: '+last);
