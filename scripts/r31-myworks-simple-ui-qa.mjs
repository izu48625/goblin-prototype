import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.BASE_URL||'http://127.0.0.1:8765';
const fakeSupabase=String.raw`
(() => {
  let works=[{
    id:'11111111-1111-4111-8111-111111111111',owner_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title:'PRESERVE EXISTING OWNER WORK',description:'Existing saved work',
    visibility:'public',score_scale:100,
    snapshot:{rows:[{name:'Alpha',scores:[99]}],criteria:[{name:'Quality'}]},
    published_at:'2026-10-10T03:00:00Z',
    snapshot_updated_at:'2026-10-10T03:00:00Z'
  }];
  let changed=0;
  const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',is_anonymous:true};
  const session=window.__R31_NO_SESSION__?null:{user};
  window.__R31_MOCK__={
    get updates(){return changed},
    get works(){return works.map(w=>({...w}))}
  };
  const client={
    auth:{
      getSession:async()=>({data:{session},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
    },
    from(name){
      if(name!=='topics')throw new Error('Unexpected resource '+name);
      return {
        select(){
          return {
            eq(field,value){
              if(field!=='owner_id')throw new Error('Missing owner filter');
              return {
                order(){
                  return {
                    limit:async()=>({data:works.filter(w=>w.owner_id===value),error:null})
                  };
                }
              };
            }
          };
        },
        update(change){
          return {
            eq(field,topicId){
              if(field!=='id')throw new Error('Missing topic ID constraint');
              return {
                eq(ownerField,ownerId){
                  if(ownerField!=='owner_id')throw new Error('Missing owner update constraint');
                  return {
                    select(){
                      return {
                        single:async()=>{
                          const row=works.find(w=>w.id===topicId&&w.owner_id===ownerId);
                          if(!row)return {data:null,error:new Error('Not owner')};
                          changed+=1;
                          Object.assign(row,change);
                          return {data:{id:row.id,visibility:row.visibility},error:null};
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
  window.SM_SUPABASE={ready:true,client,url:'https://mock.invalid',publishableKey:'public-mock'};
})();
`;

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  await context.route('**/cloud/supabase.js*',async route=>route.fulfill({
    status:200,contentType:'application/javascript',body:fakeSupabase
  }));
  await context.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',async route=>route.fulfill({
    status:200,contentType:'application/javascript',body:'window.supabase={};'
  }));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/my.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.workCard').waitFor({state:'visible',timeout:18000});
  assert.equal(await page.locator('.workCard').count(),1);
  assert.equal(await page.locator('.workTitle').textContent(),'PRESERVE EXISTING OWNER WORK');
  assert.equal(await page.locator('#pageTitle').textContent(),'自分の公開作品');
  assert.equal(await page.locator('#browserNotice').count(),1);
  assert.equal(await page.locator('#googleBtn,#appleBtn,#signOutBtn,#providerHelp,.authHealth,.accountIdentity').count(),0,
    'Legacy OAuth or guest-ID UI is visible');
  assert.doesNotMatch(await page.locator('body').innerText(),/Googleで保護|Appleで保護|ゲストID|Manual Linking/);

  // Must retain RLS-scoped management actions for existing owner sessions.
  const select=page.locator('.visibilitySelect');
  await select.selectOption('unlisted');
  await page.locator('[data-save-visibility]').click();
  await page.waitForFunction(()=>window.__R31_MOCK__?.updates===1);
  assert.equal(await page.locator('.visibilitySelect').inputValue(),'unlisted');
  assert.equal(await page.locator('#myStatus').textContent(),'公開範囲を更新しました。');
  assert.equal((await page.evaluate(()=>window.__R31_MOCK__.works))[0].visibility,'unlisted');

  await page.locator('.globalLocaleBar [data-global-lang="en"]').click();
  await page.waitForFunction(()=>document.querySelector('#pageTitle')?.textContent==='My Published Works',
    {timeout:16000});
  assert.equal(await page.locator('.workCard').count(),1,
    'Language switch hid an existing work');
  assert.equal(await page.locator('#googleBtn,#appleBtn').count(),0);

  const isolated=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  await isolated.addInitScript(()=>{window.__R31_NO_SESSION__=true});
  await isolated.route('**/cloud/supabase.js*',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:fakeSupabase
  }));
  await isolated.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:'window.supabase={};'
  }));
  const noSession=await isolated.newPage();
  await noSession.goto(BASE+'/my.html',{waitUntil:'domcontentloaded',timeout:45000});
  await noSession.waitForFunction(()=>document.querySelector('#worksStatus')?.textContent?.includes('管理情報がありません'),
    null,{timeout:12000});
  assert.equal(await noSession.locator('.workCard').count(),0);
  assert.equal(await noSession.locator('#googleBtn,#appleBtn').count(),0);
  await isolated.close();
  assert.deepEqual(errors,[], 'Unexpected My Works runtime errors');
  console.log('R31 My Works PASS: no account UI, existing owner updates remain, JA/EN and no-session mode');
}finally{
  await browser.close();
}
