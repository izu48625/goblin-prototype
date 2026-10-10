import fs from 'node:fs/promises';

const BASE_URL=process.env.BASE_URL||'https://statsmaker.app';
const PUBLIC_TOPIC_ID=process.env.PUBLIC_TOPIC_ID||'57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const mode=process.argv[2]||'http';

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function fetchOk(url,options={}){
  const response=await fetch(url,options);
  if(!response.ok)throw new Error(`${url} returned ${response.status}`);
  return response;
}

async function expectedRelease(){
  const source=await fs.readFile(new URL('../worker/index.js',import.meta.url),'utf8');
  const match=source.match(/release:'([^']+)'/);
  if(!match)throw new Error('Could not read release marker from worker/index.js');
  return match[1];
}

async function waitForRelease(){
  const expected=await expectedRelease();
  console.log('Waiting for Cloudflare production release:',expected);
  for(let attempt=1;attempt<=36;attempt++){
    try{
      const response=await fetchOk(BASE_URL+'/api/health');
      const data=await response.json();
      if(data?.ok===true&&data?.hosting==='cloudflare-workers'&&data?.release===expected){
        console.log('Production release matched:',expected);
        return;
      }
      console.log(`Attempt ${attempt}/36: current release ${data?.release||'unknown'}`);
    }catch(error){
      console.log(`Attempt ${attempt}/36: ${error.message}`);
    }
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  throw new Error('Timed out waiting for matching Cloudflare production release');
}

// Non-mutating negative probes after the privileged Community cutover.
// Anonymous callers must not reach either legacy or service-only RPC, and
// requests without a verified identity must not reach the Turnstile verifier.
async function securityDenialSmoke(){
  const guard=BASE_URL+'/api/guard/community';
  const notAllowed=await fetch(guard,{method:'GET',cache:'no-store'});
  assert(notAllowed.status===405,'Community gateway unexpectedly allows GET');

  const hostile=await fetch(guard,{
    method:'POST',
    headers:{Origin:'https://hostile.example','Content-Type':'application/json'},
    body:'{}',cache:'no-store'
  });
  assert(hostile.status===403,'Community gateway did not reject a foreign Origin');

  const wrongType=await fetch(guard,{
    method:'POST',
    headers:{Origin:BASE_URL,'Content-Type':'text/plain'},
    body:'{}',cache:'no-store'
  });
  assert(wrongType.status===415,'Community gateway accepted non-JSON request');

  const missingAuth=await fetch(guard,{
    method:'POST',
    headers:{Origin:BASE_URL,'Content-Type':'application/json'},
    body:JSON.stringify({p_topic_id:PUBLIC_TOPIC_ID,p_scores:[],p_submit:false,
      turnstile_token:'invalid-token-no-write'}),
    cache:'no-store'
  });
  assert(missingAuth.status===401,
    'Community gateway did not enforce authentication before a write');

  // The publishable key is already public in worker/index.js; never use or
  // fetch service-role credentials in this production negative test.
  const source=await fs.readFile(new URL('../worker/index.js',import.meta.url),'utf8');
  const url=source.match(/const SUPABASE_URL='([^']+)'/)?.[1];
  const publicKey=source.match(/const SUPABASE_KEY='([^']+)'/)?.[1];
  assert(url?.startsWith('https://')&&publicKey?.startsWith('sb_publishable_'),
    'Public Supabase API config unavailable for deny-only test');

  // Use a nonexistent topic UUID; a broken privilege should still not
  // create or modify any real rating data.
  const unknownId='00000000-0000-4000-8000-000000000000';
  for(const [rpc,params] of [
    ['save_my_topic_rating',{p_topic_id:unknownId,p_scores:[],p_submit:false}],
    ['gateway_save_my_topic_rating',{p_user_id:unknownId,
      p_topic_id:unknownId,p_scores:[],p_submit:false}]
  ]){
    const response=await fetch(url+'/rest/v1/rpc/'+rpc,{
      method:'POST',
      headers:{apikey:publicKey,'Content-Type':'application/json'},
      body:JSON.stringify(params),cache:'no-store'
    });
    assert([401,403,404].includes(response.status),
      'Anonymous direct '+rpc+' was not blocked by authorization ('+response.status+')');
  }
  console.log('Security denial probes PASS (no real rating writes).');
}

async function waitForGlobalLanguageDeploy(){
  for(let attempt=1;attempt<=40;attempt++){
    try{
      const response=await fetch(BASE_URL+'/index.html?qaLang='+Date.now(),{cache:'no-store'});
      const html=await response.text();
      const editor=await fetch(BASE_URL+'/app/editor.html?qaLang='+Date.now(),{cache:'no-store'});
      const editorHtml=await editor.text();
      if(response.ok&&editor.ok&&html.includes('global-locale.js?v=r27lang1')&&
        editorHtml.includes('global-locale.js?v=r27lang1'))return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error('Global-language front-end deployment has not reached production.');
}

async function httpSmoke(){
  await waitForRelease();
  await waitForGlobalLanguageDeploy();

  const securityResponse=await fetchOk(BASE_URL+'/api/security/config');
  const security=await securityResponse.json();
  assert(security?.turnstileConfigured===true,
    'Production Turnstile SITE_KEY or SECRET runtime variable is missing.');
  assert(security.communityGatewayEnabled===true,
    'Turnstile Community staged gateway must remain enabled during R26 P4 supervised cutover.');
  assert(typeof security.siteKey==='string' && security.siteKey.length>6,
    'The enabled Community gateway must expose only the public Turnstile site key.');
  assert(security.trustedGatewayConfigured===true,
    'SUPABASE_SERVICE_ROLE_KEY is not configured as a valid legacy service_role JWT in Cloudflare Production.');
  assert((securityResponse.headers.get('cache-control')||'').includes('no-store'),
    'Turnstile config must not be cached.');
  console.log('Turnstile keys and privileged gateway ready; staged Community gateway enabled.');
  await securityDenialSmoke();

  const home=await (await fetchOk(BASE_URL+'/')).text();
  assert(home.includes('id="basicFrame"'),'Home shell is missing basicFrame');

  const discover=await (await fetchOk(BASE_URL+'/discover.html')).text();
  assert(discover.includes('cloud/discover.js'),'Discover shell is missing cloud/discover.js');

  const publicHtml=await (await fetchOk(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID))).text();
  assert(publicHtml.includes('cloud/public.js'),'Public shell is missing cloud/public.js');

  const rate=await (await fetchOk(BASE_URL+'/rate.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID))).text();
  assert(rate.includes('index.html?community=')&&rate.includes("params.get('legacy')==='1'"),
    'Standard rate route must redirect to shared Home with a legacy fallback.');
  assert(rate.includes('cloud/rate.js')&&rate.includes('global-locale.js')&&
    !rate.includes('id="homeLink"'),
    'Legacy rating fallback must keep the shared Home action without a duplicate HOME button.');

  const rateJs=await (await fetchOk(BASE_URL+'/cloud/rate.js')).text();
  assert(rateJs.includes('participantPill'),'Rate UI is missing participant-count feedback');
  assert(rateJs.includes('get_topic_participant_count'),'Rate UI is missing participant-count refresh');

  const share=await (await fetchOk(BASE_URL+'/p/'+encodeURIComponent(PUBLIC_TOPIC_ID))).text();
  assert(share.includes('property="og:title"'),'Share page is missing og:title');
  assert(share.includes(BASE_URL+'/public.html?id='+PUBLIC_TOPIC_ID),'Share canonical/public URL is not same-origin');
  assert(share.includes(BASE_URL+'/api/og?id='+PUBLIC_TOPIC_ID),'Share OG image URL is not same-origin');

  const og=await fetchOk(BASE_URL+'/api/og?id='+encodeURIComponent(PUBLIC_TOPIC_ID));
  assert((og.headers.get('content-type')||'').toLowerCase().includes('image/png'),'OG endpoint did not return image/png');
  const bytes=new Uint8Array(await og.arrayBuffer());
  const expectedSig=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  assert(expectedSig.every((b,i)=>bytes[i]===b),'OG response is not a PNG');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const width=view.getUint32(16);
  const height=view.getUint32(20);
  assert(width===1200&&height===630,`Unexpected OGP size: ${width}x${height}`);

  console.log('HTTP smoke PASS');
}

async function withBrowser(testName,test){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({
      locale:'ja-JP',
      viewport:{width:390,height:844}
    });
    const page=await context.newPage();
    await test(page);
    console.log(testName+' PASS');
  }finally{
    await browser.close();
  }
}

async function browserHome(){
  await withBrowser('Browser home',async page=>{
    await page.goto(BASE_URL+'/',{waitUntil:'networkidle',timeout:60000});
    const frame=page.frameLocator('#basicFrame');
    await frame.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    assert(await frame.locator('#titleInput').inputValue()==='','Fresh browser should start with a blank title');
    assert(await frame.locator('#descInput').inputValue()==='','Fresh browser should start with a blank description');

    assert(await page.locator('.globalLocaleBar').count()===1,
      'Home must have exactly one shared outer locale bar');
    assert(await frame.locator('.globalLocaleBar').count()===0,
      'Embedded Home still adds a duplicate locale bar');
    assert(await page.locator('.globalHomeBtn').isVisible(),
      'HOME button must be pinned in the shared upper bar');
    assert(await frame.locator('#editorHomeBtn').isHidden(),
      'Old Home action must not duplicate shared upper HOME');
    assert(await frame.locator('#myPageBtn').count()===0,'My Page must not be exposed in editor');
    assert(await frame.locator('#publishSignInBtn').count()===0,'Login UI must not be exposed');
  });
}

async function browserDiscover(){
  await withBrowser('Browser Discover',async page=>{
    await page.goto(BASE_URL+'/discover.html',{waitUntil:'networkidle',timeout:60000});
    await page.locator('#grid:not(.hidden)').waitFor({timeout:30000});
    assert(await page.locator('.workCard').count()>0,'Discover returned no public work cards');
    assert(await page.locator('#homeLink').count()===0,
      'Discover still renders an extra HOME beneath the global bar');
    assert(await page.locator('.globalHomeBtn').count()===1,
      'Discover must have one global HOME');
    assert((await page.locator('.globalHomeBtn').getAttribute('href')||'').includes('fresh=1'),
      'Global HOME must open a fresh sheet');
  });
}

async function browserEditorHome(){
  await withBrowser('Browser editor HOME',async page=>{
    await page.goto(BASE_URL+'/',{waitUntil:'networkidle',timeout:60000});
    const frame=page.frameLocator('#basicFrame');
    await frame.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    await frame.locator('#titleInput').fill('EDITOR HOME PRESERVED');
    await frame.locator('#descInput').fill('do not erase me');

    await page.locator('.globalHomeBtn').waitFor({state:'visible',timeout:30000});
    assert(await frame.locator('#editorHomeBtn').isHidden(),'Duplicate embedded HOME is visible');
    const buttons=frame.locator('.topActions > :not(.hidden):visible');
    assert(await buttons.count()>=4,'Remaining Home actions must stay visible');
    await page.locator('.globalHomeBtn').click();
    await page.waitForTimeout(700);
    assert(await frame.locator('#titleInput').inputValue()==='','Editor HOME should clear current title');
    assert(await frame.locator('#descInput').inputValue()==='','Editor HOME should clear current description');
    assert(await frame.locator('#remixContextPanel').isHidden(),'Editor HOME should leave Remix context');
    assert(await frame.locator('#communityJoinPanel').isHidden(),'Editor HOME should leave Community participation');
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('statsMakerV014Library')||'null'));
    assert(state?.sheets?.some(s=>s.title==='EDITOR HOME PRESERVED'),'Editor HOME erased a saved sheet');
    const active=state.sheets.find(s=>s.id===state.activeId);
    assert(active?.title===''&&active?.rows?.length===4&&active?.cols?.length===4,'Editor HOME should use the default blank four-by-four format');
    assert(!active.sourceTopicId,'Editor HOME should not retain a Remix source');

    assert(await page.locator('.globalHomeBtn').isVisible(),'Pinned HOME is unavailable after reset');
  });
}

async function browserFreshHome(){
  await withBrowser('Browser fresh Home',async page=>{
    await page.goto(BASE_URL+'/',{waitUntil:'networkidle',timeout:60000});
    const frame=page.frameLocator('#basicFrame');
    await frame.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    await frame.locator('#titleInput').fill('SMOKE KEEP SHEET');
    await frame.locator('#descInput').fill('must survive fresh Home');
    await page.waitForTimeout(700);

    await page.goto(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID),{waitUntil:'networkidle',timeout:60000});
    await page.locator('#content:not(.hidden)').waitFor({timeout:30000});
    assert(await page.locator('#homeLink').count()===0,
      'Public work still renders redundant HOME');
    assert(await page.locator('.globalHomeBtn').count()===1,
      'Public work needs exactly one global HOME');
    await page.locator('.globalHomeBtn').click();

    const freshFrame=page.frameLocator('#basicFrame');
    await freshFrame.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    await page.waitForTimeout(500);
    assert(await freshFrame.locator('#titleInput').inputValue()==='','Home should open a fresh blank title');
    assert(await freshFrame.locator('#descInput').inputValue()==='','Home should open a fresh blank description');

    const library=await page.evaluate(()=>{
      try{return JSON.parse(localStorage.getItem('statsMakerV014Library')||'null')}catch{return null}
    });
    assert(library&&Array.isArray(library.sheets),'Fresh Home lost the local library');
    assert(library.sheets.some(sheet=>sheet.title==='SMOKE KEEP SHEET'),'Fresh Home must preserve existing sheets');
    const active=library.sheets.find(sheet=>sheet.id===library.activeId);
    assert(active&&active.title==='','Fresh Home active sheet should be blank');
  });
}

async function browserPublic(){
  await withBrowser('Browser public/community',async page=>{
    await page.goto(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID),{waitUntil:'networkidle',timeout:60000});
    await page.locator('#content:not(.hidden)').waitFor({timeout:30000});
    assert((await page.locator('h1').first().innerText()).trim().length>0,'Public work title missing');
    await page.locator('#communityContent').waitFor({state:'visible',timeout:30000});
    assert(await page.locator('#homeLink').count()===0,
      'Public page rendered a second HOME');
    assert(await page.locator('.globalHomeBtn').isVisible(),
      'Public page global HOME not visible');
    const communityText=await page.locator('#communityContent').innerText();
    assert(!communityText.includes('集計中'),'Community summary did not finish loading');
    const newRating=page.locator('#communityRateLink');
    assert(await newRating.count()===1,'Enabled Community lacks standard rating entry');
    const href=await newRating.getAttribute('href')||'';
    assert(href.includes('index.html?community='+PUBLIC_TOPIC_ID),
      'Community rating entry does not open actual Home workspace');
  });
}

async function navigateRemix(page){
  await page.goto(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID),{waitUntil:'networkidle',timeout:60000});
  await page.locator('#content:not(.hidden)').waitFor({timeout:30000});
  assert((await page.locator('#remixBtn').innerText()).includes('コピーして採点する'),
    'Public copy action wording regressed');
  await page.locator('#remixBtn').click();
  await page.waitForURL(url=>url.searchParams.get('remixed')==='1',{timeout:30000});
}

async function browserRemixRedirect(){
  await withBrowser('Browser Remix redirect',async page=>{
    await navigateRemix(page);
  });
}

async function browserRemixStorage(){
  await withBrowser('Browser Remix storage',async page=>{
    await navigateRemix(page);
    const state=await page.evaluate(()=>{
      try{return JSON.parse(localStorage.getItem('statsMakerV014Library')||'null')}catch{return null}
    });
    assert(state&&Array.isArray(state.sheets)&&state.sheets.length>0,'Remix library was not saved');
    const active=state.sheets.find(sheet=>sheet.id===state.activeId);
    assert(active?.sourceTopicId===PUBLIC_TOPIC_ID,'Remix active sheet lost sourceTopicId');
    assert(active.title.endsWith('（コピー）')&&!/\(Remix\)\s*\(Remix\)/i.test(active.title),
      'Copied sheet name retained stacked Remix labels');
    assert(active.rows.every(row=>row.scores.every(v=>v===null)),
      'Copy incorrectly inherited creator scores');
  });
}

async function browserRemixContext(){
  await withBrowser('Browser Remix context',async page=>{
    await navigateRemix(page);
    const remixFrame=page.frameLocator('#basicFrame');
    await remixFrame.locator('#remixContextPanel:not(.hidden)').waitFor({timeout:30000});
    assert(await remixFrame.locator('.remixChoiceGrid').count()===0,
      'Verbose Remix choice cards were not removed');
    assert((await remixFrame.locator('.remixContextHelp').innerText()).includes('点数は空欄です'),
      'Short copy explanation did not display');
    assert((await remixFrame.locator('#remixPublishOwnBtn').innerText())==='別作品として公開',
      'Separate publish label is unclear');
  });
}

async function browserCommunityPanel(){
  await withBrowser('Browser Community panel',async page=>{
    await navigateRemix(page);
    const remixFrame=page.frameLocator('#basicFrame');
    await remixFrame.locator('#communityJoinPanel:not(.hidden)').waitFor({timeout:30000});
    assert(await remixFrame.locator('#communityJoinBtn').count()===1,'Community join action missing after Remix');
  });
}

// Browser QA with a mocked Supabase SDK: exercises real Home UI and Community
// submit wiring without creating anonymous users or writing production ratings.
async function browserCommunityHome(){
  await withBrowser('Browser Community Home parity',async page=>{
    const mockSdk=`
      (() => {
        const id='57b432ed-fbf2-4261-b57d-9e0f27356d2e';
        let count=1;
        const client={
          auth:{
            getSession:async()=>({data:{session:{
              user:{id:'11111111-1111-4111-8111-111111111111'},access_token:'fake-test-token'
            }},error:null})
          },
          from(table){
            return {
              select(){
                return {
                  eq(){
                    return {
                      single:async()=>table==='topics'?({data:{
                        id,title:'COMMUNITY HOME MOCK',description:'QA',
                        language_code:'ja',score_scale:10,weighted:false,
                        allow_ratings:true,visibility:'public',
                        topic_items:[
                          {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Alpha',position:0},
                          {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Beta',position:1}
                        ],
                        criteria:[
                          {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Shoot',weight:1,position:0},
                          {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'IQ',weight:1,position:1}
                        ]
                      },error:null}):({data:null,error:{message:'Unexpected single'}}),
                      maybeSingle:async()=>({data:null,error:null})
                    };
                  }
                };
              }
            };
          },
          async rpc(name,params){
            if(name==='get_topic_participant_count')
              return {data:count,error:null};
            if(name==='save_my_topic_rating'){
              throw new Error('Direct legacy RPC called during secure Community smoke');
            }
            return {data:null,error:{message:'Unexpected RPC '+name}};
          }
        };
        window.__communityMockMarkSaved=params=>{
          window.__communityMockSaved=params;
          count=2;
        };
        window.supabase={createClient:()=>client};
      })();`;
    await page.route('**/supabase-js@2',route=>
      route.fulfill({status:200,contentType:'application/javascript',body:mockSdk}));
    await page.route('**/api/security/config',route=>
      route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({communityGatewayEnabled:true,siteKey:'test-public-sitekey',
          turnstileConfigured:true,trustedGatewayConfigured:true})}));
    await page.route('**/turnstile/v0/api.js?*',route=>
      route.fulfill({status:200,contentType:'application/javascript',
        body:`window.turnstile={render:(_slot,opts)=>{
          Promise.resolve().then(()=>opts.callback('QA_TOKEN_FOR_MOCK_ONLY'));
          return 'mock-widget';
        },remove:()=>{}};`}));
    await page.route('**/api/guard/community',async route=>{
      const req=route.request(),body=req.postDataJSON();
      assert(req.method()==='POST'&&
        req.headers()['authorization']==='Bearer fake-test-token'&&
        body.turnstile_token==='QA_TOKEN_FOR_MOCK_ONLY',
        'Community did not use authenticated Turnstile gateway');
      await page.evaluate(params=>window.__communityMockMarkSaved(params),body);
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({data:{rating_set_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          rating_status:'submitted',submitted_at:new Date().toISOString()}})});
    });
    await page.goto(BASE_URL+'/index.html?community='+encodeURIComponent(PUBLIC_TOPIC_ID),
      {waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('#communityControls:not(.hidden)').waitFor({timeout:30000});
    const frame=page.frameLocator('#basicFrame');
    await frame.locator('#scoreTable .scoreInput').first().waitFor({timeout:30000});
    assert(await frame.locator('#titleInput').inputValue()==='COMMUNITY HOME MOCK',
      'Community did not mount topic into the actual Home title');
    assert(await frame.locator('#sheetViewBtn').count()===1&&
      await frame.locator('#overviewViewBtn').count()===1&&
      await frame.locator('#radarTab').count()===1,
      'Community does not use real Home comparison UI');
    assert(await frame.locator('#titleInput').isEditable()===false,
      'Public topic title can be modified in Community mode');
    assert(await frame.locator('#addRowBtn').isHidden(),
      'Community exposed structural row editing');
    const initialStorage=await page.evaluate(()=>localStorage.getItem('statsMakerV014Library'));
    await frame.locator('[data-score-row="0"][data-score-col="0"]').fill('8');
    assert(await frame.locator('#scoreTable tbody tr').nth(0).locator('.progressPill').innerText()==='1/2',
      'Community incomplete row count did not update live');
    assert(await frame.locator('#scoreTable tbody tr').nth(0).locator('.avgValue').innerText()==='8',
      'Community first score average did not update live');
    await frame.locator('[data-score-row="0"][data-score-col="1"]').fill('10');
    assert(await frame.locator('#scoreTable tbody tr').nth(0).locator('.progressPill').innerText()==='2/2',
      'Community completed row count did not update live');
    assert(await frame.locator('#scoreTable tbody tr').nth(0).locator('.avgValue').innerText()==='9',
      'Community two-score average did not update live');
    await frame.locator('[data-score-row="1"][data-score-col="0"]').fill('9');
    assert(await frame.locator('#scoreTable tbody tr').nth(1).locator('.progressPill').innerText()==='1/2',
      'Community next row count did not update live');
    assert(await frame.locator('#scoreTable tbody tr').nth(1).locator('.avgValue').innerText()==='9',
      'Community partial row average did not update live');
    assert((await page.locator('#communityMessage').innerText()).includes('未保存'),
      'Score changes did not show unsaved reminder');
    assert(await page.evaluate(()=>!window.__communityMockSaved),
      'Community score edits were automatically submitted without user action');
    await frame.locator('[data-sort-now="0"][data-sort-dir="desc"]').first().click();
    await frame.locator('#overviewViewBtn').click();
    await frame.locator('#sheetViewBtn').click();
    await page.locator('#communitySubmit').click();
    try{
      await page.locator('.communityMessage.ok').waitFor({timeout:9000});
    }catch(error){
      const message=await page.locator('#communityMessage').innerText();
      const sheet=await frame.locator('#scoreTable').evaluate(
        el=>el.ownerDocument.defaultView.__statsMakerGetActiveSheet?.()
      );
      const saved=await page.evaluate(()=>window.__communityMockSaved||null);
      throw new Error('Mock Community Home save did not succeed: '+
        JSON.stringify({message,rows:sheet?.rows,cols:sheet?.cols,saved}));
    }
    const result=await page.evaluate(()=>window.__communityMockSaved);
    assert(result?.turnstile_token==='QA_TOKEN_FOR_MOCK_ONLY',
      'Community submission did not send verified challenge token');
    assert(result?.p_scores?.length===3,'Community Home sent wrong score count');
    assert(result.p_scores[0]?.item_id==='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      && result.p_scores[0]?.score===9,
      'Home sorting lost Beta identity');
    assert(result.p_scores.slice(1).every(row=>
      row.item_id==='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      'Home sorting corrupted Alpha identity');
    assert(await page.locator('#communityParticipant').innerText()==='参加者 2人',
      'Community participant count did not refresh');
    assert(await page.evaluate(()=>localStorage.getItem('statsMakerV014Library'))===initialStorage,
      'Community Home overwrote local Home saved sheets');
    // Old saved URLs automatically open the same Home UI, while the manual
    // emergency fallback remains accessible without losing its former form.
    await page.goto(BASE_URL+'/rate.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID),
      {waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(750);
    const actualRedirect=new URL(page.url());
    assert((actualRedirect.pathname.endsWith('/index.html')||
      actualRedirect.pathname==='/')&&
      actualRedirect.searchParams.get('community')===PUBLIC_TOPIC_ID,
      'Rate page did not redirect to Community Home (actual URL: '+page.url()+')');
    // The fallback is separately verified in HTTP smoke as an unchanged
    // legacy shell with an explicit ?legacy=1 bypass of the redirect.
  });
}

// A real browser toggles language without editing the Home library, then
// traverses routes that historically chose incompatible language settings.
async function browserGlobalLanguage(){
  await withBrowser('Browser global JA/EN across routes',async page=>{
    await page.goto(BASE_URL+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    const frame=page.frameLocator('#basicFrame');
    await frame.locator('#titleInput').waitFor({timeout:30000});
    const bar=page.locator('.globalLocaleBar');
    assert(await bar.count()===1,'Home shared locale bar missing');

    assert(await frame.locator('.homeLangSwitch').count()===0,
      'Old locale control remains beside the sheet title');
    assert(await frame.locator('.globalLocaleBar').count()===0,
      'Nested Home frame has duplicated the JA/EN control');
    assert(await page.locator('.globalHomeBtn').count()===1,
      'The shared top bar must include a single HOME button');
    const beforeTop=await page.locator('.globalHomeBtn').boundingBox();
    await frame.locator('body').evaluate(el=>{el.scrollTop=620;el.ownerDocument.documentElement.scrollTop=620;});
    const afterTop=await page.locator('.globalHomeBtn').boundingBox();
    assert(beforeTop&&afterTop&&Math.abs(beforeTop.y-afterTop.y)<2,
      'HOME scrolled away rather than remaining pinned');
    const input=frame.locator('#titleInput');
    await input.fill('DO NOT ERASE LANGUAGE QA');
    await bar.locator('[data-global-lang="en"]').click();
    await page.waitForFunction(()=>localStorage.getItem('statsMaker.locale')==='en');
    assert(await input.inputValue()==='DO NOT ERASE LANGUAGE QA',
      'Switching Home locale erased the active sheet');
    assert(await frame.locator('#publishBtn').innerText()==='Publish',
      'Home was not translated to English');
    await page.goto(BASE_URL+'/discover.html',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.hero h1')?.textContent==='Discover public Stats',
      {timeout:30000});
    assert(await page.locator('.globalLocaleBar [data-global-lang="en"]').getAttribute('aria-pressed')==='true',
      'Discover did not keep the selected English locale');
    await page.goto(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID),
      {waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('#content:not(.hidden)').waitFor({timeout:30000});
    assert(await page.locator('#remixBtn').innerText().then(x=>x.includes('Copy & rate')),
      'Public work ignored selected English locale');
    await page.locator('.globalLocaleBar [data-global-lang="ja"]').click();
    await page.waitForFunction(()=>document.documentElement.lang==='ja'&&
      document.querySelector('#remixBtn')?.textContent?.includes('コピーして採点する'),{timeout:30000});
    await page.goto(BASE_URL+'/my.html',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('#pageLead')?.textContent.includes('アカウント'),
      {timeout:30000});
    assert(await page.locator('.globalLocaleBar').count()===1,'My Page shared locale bar missing');
    const projectId=await page.evaluate(async()=>{
      const [{createProject},{saveProject}]=await Promise.all([
        import('/app/src/core/project.js'),import('/app/src/core/store.js')
      ]);
      const p=createProject('bar');
      p.meta.title='SAFE LOCALE GRAPH';
      saveProject(p);
      return p.id;
    });
    await page.goto(BASE_URL+'/app/editor.html?id='+encodeURIComponent(projectId),
      {waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('#projectTitleInput').waitFor({state:'visible',timeout:30000});
    // The input itself exists in the initial HTML; the async chart editor
    // fills it only after its ES modules have loaded and rendered the project.
    await page.waitForFunction(()=>document.querySelector('#projectTitleInput')?.value==='SAFE LOCALE GRAPH',
      null,{timeout:30000});
    assert(await page.locator('#projectTitleInput').inputValue()==='SAFE LOCALE GRAPH',
      'Visual editor failed to load saved chart');
    assert(await page.locator('.globalLocaleBar').count()===1,
      'Visual editor shared locale bar missing');
    assert(await page.evaluate(()=>localStorage.getItem('statsMaker.locale'))==='ja',
      'Visual editor did not retain the global locale');
    await page.locator('.globalLocaleBar [data-global-lang="en"]').click();
    await page.waitForFunction(()=>document.documentElement.lang==='en');
    assert(await page.locator('#projectTitleInput').inputValue()==='SAFE LOCALE GRAPH',
      'Visual editor language toggle erased chart title');
    assert(await page.locator('#langBtn').isHidden(),
      'Old graph editor language toggle was not consolidated');
    assert(await page.evaluate(()=>localStorage.getItem('statsMakerV2Language'))==='en',
      'Visual editor did not sync older V2 language preference');
    const saved=await page.evaluate(id=>{
      const p=JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]');
      return p.find(x=>x.id===id)?.meta.title;
    },projectId);
    assert(saved==='SAFE LOCALE GRAPH','Visual editor language toggle changed saved project');
  });
}

if(mode==='http')await httpSmoke();
else if(mode==='browser-home')await browserHome();
else if(mode==='browser-global-language')await browserGlobalLanguage();
else if(mode==='browser-editor-home')await browserEditorHome();
else if(mode==='browser-discover')await browserDiscover();
else if(mode==='browser-fresh-home')await browserFreshHome();
else if(mode==='browser-public')await browserPublic();
else if(mode==='browser-remix-redirect')await browserRemixRedirect();
else if(mode==='browser-remix-storage')await browserRemixStorage();
else if(mode==='browser-remix-context')await browserRemixContext();
else if(mode==='browser-community-panel')await browserCommunityPanel();
else if(mode==='browser-community-home')await browserCommunityHome();
else throw new Error('Unknown smoke mode: '+mode);
