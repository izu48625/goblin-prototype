import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT_URL='https://statsmaker.app';
const ALT_URL='https://izu48625.github.io/goblin-prototype';
const mode=process.argv[2]||'local';
const read=path=>readFile(join(ROOT,path),'utf8');
const check=(condition,message)=>assert(condition,'R38 P17: '+message);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function inventory(){
  const files=[
    'index.html','base/index.html','base/css/style.css','base/js/app.js',
    'base/js/i18n.js','public.html','cloud/public.css','cloud/public.js',
    'discover.html','ja/index.html','en/index.html','ja/legal.html',
    'en/legal.html','robots.txt','cloud/analytics-config.js',
    'cloud/ad-layout.js','scripts/r38-p15-public-score-qa.mjs',
    'R36_IPHONE_FINAL_CHECK.md'
  ];
  const sources=Object.fromEntries(await Promise.all(files.map(async p=>[p,await read(p)])));
  const outer=sources['index.html'],home=sources['base/index.html'];
  const publicPage=sources['public.html'];
  const match=(src,exp,label)=>{const found=src.match(exp)?.[1];check(Boolean(found),'missing '+label);return found;};
  const homeKey=match(outer,/base\/index\.html\?v=([a-z0-9]+)/,'HOME iframe version');
  for(const ref of [
    /css\/style\.css\?v=([a-z0-9]+)/,
    /js\/app\.js\?v=([a-z0-9]+)/
  ])check(match(home,ref,'HOME CSS/JS revision')===homeKey,'inconsistent HOME iframe/CSS/JS cache');
  check(home.includes('id="scoreColorToggleBtn"'),'approved score color visibility switch missing');
  check(!home.includes('id="gradeFilter"')&&!home.includes('id="filterCount"'),
    'removed filter or visible/total counter came back');
  const publicCSSKey=match(publicPage,/cloud\/public\.css\?v=([a-z0-9]+)/,'public CSS revision');
  const publicJSKey=match(publicPage,/cloud\/public\.js\?v=([a-z0-9]+)/,'public JS revision');
  check(publicCSSKey===publicJSKey,'published CSS/JS cache versions differ');
  check(sources['cloud/public.js'].includes('class="tableWrap creatorScoreTable"'),
    'original creator horizontal score matrix missing');
  check(!sources['cloud/public.js'].includes('class="publicScoreCards"'),
    'unrequested card scores reintroduced');
  check(sources['cloud/public.css'].includes('.creatorScoreTable table'),
    'compact iPhone table style missing');
  check(sources['public.html'].includes('content="noindex,follow"'),
    'noncanonical public viewer became indexable');
  const config=sources['cloud/analytics-config.js'];
  check(config.includes('enabled:false')&&config.includes("measurementId:''"),
    'GA4 was enabled without permission');
  check(sources['cloud/ad-layout.js'].includes('adPreview=1'),
    'advertising must remain a preview until authorized');
  for(const lang of ['ja','en']){
    const page=sources[lang+'/index.html'];
    const legal=sources[lang+'/legal.html'];
    check(page.includes('<html lang="'+lang+'">'),'landing language mismatch: '+lang);
    check(page.includes('hreflang="ja"')&&page.includes('hreflang="en"'),
      'international alternate language links missing: '+lang);
    for(const section of ['terms','privacy','contact'])
      check(legal.includes('id="'+section+'"'),'missing '+lang+' '+section);
  }
  check(sources['robots.txt'].includes('Sitemap: '+ROOT_URL+'/sitemap.xml'),
    'robots sitemap reference not official domain');
  return {homeKey,publicKey:publicCSSKey};
}
const get=async(url)=>{
  const response=await fetch(url,{
    cache:'no-store',headers:{'User-Agent':'StatsMaker-R38-P17-ReadOnly/1.0'},
    signal:AbortSignal.timeout(25000)
  });
  return {response,body:await response.text()};
};
async function live(){
  const keys=await inventory();
  const targets=[{name:'Cloudflare',base:ROOT_URL,hasSeo:true},
                 {name:'GitHub Pages',base:ALT_URL,hasSeo:false}];
  for(const host of targets){
    let ready=false;
    // Cloudflare deployment and Pages propagation can finish in either order.
    for(let attempt=0;attempt<30;attempt++){
      try{
        const [outer,home,publicPage]=await Promise.all([
          get(host.base+'/index.html?qa=r38p17-'+attempt),
          get(host.base+'/base/index.html?qa=r38p17-'+attempt),
          get(host.base+'/public.html?qa=r38p17-'+attempt)
        ]);
        ready=[outer,home,publicPage].every(x=>x.response.status===200)&&
          outer.body.includes('base/index.html?v='+keys.homeKey)&&
          home.body.includes('css/style.css?v='+keys.homeKey)&&
          home.body.includes('js/app.js?v='+keys.homeKey)&&
          publicPage.body.includes('cloud/public.css?v='+keys.publicKey)&&
          publicPage.body.includes('cloud/public.js?v='+keys.publicKey);
        if(ready)break;
      }catch(error){console.log('R38 P17 deployment read retry',host.name,String(error));}
      await delay(4000);
    }
    check(ready,'expected release cache keys not deployed on '+host.name);
    const paths=[
      '/base/js/app.js?v='+keys.homeKey,
      '/base/css/style.css?v='+keys.homeKey,
      '/cloud/public.js?v='+keys.publicKey,
      '/cloud/public.css?v='+keys.publicKey
    ];
    for(const path of paths){
      const asset=await get(host.base+path);
      check(asset.response.status===200,'asset '+path+' returned '+asset.response.status);
      check(asset.body.length>1000,'empty or truncated asset '+path);
      if(path.includes('cloud/public.js'))
        check(asset.body.includes('class="tableWrap creatorScoreTable"'),
          'public table JS not deployed on '+host.name);
    }
    const pub=(await get(host.base+'/public.html?qa=r38p17-crawl')).body;
    check(pub.includes('content="noindex,follow"'),
      'viewer noindex missing on '+host.name);
    const home=(await get(host.base+'/base/index.html?qa=r38p17-filter')).body;
    check(home.includes('id="scoreColorToggleBtn"')&&!home.includes('id="gradeFilter"'),
      'editor filter rollback on '+host.name);
    console.log('R38 P17 LIVE STATIC ASSET + PRIVATE VIEWER PASS',host.name,keys);
    if(host.hasSeo){
      for(const [path,fragment] of [
        ['/ja/','<html lang="ja">'],['/en/','<html lang="en">'],
        ['/robots.txt','Sitemap: https://statsmaker.app/sitemap.xml'],
        ['/sitemap.xml','<sitemapindex']
      ]){
        const x=await get(host.base+path);
        check(x.response.status===200&&x.body.includes(fragment),
          'SEO endpoint '+path+' failed on '+host.name);
      }
      const invalid=await get(host.base+'/work/00000000-0000-4000-8000-000000000000');
      check(invalid.response.status===404,'private/missing SEO work should 404');
      console.log('R38 P17 LIVE PUBLIC-ONLY SEO ENTRYPOINT PASS');
    }
  }
}
const keys=await inventory();
if(mode==='local')console.log('R38 P17 LOCAL READ-ONLY PRELAUNCH SOURCE AUDIT PASS',keys);
else if(mode==='live')await live();
else throw Error('Unknown mode '+mode);
