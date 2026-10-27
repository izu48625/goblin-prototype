import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const my=await readFile(new URL('../cloud/my.js',import.meta.url),'utf8');
const markup=await readFile(new URL('../my.html',import.meta.url),'utf8');
assert(markup.includes('id="r90CategoryHelp"')&&markup.includes('cloud/my.js?v=r90categories1'));
for(const marker of ['data-save-category','categoriesAllowed.has(next)',".eq('owner_id',state.user.id)",".eq('updated_at',fresh.updated_at)",'duplicatesAmongOwnedWorks()', 'r90CategorySelect']){
 assert(my.includes(marker),'R90 missing safety/UI invariant '+marker);
}
assert(!my.includes('.delete()'),'R90 must not delete user works');
assert(!my.includes("visibility:'unlisted'"),'R90 must not automatically unlist works');

const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const mock=String.raw`
(() => {
const copy=x=>JSON.parse(JSON.stringify(x));
const stamp='2026-10-27T02:00:00.000Z';
const same={version:1,title:'Original author score',rows:[{name:'Player A',scores:[97,85]}],criteria:[{name:'Speed',weight:1},{name:'Accuracy',weight:2}],lineage:{relation:'remix'}};
const works=[
{id:'11111111-1111-4111-8111-111111111111',owner_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'My public A',description:'Own description A',visibility:'public',score_scale:100, snapshot:copy(same),snapshot_updated_at:stamp,updated_at:stamp,published_at:stamp},
{id:'22222222-2222-4222-8222-222222222222',owner_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'My public B identical',description:'Own description B',visibility:'public',score_scale:100, snapshot:copy(same),snapshot_updated_at:stamp,updated_at:stamp,published_at:stamp},
{id:'33333333-3333-4333-8333-333333333333',owner_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'My private C',description:'Do not leak',visibility:'private',score_scale:100, snapshot:{version:1,metadata:{category:'manga_anime'},rows:[{name:'Private Player',scores:[50]}],criteria:[{name:'Power'}]},snapshot_updated_at:stamp,updated_at:stamp,published_at:stamp},
{id:'44444444-4444-4444-8444-444444444444',owner_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',title:'FOREIGN SECRET WORK',visibility:'private',snapshot:{rows:[{name:'Secret'}]},updated_at:stamp}
];
let updates=[];
let nextTick=0;
const active=window.__R90_NO_SESSION__?null:{user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',is_anonymous:true}};
const client={
 auth:{getSession:async()=>({data:{session:active},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 from(table){
  if(table!=='topics')throw Error('Unexpected table');
  const query={filters:[],change:null};
  const rows=()=>works.filter(w=>query.filters.every(([k,v])=>w[k]===v));
  const api={
   select(){return api},
   eq(k,v){query.filters.push([k,v]);return api},
   order(){return api},
   limit:async()=>({data:rows().map(copy),error:null}),
   single:async()=>({data:copy(rows()[0])||null,error:rows()[0]?null:Error('not found')}),
   maybeSingle:async()=>{
    if(!query.change)return {data:copy(rows()[0])||null,error:null};
    if(!query.filters.some(([k])=>k==='owner_id')||!query.filters.some(([k])=>k==='updated_at'))throw Error('Missing owner or concurrency guard');
    const target=rows()[0]; if(!target)return {data:null,error:null};
    updates.push({id:target.id,patch:copy(query.change),guards:copy(query.filters)});
    Object.assign(target,copy(query.change));
    target.updated_at='2026-10-27T02:00:'+(++nextTick).toString().padStart(2,'0')+'.000Z';
    return {data:copy(target),error:null};
   },
   update(change){query.change=copy(change);return api}
  };
  return api;
 }
};
window.__R90_MOCK__={
 get updates(){return copy(updates)},
 get works(){return copy(works)},
 externalEdit(id){const target=works.find(w=>w.id===id);target.updated_at='2026-10-27T03:00:00.000Z';target.description='Edited elsewhere'},
};
window.SM_SUPABASE={ready:true,client,url:'https://fake.invalid',publishableKey:'mock'};
})();
`;
const specs=[['chromium',chromium,320],['webkit',webkit,390],['chromium',chromium,1180]];
for(const [name,engine,width] of specs){
 const browser=await engine.launch({headless:true});
 try{
 const ctx=await browser.newContext({viewport:{width,height:840},locale:'ja-JP',isMobile:width<500,hasTouch:width<500});
 await ctx.route('**/cloud/supabase.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:mock}));
 await ctx.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={};'}));
 await ctx.route('https://*.supabase.co/**',route=>route.abort());
 const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'/my.html',{waitUntil:'domcontentloaded'});
 await page.locator('.workCard').first().waitFor({state:'visible',timeout:15000});
 assert.equal(await page.locator('.workCard').count(),3);
 assert.equal(await page.locator('.r90Duplicate').count(),2);
 assert(!(await page.locator('body').innerText()).includes('FOREIGN SECRET WORK'));
 assert.equal(await page.locator('[data-category-for="'+A+'"]').inputValue(),'');
 const oldSnapshot=await page.evaluate(()=>window.__R90_MOCK__.works.find(w=>w.id==='11111111-1111-4111-8111-111111111111').snapshot);
 await page.locator('[data-category-for="'+A+'"]').selectOption('sports');
 await page.locator('[data-save-category="'+A+'"]').click();
 await page.waitForFunction(()=>window.__R90_MOCK__?.updates?.length===1);
 assert((await page.locator('#myStatus').textContent()).includes('カテゴリを更新しました'));
 const after=await page.evaluate(()=>window.__R90_MOCK__.works);
 const patch=await page.evaluate(()=>window.__R90_MOCK__.updates[0]);
 assert.equal(after[0].snapshot.metadata.category,'sports');
 assert.deepEqual(after[0].snapshot.rows,oldSnapshot.rows);
 assert.deepEqual(after[0].snapshot.criteria,oldSnapshot.criteria);
 assert.deepEqual(after[0].snapshot.lineage,oldSnapshot.lineage);
 assert.equal(after[0].visibility,'public');
 assert.equal(after[0].title,'My public A');
 assert.equal(after[1].snapshot.metadata,undefined);
 assert.equal(patch.id,A);
 assert.deepEqual(Object.keys(patch.patch).sort(),['snapshot','snapshot_updated_at']);
 assert.equal(await page.locator('.r90Duplicate').count(),0,'Distinct category metadata changes exact snapshot equality');
 assert.equal(await page.locator('[data-category-for="'+C+'"]').inputValue(),'manga_anime');
 await page.evaluate(id=>window.__R90_MOCK__.externalEdit(id),B);
 await page.locator('[data-category-for="'+B+'"]').selectOption('sports');
 await page.locator('[data-save-category="'+B+'"]').click();
 await page.waitForFunction(()=>document.querySelector('#myStatus')?.textContent?.includes('他の端末で作品が更新'));
 assert.equal((await page.evaluate(()=>window.__R90_MOCK__.updates)).length,1,'Stale change must not overwrite');
 await page.locator('.globalLocaleBar [data-global-lang="en"]').click();
 await page.waitForFunction(()=>document.querySelector('#r90CategoryHelp')?.textContent?.includes('Only the owner'));
 assert.equal(await page.locator('[data-save-category="'+A+'"]').textContent(),'Save category');
 if(width<500){
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert(overflow<=3,name+' '+width+' horizontal overflow '+overflow);
 }
 assert.deepEqual(errors.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[]);
 console.log('R90 PASS',name,width,'owner-category-save, duplicate hint, stale guard, JA/EN and privacy');
 await ctx.close();
 }finally{await browser.close()}
}
