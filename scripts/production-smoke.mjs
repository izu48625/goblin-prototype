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

async function httpSmoke(){
  await waitForRelease();

  const securityResponse=await fetchOk(BASE_URL+'/api/security/config');
  const security=await securityResponse.json();
  assert(security?.turnstileConfigured===true,
    'Production Turnstile SITE_KEY or SECRET runtime variable is missing.');
  assert(security.communityGatewayEnabled===false,
    'Turnstile Community gateway was enabled before the bypass-proof DB cutover.');
  assert(security.siteKey===null,
    'Turnstile sitekey should not be exposed while the gateway is disabled.');
  assert(security.trustedGatewayConfigured===true,
    'SUPABASE_SERVICE_ROLE_KEY is not configured as a valid legacy service_role JWT in Cloudflare Production.');
  assert((securityResponse.headers.get('cache-control')||'').includes('no-store'),
    'Turnstile config must not be cached.');
  console.log('Turnstile keys detected; Community gateway intentionally disabled.');

  const home=await (await fetchOk(BASE_URL+'/')).text();
  assert(home.includes('id="basicFrame"'),'Home shell is missing basicFrame');

  const discover=await (await fetchOk(BASE_URL+'/discover.html')).text();
  assert(discover.includes('cloud/discover.js'),'Discover shell is missing cloud/discover.js');

  const publicHtml=await (await fetchOk(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID))).text();
  assert(publicHtml.includes('cloud/public.js'),'Public shell is missing cloud/public.js');

  const rate=await (await fetchOk(BASE_URL+'/rate.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID))).text();
  assert(rate.includes('cloud/rate.js'),'Rate shell is missing cloud/rate.js');
  assert(rate.includes('fresh=1'),'Rate page is missing fresh Home navigation');

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
    assert(await frame.locator('#myPageBtn').count()===0,'My Page must not be exposed in editor');
    assert(await frame.locator('#publishSignInBtn').count()===0,'Login UI must not be exposed');
  });
}

async function browserDiscover(){
  await withBrowser('Browser Discover',async page=>{
    await page.goto(BASE_URL+'/discover.html',{waitUntil:'networkidle',timeout:60000});
    await page.locator('#grid:not(.hidden)').waitFor({timeout:30000});
    assert(await page.locator('.workCard').count()>0,'Discover returned no public work cards');
    assert((await page.locator('#homeLink').getAttribute('href')||'').includes('fresh=1'),'Discover Home does not request a fresh sheet');
  });
}

async function browserEditorHome(){
  await withBrowser('Browser editor HOME',async page=>{
    await page.goto(BASE_URL+'/',{waitUntil:'networkidle',timeout:60000});
    const frame=page.frameLocator('#basicFrame');
    await frame.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    await frame.locator('#titleInput').fill('EDITOR HOME PRESERVED');
    await frame.locator('#descInput').fill('do not erase me');
    await frame.locator('#editorHomeBtn').waitFor({state:'visible',timeout:30000});
    const buttons=frame.locator('.topActions > :not(.hidden):visible');
    assert(await buttons.count()>=5,'Editor top bar should include HOME plus existing actions');
    await frame.locator('#editorHomeBtn').click();
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
    assert(await frame.locator('#editorHomeBtn').isVisible(),'Editor HOME button should remain available');
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
    assert((await page.locator('#homeLink').getAttribute('href')||'').includes('fresh=1'),'Public Home does not request a fresh sheet');
    await page.locator('#homeLink').click();

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
    const communityText=await page.locator('#communityContent').innerText();
    assert(!communityText.includes('集計中'),'Community summary did not finish loading');
  });
}

async function navigateRemix(page){
  await page.goto(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID),{waitUntil:'networkidle',timeout:60000});
  await page.locator('#content:not(.hidden)').waitFor({timeout:30000});
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
  });
}

async function browserRemixContext(){
  await withBrowser('Browser Remix context',async page=>{
    await navigateRemix(page);
    const remixFrame=page.frameLocator('#basicFrame');
    await remixFrame.locator('#remixContextPanel:not(.hidden)').waitFor({timeout:30000});
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

if(mode==='http')await httpSmoke();
else if(mode==='browser-home')await browserHome();
else if(mode==='browser-editor-home')await browserEditorHome();
else if(mode==='browser-discover')await browserDiscover();
else if(mode==='browser-fresh-home')await browserFreshHome();
else if(mode==='browser-public')await browserPublic();
else if(mode==='browser-remix-redirect')await browserRemixRedirect();
else if(mode==='browser-remix-storage')await browserRemixStorage();
else if(mode==='browser-remix-context')await browserRemixContext();
else if(mode==='browser-community-panel')await browserCommunityPanel();
else throw new Error('Unknown smoke mode: '+mode);
