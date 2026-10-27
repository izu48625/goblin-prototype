const root='https://statsmaker.app';
const specs=[
 ['/my.html',['id="r91SuggestBtn"','id="r91BatchSaveBtn"','cloud/my.js?v=r91review1','cloud/my.css?v=r91review1','noindex']],
 ['/cloud/my.js',['function suggestedCategory(topic)','function scoringFingerprint(topic)','window.confirm(c().batchConfirm(proposals.length))','deferRender:true',".eq('owner_id',state.user.id)",".eq('updated_at',fresh.updated_at)"]],
 ['/cloud/my.css',['.r91ReviewTools','.r91ReviewMessage']],
 ['/discover.html',['Public作品のみ掲載']],
 ['/work/b879b7c4-7470-416e-89b4-c682a09a49fa',['index,follow','戦闘力']],
 ['/sitemap-works-1.xml',['b879b7c4-7470-416e-89b4-c682a09a49fa']]
];
const snooze=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=1;i<=16;i++){
 const problems=[];
 for(const [path,tokens] of specs){
  try{
   const response=await fetch(root+path,{signal:AbortSignal.timeout(14000),headers:{'Cache-Control':'no-cache'}});
   const body=await response.text();
   if(response.status!==200){problems.push(path+' HTTP '+response.status);continue;}
   for(const token of tokens)if(!body.includes(token))problems.push(path+' missing '+token);
  }catch(e){problems.push(path+' '+(e.message||String(e)))}
 }
 console.log('R91 live GET-only check attempt',i,problems.length?problems.join('; '):'PASS: all six paths');
 if(!problems.length){console.log('R91 LIVE PASS: staged owner edits, confirm, duplicate score hints and published works');process.exit(0)}
 if(i<16)await snooze(15000);
}
process.exitCode=1;
