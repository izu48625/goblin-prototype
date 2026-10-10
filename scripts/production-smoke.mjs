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

  const home=await (await fetchOk(BASE_URL+'/')).text();
  assert(home.includes('id="basicFrame"'),'Home shell is missing basicFrame');

  const discover=await (await fetchOk(BASE_URL+'/discover.html')).text();
  assert(discover.includes('cloud/discover.js'),'Discover shell is missing cloud/discover.js');

  const publicHtml=await (await fetchOk(BASE_URL+'/public.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID))).text();
  assert(publicHtml.includes('cloud/public.js'),'Public shell is missing cloud/public.js');

  const rate=await (await fetchOk(BASE_URL+'/rate.html?id='+encodeURIComponent(PUBLIC_TOPIC_ID))).text();
  assert(rate.includes('cloud/rate.js'),'Rate shell is missing cloud/rate.js');

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
  await page.waitForURL(/index\.html\?remixed=1/,{timeout:30000});
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
else if(mode==='browser-discover')await browserDiscover();
else if(mode==='browser-public')await browserPublic();
else if(mode==='browser-remix-redirect')await browserRemixRedirect();
else if(mode==='browser-remix-storage')await browserRemixStorage();
else if(mode==='browser-remix-context')await browserRemixContext();
else if(mode==='browser-community-panel')await browserCommunityPanel();
else throw new Error('Unknown smoke mode: '+mode);
