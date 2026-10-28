import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const expected='<meta name="google-adsense-account" content="ca-pub-2734957009365610">';
const forbidden=/<script\b[^>]*(?:pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js|adsbygoogle)[^>]*>/i;
const mode=process.argv[2]||'local';
const headOf=html=>{
  const match=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  assert(match,'Outer HTML <head> is absent');
  return match[1];
};
const verify=html=>{
  const head=headOf(html);
  assert(head.includes(expected),'Owner-authorized verification meta missing in outer <head>');
  assert.equal((html.match(/name="google-adsense-account"/g)||[]).length,1,
    'Duplicate owner verification meta');
  assert(!forbidden.test(html),'Real AdSense script must not activate at verification step');
  const title=head.match(/<title>([^<]+)<\\/title>/)?.[1]||'';
  assert(title.includes('Stats Maker')&&title.length>=16,
    'Root app must retain a descriptive search title and Stats Maker brand');
  assert(html.includes('id="basicFrame"')&&html.includes('id="extLauncher"'),
    'Actual scoring app and chart launcher must remain present');
};
if(mode==='local'){
  const src=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const dist=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  verify(src);
  verify(dist);
  assert.equal(dist,src,'Cloudflare build must ship exact owner meta');
  assert(!dist.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'));
  const analytics=await readFile(new URL('../cloud/analytics-config.js',import.meta.url),'utf8');
  assert(analytics.includes('enabled:false')&&analytics.includes("measurementId:''"),
    'GA4 must remain disabled');
  console.log('R50 LOCAL AdSense meta-only verification PASS');
}else if(mode==='live'){
  let verified=false;
  for(let attempt=0;attempt<30;attempt++){
    try{
      const res=await fetch('https://statsmaker.app/?r50owner='+attempt,{
        cache:'no-store',signal:AbortSignal.timeout(15000)
      });
      if(res.status!==200)throw Error('HTTP '+res.status);
      const html=await res.text();
      verify(html);
      verified=true;
      break;
    }catch(e){
      console.log('R50 live ownership meta pending attempt '+(attempt+1)+': '+String(e));
      if(attempt<29)await new Promise(resolve=>setTimeout(resolve,5000));
    }
  }
  assert(verified,'AdSense meta not verified at official production root');
  console.log('R50 LIVE https://statsmaker.app/ owner meta tag PASS; no real ad script');
}else{
  throw Error('Unknown R50 QA mode '+mode);
}
