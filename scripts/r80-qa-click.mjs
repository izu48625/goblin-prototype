/* R80 QA navigation helper. Legacy end-to-end scenarios continue to test the
   same save/publish/backup/extension operations through their NEW visible
   mobile menus, never by forcing a hidden DOM button to click. */
export async function clickBasic(frame,id){
 const target=frame.locator('#'+id);
 if(await target.isVisible())return target.click();
 if(id==='publishBtn'||id==='newSheetBtn'){
   await frame.locator('#mobileHeaderMoreBtn').click();
   return frame.locator(id==='publishBtn'?'#r80PublishAction':'#r80NewAction').click();
 }
 if(id==='scoreColorToggleBtn'||id==='scoreSettingsBtn'||id==='moreToolsBtn'){
   const menu=frame.locator('#r80OptionsPanel');
   if(!await menu.isVisible())await frame.locator('#r80OptionsBtn').click();
   const button=id==='scoreColorToggleBtn'?'#r80ColorAction':id==='scoreSettingsBtn'?'#r80ScaleAction':'#r80MoreAction';
   return frame.locator(button).click();
 }
 throw new Error('R80 control is not visible and has no user-facing equivalent: '+id);
}
export async function openVisuals(page){
 const original=page.locator('#extLauncher');
 if(await original.isVisible())await original.click();
 else await page.frameLocator('#basicFrame').locator('#r80VisualsBtn').click();
 // The responsive shortcut uses cross-window postMessage, not a synchronous
 // in-document click. Wait for the real popup before testing its operations.
 await page.locator('#extSheet').waitFor({state:'visible',timeout:10000});
}
export async function focusSearch(frame){
 const search=frame.locator('#searchInput');
 if(!await search.isVisible()){
  await frame.locator('#r80OptionsBtn').click();
  await frame.locator('#r81SearchAction').click();
 }
 return search;
}
