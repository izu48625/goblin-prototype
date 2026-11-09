import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const origin=process.env.BASE_URL||'http://127.0.0.1:4173';
const id='57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const cases=[
  {name:'author-enabled',flags:{visibility:'public',show_community:true,allow_ratings:true},success:true},
  {name:'author-disabled',flags:{visibility:'public',show_community:false,allow_ratings:true},success:false},
  {name:'ratings-disabled',flags:{visibility:'public',show_community:true,allow_ratings:false},success:false},
  {name:'private',flags:{visibility:'private',show_community:true,allow_ratings:true},success:false},
  {name:'unlisted-direct',flags:{visibility:'unlisted',show_community:true,allow_ratings:true},success:true}
];
const browsers=[chromium,webkit];
for(const engine of browsers){
  const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
  try{
    for(const scenario of cases){
      const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
      const unexpected=[];
      await ctx.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({
        status:200,contentType:'application/javascript',body:'// Supabase browser SDK stubbed by test startup.'
      }));
      await ctx.route('https://ibpdxbeltdwkquowjeay.supabase.co/**',route=>{
        unexpected.push(route.request().url());return route.abort();
      });
      await ctx.addInitScript(({id,flags})=>{
        window.__r133Calls={topics:0,own:0,auth:0,rpc:0,anonymous:0};
        localStorage.setItem('statsMakerV014Library','{"sentinel":"home-data-unchanged"}');
        const topic={id,title:'Community test',description:'Factual fixture',
          language_code:'ja',score_scale:10,weighted:false,community_minimum:1,
          topic_items:[{id:'00000000-0000-4000-8000-000000000001',name:'Alpha',position:0},
            {id:'00000000-0000-4000-8000-000000000002',name:'Beta',position:1}],
          criteria:[{id:'00000000-0000-4000-8000-000000000011',name:'Attack',weight:1,position:0},
            {id:'00000000-0000-4000-8000-000000000012',name:'Defense',weight:1,position:1}],
          ...flags};
        const client={
          auth:{
            getSession:async()=>{window.__r133Calls.auth++;return {data:{session:{user:{id:'mock-user'}}},error:null}},
            signInAnonymously:async()=>{window.__r133Calls.anonymous++;throw Error('No real auth needed')},
            getUser:async()=>({data:{user:{id:'mock-user'}}})
          },
          from(table){
            const query={
              select(){return query},eq(){return query},in(){return query},
              single:async()=>{
                if(table==='topics'){window.__r133Calls.topics++;return {data:topic,error:null}}
                window.__r133Calls.own++;return {data:null,error:null};
              },
              maybeSingle:async()=>{
                window.__r133Calls.own++;return {data:null,error:null};
              }
            };
            return query;
          },
          rpc:async()=>{window.__r133Calls.rpc++;return {data:0,error:null}}
        };
        window.supabase={createClient:()=>client};
      },{id,flags:scenario.flags});
      const page=await ctx.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/index.html?community='+id,{waitUntil:'domcontentloaded',timeout:20000});
      if(scenario.success){
        await page.locator('#communityControls:not(.hidden)').waitFor({timeout:17000});
        const state=await page.evaluate(()=>{
          return {calls:window.__r133Calls,
            home:localStorage.getItem('statsMakerV014Library'),
            back:document.getElementById('communityBackLink').getAttribute('href'),
            form:document.getElementById('communityControls').className};
        });
        assert(state.calls.topics>=1&&state.calls.auth>=1&&state.calls.own>=1,
          'Enabled join must validate topic, authenticate, and retrieve own ratings: '+JSON.stringify(state));
        assert.equal(state.calls.anonymous,0);
        assert.equal(state.back,'public.html?id='+id);
        assert.equal(state.home,'{"sentinel":"home-data-unchanged"}',
          'Community mode cannot replace the Home library');
        const active=await page.locator('#basicFrame').evaluate(frame=>{
          const sheet=frame.contentWindow?.__statsMakerGetActiveSheet?.();
          return {source:sheet?.sourceTopicId,rows:sheet?.rows?.map(r=>r.name),cols:sheet?.cols};
        });
        assert.equal(active.source,id);
        assert.deepEqual(active.rows,['Alpha','Beta']);
        assert.deepEqual(active.cols,['Attack','Defense']);
      }else{
        await page.locator('#communityLoading.error .communityLoadBack').waitFor({timeout:15000});
        const state=await page.evaluate(()=>({
          calls:window.__r133Calls,
          text:document.getElementById('communityLoading').textContent,
          href:document.querySelector('.communityLoadBack')?.getAttribute('href'),
          controlsHidden:document.getElementById('communityControls').classList.contains('hidden'),
          home:localStorage.getItem('statsMakerV014Library')
        }));
        assert.equal(state.calls.topics,1);
        assert.equal(state.calls.auth,0,'Invalid link must not trigger identity checks');
        assert.equal(state.calls.own,0,'Invalid link must not read private rating set');
        assert.equal(state.calls.anonymous,0,'Invalid link must never create an anonymous account');
        assert(state.controlsHidden&&state.text.includes('採点を受け付けていません'));
        assert.equal(state.href,'public.html?id='+id);
        assert.equal(state.home,'{"sentinel":"home-data-unchanged"}');
      }
      assert.deepEqual(unexpected,[],'No production Supabase network requests permitted');
      assert(!errors.some(s=>/community-home|Cannot read properties|SyntaxError/.test(s)),
        'Unexpected JavaScript errors '+JSON.stringify(errors));
      console.log('R133 '+engine.name()+' '+scenario.name+' PASS');
      await ctx.close();
    }
  }finally{await browser.close()}
}
