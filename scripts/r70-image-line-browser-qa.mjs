import assert from "node:assert/strict";
import {chromium} from "playwright";

const base=process.env.BASE_URL||"http://127.0.0.1:4173";
const picture="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/W3sAAAAASUVORK5CYII=";
const sheet={
  id:"r70-qa",title:"R70 series review",desc:"",
  cols:["Overall"],rows:[
    {name:"First",note:"",scores:[8],image:picture},
    {name:"Second",note:"",scores:[3],image:picture},
    {name:"Third",note:"",scores:[9],image:picture}
  ],
  weights:[1],scale:10,rankMetric:"avg",compare:[],
  sortKey:null,sortDesc:true,weighted:false,viewMode:"sheet",
  fitMode:"auto",fitZoom:1,updatedAt:Date.now()
};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:"ja-JP"});
  await context.addInitScript(source=>{
    if(!localStorage.getItem("r70:initialized")){
      localStorage.setItem("statsMakerV014Library",
        JSON.stringify({activeId:source.id,sheets:[source]}));
      localStorage.setItem("r70:initialized","1");
    }
  },sheet);
  const page=await context.newPage();
  const runtimeErrors=[];
  page.on("pageerror",error=>runtimeErrors.push(error.message));
  await page.goto(base+"/index.html?extensions=1",{waitUntil:"domcontentloaded",timeout:30000});
  const cards=page.locator("#extGroups .extCard");
  await cards.last().waitFor({state:"visible",timeout:30000});
  assert.equal(await cards.count(),11,"Image Line must be the eleventh extension");
  const imageCard=cards.filter({hasText:"Image Line"});
  assert.equal(await imageCard.count(),1);
  await imageCard.click();
  await page.waitForURL(/\/app\/editor\.html/,{timeout:30000});
  await page.locator("#previewRoot canvas.image-line-visual").waitFor({timeout:30000});
  const state=await page.evaluate(()=>{
    const all=JSON.parse(localStorage.getItem("statsMakerV2Projects")||"[]");
    const p=all[all.length-1];
    const canvas=document.querySelector("#previewRoot canvas.image-line-visual");
    return {
      type:p?.type,title:p?.meta?.title,sourceId:p?.settings?.sourceSheetId,
      names:p?.data?.items?.map(x=>x.name),scores:p?.data?.items?.map(x=>x.value),
      size:[canvas.width,canvas.height],
      rendered:canvas?.toDataURL("image/png").length||0
    };
  });
  assert.equal(state.type,"image-line");
  assert.equal(state.sourceId,sheet.id);
  assert.deepEqual(state.names,["First","Second","Third"]);
  assert.deepEqual(state.scores,[8,3,9]);
  assert.deepEqual(state.size,[1600,900]);
  assert(state.rendered>2000,"Canvas preview must render image content");
  // Editor should allow a photo override without altering the original Home sheet.
  const photo=page.locator("#panelContent .image-line-image-manager .image-dropzone").first();
  await photo.waitFor({state:"visible",timeout:30000});
  const fileChooser=page.waitForEvent("filechooser");
  await photo.click();
  const chooser=await fileChooser;
  await chooser.setFiles({
    name:"photo.png",mimeType:"image/png",
    buffer:Buffer.from(picture.split(",")[1],"base64")
  });
  await page.waitForFunction(()=>{
    const p=JSON.parse(localStorage.getItem("statsMakerV2Projects")||"[]").at(-1);
    return p?.data?.items?.[0]?.imageRef?.startsWith("img_");
  },null,{timeout:30000});
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#previewRoot canvas.image-line-visual").waitFor({timeout:30000});
  const exported=await page.evaluate(async()=>{
    const {renderNativeProject}=await import("/app/src/core/export.js");
    const p=JSON.parse(localStorage.getItem("statsMakerV2Projects")||"[]").at(-1);
    const canvas=await renderNativeProject(p);
    return {png:canvas.toDataURL("image/png").length,ref:p.data.items[0].imageRef,
      origin:JSON.parse(localStorage.getItem("statsMakerV014Library")).sheets[0].rows[0].name};
  });
  assert(exported.png>2000 && exported.ref.startsWith("img_"));
  assert.equal(exported.origin,"First");
  assert.deepEqual(runtimeErrors,[]);
  console.log("R70 browser QA passed: launcher, source order, canvas, photo upload, reload and PNG");
}finally{await browser.close()}
