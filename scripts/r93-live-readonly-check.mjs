const base='https://statsmaker.app';
const routes=[
 ['/my.html',['class="r73-light-page"','cloud/my.css?v=r93light1','content="#f6f5f1"','noindex,follow','r91SuggestBtn']],
 ['/cloud/my.css',['html:not([data-sm-theme="dark"])','--bg:#f6f5f1','background:#fff;border-color:#dedbd3']],
 ['/cloud/global-locale.js',['data-global-myworks','statsMaker.uiTheme']],
 ['/discover.html',['Discover']]
];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let attempt=1;attempt<=15;attempt++){
 const errors=[];
 for(const [path,tokens] of routes){
  try{
   const res=await fetch(base+path,{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
   const content=await res.text();
   if(res.status!==200){errors.push(path+' HTTP '+res.status);continue}
   for(const token of tokens)if(!content.includes(token))errors.push(path+' missing '+token);
  }catch(err){errors.push(path+': '+(err?.message||String(err)))}
 }
 console.log('R93 LIVE GET attempt',attempt,errors.length?errors.join('; '):'PASS all four paths');
 if(!errors.length){console.log('R93 LIVE PASS: default light My Works, theme persistence and owner-only features shipped');process.exit(0)}
 if(attempt<15)await wait(12000);
}
process.exitCode=1;
