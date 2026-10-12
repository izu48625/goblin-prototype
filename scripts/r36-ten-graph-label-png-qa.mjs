import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const TYPES=['ranking-card','stat-card','bar','radar','quadrant','dot','range','scatter','tier-list','ring'];
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,
    locale:'ja-JP',
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  await page.goto(BASE+'/app/editor.html',{waitUntil:'domcontentloaded'});
  // The editor itself requires a saved local project; test rendering in an
  // isolated document with just the production editor CSS, not any account.
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  const results=await page.evaluate(async(types)=>{
    await new Promise((resolve,reject)=>{
      const css=document.createElement('link');css.rel='stylesheet';
      css.href='/app/css/editor.css?v=r36graph1';
      css.onload=resolve;css.onerror=reject;document.head.appendChild(css);
    });
    const [{createProject},{getVisualization},{renderNativeProject}]=await Promise.all([
      import('/app/src/core/project.js'),
      import('/app/src/visualizations/registry.js?v=r36graph1'),
      import('/app/src/core/export.js?v=r36graph1')
    ]);
    const output=[];
    for(const type of types){
      const project=createProject(type);
      project.meta.title='歴代の評価・比較をまとめる長いタイトルとランキングの表示検証：'+('比較分析'.repeat(14));
      project.meta.subtitle='日本語 English Subtitle · '+('概要'.repeat(9));
      project.canvas={preset:'square',width:1080,height:1080,transparent:false};
      if(type==='scatter'){
        project.settings.showLabels=true;project.settings.labelLimit=40;
        project.data.items=Array.from({length:40},(_,i)=>({
          id:'point'+i,name:'ものすごく長い比較対象名 '+i+' '+('実力比較'.repeat(6)),
          x:42+(i%5)*.6,y:58+Math.floor(i/5)*.6,enabled:true,category:'QA'
        }));
      }
      if(type==='radar'){
        project.data.axes=Array.from({length:10},(_,i)=>({
          id:'axis'+i,label:'非常に長い日本語の能力評価指標 '+i,max:100
        }));
        project.data.series=[{id:'s1',name:'テスト',values:Array(10).fill(82)}];
      }
      if(type==='stat-card')project.data.name=project.meta.title;
      if(type==='ranking-card'){
        project.data.items=Array.from({length:10},(_,i)=>({
          id:'rank'+i,name:'比較対象 '+i+' '+('日本語英語混在'.repeat(3)),
          value:96-i,enabled:true,note:'非常に長い説明文が表示からはみ出さないか確認',category:'QA',
          imageRef:null
        }));
      }
      const root=document.createElement('div');
      root.style.cssText='width:1080px;height:1080px;container-type:inline-size;position:relative';
      root.style.setProperty('--visual-bg',project.style.background);
      root.style.setProperty('--visual-text',project.style.primary);
      root.style.setProperty('--visual-muted',project.style.secondary);
      root.style.setProperty('--visual-accent',project.style.accent);
      root.style.setProperty('--visual-border',project.style.border);
      root.style.setProperty('--visual-surface',project.style.surface);
      document.body.appendChild(root);
      const viz=getVisualization(type);
      if(!viz)throw Error('missing graph '+type);
      await viz.render(project,root);
      const title=root.querySelector('.viz-title,.stat-name');
      if(!title)throw Error('missing title '+type);
      const tr=title.getBoundingClientRect(),visual=root.querySelector('.visual').getBoundingClientRect();
      if(tr.left<visual.left-2||tr.right>visual.right+2||tr.bottom>visual.bottom+2)
        throw Error('Long title overflows preview '+type+': '+JSON.stringify({tr:tr.toJSON(),v:visual.toJSON()}));
      if(title.scrollWidth>title.clientWidth+2&&getComputedStyle(title).overflow!=='hidden')
        throw Error('Long title uncontrolled overflow '+type);
      if(type==='radar'){
        const labels=[...root.querySelectorAll('.radar-svg text[aria-label]')];
        if(labels.length!==10)throw Error('Radar lost axis labels');
        const bad=labels.filter(el=>{const b=el.getBBox();return b.x<0||b.x+b.width>1000});
        if(bad.length)throw Error('Radar axis labels escaped SVG viewbox: '+bad.map(x=>x.textContent).join(','));
      }
      if(type==='scatter'){
        const svg=root.querySelector('.scatter-svg');
        const labels=[...svg.querySelectorAll('.scatter-label')];
        const boxes=labels.map(x=>x.getBBox());
        if(boxes.some(b=>b.x<115||b.y<33||b.x+b.width>933||b.y+b.height>630))
          throw Error('Scatter label escaped plotting bounds');
        for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
          const a=boxes[i],b=boxes[j];
          if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)
            throw Error('Scatter labels collided '+i+' '+j);
        }
        if(svg.querySelectorAll('.scatter-point-group').length!==40)
          throw Error('Scatter must not drop points when labels are crowded');
      }
      const native=await renderNativeProject(project);
      if(native.width!==1080||native.height!==1080)
        throw Error(type+' PNG changed dimensions');
      const blob=await new Promise((resolve,reject)=>
        native.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed')),'image/png'));
      if(blob.type!=='image/png'||blob.size<1000)
        throw Error(type+' invalid native PNG: '+blob.size);
      output.push({type,preview:true,pngBytes:blob.size,
        labels:type==='scatter'?root.querySelectorAll('.scatter-label').length:undefined});
      root.remove();
    }
    return output;
  },TYPES);
  assert.deepEqual(results.map(x=>x.type),TYPES);
  for(const v of results)assert(v.preview&&v.pngBytes>1000);
  console.log('R36 P2 ten-graph long-title and iPhone native PNG QA PASS: '+JSON.stringify(results));
}finally{await browser.close()}
