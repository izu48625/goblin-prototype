const origin='https://statsmaker.app';
const checks=[
 ['/my.html',['id="r90CategoryHelp"','cloud/my.js?v=r90categories1','cloud/my.css?v=r90categories1','noindex']],
 ['/cloud/my.js',['data-save-category','categoriesAllowed.has(next)',".eq('owner_id',state.user.id)",".eq('updated_at',fresh.updated_at)",'duplicatesAmongOwnedWorks()']],
 ['/cloud/my.css',['.r90CategoryControls','.r90CategorySelect','.r90Duplicate']],
 ['/discover.html',['discover.js?v=r89i18n1']],
 ['/work/b879b7c4-7470-416e-89b4-c682a09a49fa',['漫画・アニメ','index,follow']],
 ['/sitemap-works-1.xml',['b879b7c4-7470-416e-89b4-c682a09a49fa']]
];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let attempt=1;attempt<=16;attempt++){
 const failed=[];
 for(const [path,terms] of checks){
  try{
   const r=await fetch(origin+path,{signal:AbortSignal.timeout(14000),headers:{'Cache-Control':'no-cache'}});
   const text=await r.text();
   if(r.status!==200){failed.push(path+' HTTP '+r.status);continue;}
   for(const term of terms)if(!text.includes(term))failed.push(path+' missing '+term);
  }catch(e){failed.push(path+' '+String(e.message||e));}
 }
 console.log('R90 LIVE GET-only attempt',attempt,failed.length?'remaining '+failed.join('; '):'PASS all 6 checks');
 if(!failed.length){console.log('R90 LIVE PASS: owner category editor, duplicate hints, stale guard, privacy and public work remain deployed');process.exit(0)}
 if(attempt!==16)await wait(15000);
}
process.exitCode=1;
