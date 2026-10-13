import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const KEY='r38p4palette1';
const HOME='base/index.html?v='+KEY;
const STYLE='css/style.css?v='+KEY;
const expectedColors=[
  '#303f5e','#345179','#2f628f','#2f6ea9','#69478d','#86409c','#974e97'
];
const local=[['index.html',HOME],['base/index.html',STYLE]];
for(const [path,needle] of local){
  const data=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert(data.includes(needle),path+' is not cache-busted: '+needle);
}
const localCss=await readFile(new URL('../base/css/style.css',import.meta.url),'utf8');
for(const color of expectedColors)assert(localCss.includes('background:'+color),color+' missing');
console.log('R38 P4 SOURCE asset-chain and vivid blue-purple palette checks PASS');
if(process.argv[2]!=='live')process.exit(0);

// No browser storage, Supabase credentials, user works or POST requests.
// Only read public asset URLs, with independent cache keys on each layer.
const hosts=[
  {name:'Cloudflare',base:'https://statsmaker.app'},
  {name:'GitHub Pages',base:'https://izu48625.github.io/goblin-prototype'}
];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchText(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),14000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:controller.signal,
      headers:{'User-Agent':'StatsMaker-R38-P4-Palette-ReadOnly/1.0'}});
    assert.equal(r.status,200,url+' status '+r.status);
    return await r.text();
  }finally{clearTimeout(timer)}
}
for(const host of hosts){
  let success=false,last='';
  for(let attempt=0;attempt<30&&!success;attempt++){
    try{
      const root=await fetchText(host.base+'/?paletteQA=r38p4-'+attempt);
      assert(root.includes(HOME),'stale outer shell -> Home iframe');
      const home=await fetchText(host.base+'/base/index.html?v='+KEY);
      assert(home.includes(STYLE),'stale Home HTML -> CSS');
      const css=await fetchText(host.base+'/base/css/style.css?v='+KEY);
      assert(css.includes('#scoreTable td.scoreCell.heat-ss'),'missing score cells');
      for(const color of expectedColors)
        assert(css.includes('background:'+color),'missing color '+color);
      console.log('R38 P4 LIVE asset chain PASS',host.name,host.base,
        {outerBytes:root.length,homeBytes:home.length,cssBytes:css.length});
      success=true;
    }catch(error){
      last=String(error);
      console.log('R38 P4 LIVE awaiting asset deployment',host.name,attempt+1,last);
      if(attempt<29)await wait(5000);
    }
  }
  assert(success,host.name+' never served new complete palette asset chain: '+last);
}
console.log('R38 P4 production and Pages freshness PASS; no real data touched');
