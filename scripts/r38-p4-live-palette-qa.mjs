import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const KEY='r38p14toggle1';
const HOME='base/index.html?v='+KEY;
const STYLE='css/style.css?v='+KEY;
const expectedColors=[
  'rgba(31,47,53,.20)','rgba(37,64,85,.24)','rgba(39,72,103,.31)','rgba(40,89,89,.29)','rgba(110,99,57,.32)','rgba(122,84,62,.35)','rgba(116,60,74,.42)'
];
const local=[['index.html',HOME],['base/index.html',STYLE],['base/index.html','js/app.js?v='+KEY]];
for(const [path,needle] of local){
  const data=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert(data.includes(needle),path+' is not cache-busted: '+needle);
}
const homeDoc=await readFile(new URL('../base/index.html',import.meta.url),'utf8');
assert(homeDoc.includes('id="scoreColorToggleBtn"'), 'filter-bar ON/OFF button missing');
assert(homeDoc.includes('js/i18n.js?v='+KEY), 'toggle label translation cache stale');
const appJS=await readFile(new URL('../base/js/app.js',import.meta.url),'utf8');
assert(appJS.includes("COLOR_PREF_KEY='statsMaker.scoreColorsVisible.v1'"), 'display preference not implemented');
const localCss=await readFile(new URL('../base/css/style.css',import.meta.url),'utf8');
assert(localCss.includes('body.score-colors-off #scoreTable td.scoreCell'), 'score color OFF CSS missing');
assert(localCss.includes('body.score-colors-off .overviewMetric'), 'overview OFF CSS missing');
for(const color of expectedColors)assert(localCss.includes('--score-tile-overlay:'+color),color+' missing');
assert(localCss.includes('background-color:var(--score-tile-overlay, transparent)'), 'true RGBA score background missing');
assert(localCss.includes('Final measured sRGB pixels on #101b30'),'photo-locked palette documentation missing');
assert(localCss.includes('#scoreTable tbody tr:nth-child(even)'), 'subtle score row underlay missing');
assert(!localCss.includes('linear-gradient(170deg,rgba(255,255,255,.145)'), 'old fake glass sheen still present');
console.log('R38 P14 palette + visibility toggle source-chain PASS');
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
      const root=await fetchText(host.base+'/?paletteQA=r38p14-'+attempt);
      assert(root.includes(HOME),'stale outer shell -> Home iframe');
      const home=await fetchText(host.base+'/base/index.html?v='+KEY);
      assert(home.includes(STYLE),'stale Home HTML -> CSS');
      assert(home.includes('js/app.js?v='+KEY),'stale Home HTML -> color JS');
      assert(home.includes('js/i18n.js?v='+KEY),'stale Home HTML -> translations');
      assert(home.includes('id="scoreColorToggleBtn"'),'no score color toggle on production');
      const css=await fetchText(host.base+'/base/css/style.css?v='+KEY);
      const app=await fetchText(host.base+'/base/js/app.js?v='+KEY);
      assert(app.includes('scoreTileColors'),'missing real per-cell JS colors');
      assert(app.includes('statsMaker.scoreColorsVisible.v1'),'missing ON/OFF toggle behavior');
      assert(css.includes('body.score-colors-off #scoreTable td.scoreCell'),'missing OFF color rule');
      assert(css.includes('#scoreTable td.scoreCell.heat-ss'),'missing score cells');
      assert(css.includes('background-color:var(--score-tile-overlay, transparent)'),'missing direct RGBA background');
      assert(!css.includes('linear-gradient(170deg,rgba(255,255,255,.145)'),'stale faux gloss is present');
      for(const color of expectedColors)
        assert(css.includes('--score-tile-overlay:'+color),'missing color '+color);
      console.log('R38 P14 LIVE asset chain PASS',host.name,host.base,
        {outerBytes:root.length,homeBytes:home.length,cssBytes:css.length});
      success=true;
    }catch(error){
      last=String(error);
      console.log('R38 P14 LIVE awaiting asset deployment',host.name,attempt+1,last);
      if(attempt<29)await wait(5000);
    }
  }
  assert(success,host.name+' never served new complete palette asset chain: '+last);
}
console.log('R38 P14 production and Pages freshness PASS; no real data touched');
