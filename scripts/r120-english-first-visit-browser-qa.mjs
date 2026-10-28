import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {createProject} from '../app/src/core/project.js';
import {syncSourceProject} from '../app/src/core/source-sync.js';

const root=process.env.BASE_URL||'http://127.0.0.1:4173';
const publicId='11111111-1111-4111-8111-111111111111';
const source={
  id:'r120-english-source',title:'Creator ratings',desc:'',
  cols:['Attack','Defense','Development'],weights:[1,1,1],
  rows:[
    {name:'Carrick',scores:[4,3,4],image:'',note:''},
    {name:'Conte',scores:[7,9,5],image:'',note:''}
  ],scale:10,weighted:false,rankMetric:'avg',compare:[]
};
const project=createProject('quadrant');
syncSourceProject(project,{},source);
project.settings.publicSourceSheet=source;
project.settings.publicSourceTopicId=publicId;
const publicTopic={
  id:publicId,owner_id:'99999999-9999-4999-8999-999999999999',
  title:'Creator comparison',description:'Example ratings',score_scale:10,
  weighted:false,visibility:'public',allow_ratings:true,show_community:true,
  source_topic_id:null,published_at:'2026-10-01T12:00:00Z',
  snapshot_updated_at:'2026-10-01T12:00:00Z',
  topic_items:[
    {id:'item1',name:'Carrick',position:0,image_url:null},
    {id:'item2',name:'Conte',position:1,image_url:null}
  ],
  criteria:[
    {id:'c1',name:'Attack',weight:1,position:0},
    {id:'c2',name:'Defense',weight:1,position:1},
    {id:'c3',name:'Development',weight:1,position:2}
  ],
  snapshot:{rows:source.rows,criteria:source.cols.map(name=>({name,weight:1})),scale:10}
};
function mockSupabase(){
  const topic=window.__r120Topic;
  function query(name){
    let id=null,selected='';
    const api={
      select(fields){selected=fields;return api;},
      eq(key,value){if(key==='id')id=value;return api;},
      in(){return api;},order(){return api;},range(){return api;},
      single:async()=>({data:name==='topics'&&id===topic.id?topic:null,error:null}),
      maybeSingle:async()=>({data:null,error:null}),
      then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}
    };
    return api;
  }
  const client={
    from:query,
    rpc:async()=>({data:0,error:null}),
    auth:{
      getUser:async()=>({data:{user:null}}),
      getSession:async()=>({data:{session:null}}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
    }
  };
  window.supabase={createClient:()=>client};
}

for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
    for(const locale of ['en-US','ja-JP']){
      const en=locale==='en-US';
      const context=await browser.newContext({
        viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale
      });
      await context.addInitScript(({project,publicTopic})=>{
        window.__r120Topic=publicTopic;
        localStorage.setItem('statsMakerV2Projects',JSON.stringify([project]));
      },{project,publicTopic});
      await context.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>
        route.fulfill({status:200,contentType:'application/javascript',
          body:'('+mockSupabase.toString()+')()'}));
      await context.route('**/*.supabase.co/**',route=>route.abort());
      await context.route('**/api/discover?*',route=>route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({rows:[],total:0,has_more:false,anchor:'r120-anchor'})
      }));
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(root+'/index.html?qa=r120',{waitUntil:'domcontentloaded'});
      await page.locator('#launcherTitle').waitFor({state:'attached',timeout:30000});
      // On mobile the main launcher is intentionally hidden in favor of the
      // visible scoring-toolbar shortcut inside the Home iframe.
      const mobileTool=page.frameLocator('#basicFrame').locator('#r80VisualsBtn');
      await mobileTool.waitFor({state:'visible',timeout:30000});
      assert.equal((await mobileTool.textContent()).trim(),en?'Visuals':'データやグラフ');
      await page.waitForFunction(value=>document.querySelector('#launcherTitle')?.textContent===value,
        en?'Visual Tools':'データやグラフ',{timeout:20000});
      assert.equal(await page.locator('#launcherTitle').textContent(),
        en?'Visual Tools':'データやグラフ');
      assert.equal(await page.locator('.globalLocaleSwitch button.active').textContent(),en?'EN':'JA');

      await page.goto(root+'/discover.html?qa=r120',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(value=>document.querySelector('.hero h1')?.textContent===value,
        en?'Discover public Stats':'みんなのStatsを見つける',{timeout:15000});
      assert.equal(await page.locator('[data-category="sports"]').textContent(),
        en?'Sports':'スポーツ');

      await page.goto(root+'/public.html?id='+publicId+'&qa=r120',
        {waitUntil:'domcontentloaded'});
      await page.locator('#visualToolsBtn').waitFor({state:'visible',timeout:25000});
      assert.match(await page.locator('#visualToolsBtn').textContent(),
        en?/Visual Tools/:/データやグラフ/);
      await page.locator('#visualToolsBtn').click();
      await page.locator('#publicVisualTitle').waitFor({state:'visible'});
      assert.match(await page.locator('#publicVisualTitle').textContent(),
        en?/Create a chart/:/公開作品から/);

      await page.goto(root+'/app/editor.html?id='+project.id+'&from=public&topic='+publicId,
        {waitUntil:'domcontentloaded'});
      await page.locator('#sourceQuickBar:not(.hidden)').waitFor({timeout:25000});
      const lead=await page.locator('.source-quick-lead b').textContent();
      assert.equal(lead,en?'SOURCE':'連動元','Linked source label not localized');
      await page.locator('.mobile-tab[data-panel="data"]').click();
      await page.locator('#mobilePanelContent .source-info-card').waitFor({timeout:15000});
      const panel=await page.locator('#mobilePanelContent').innerText();
      if(en){
        for(const label of ['Published creator scores','Axes','Display options','X axis','Overall average']){
          if(label==='Overall average')continue; // Quadrant chooses independent X and Y metrics.
          assert(panel.includes(label),'Missing English editor label '+label+': '+panel);
        }
        assert(!/(連動元|表示設定|比較項目|評価項目|項目平均|対象)/.test(panel),
          'Japanese-only controls remain in English panel: '+panel);
      }else assert(panel.includes('公開作品の採点データ'));
      assert.deepEqual(errors.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[],
        'Runtime errors on '+engine.name()+' '+locale);
      console.log('R120 '+engine.name()+' '+locale+
        ': Home, Discover, Public Visual Tools, linked chart editor PASS');
      await context.close();
    }
  }finally{await browser.close()}
}
