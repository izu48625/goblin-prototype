
(function(){
"use strict";

function showFatal(error){
  console.error(error);
  const root=document.body;
  const message=String(error?.stack||error?.message||error||"Unknown editor error");
  root.innerHTML=`
    <div style="min-height:100vh;background:#07101f;color:#eef4ff;padding:28px;font:14px/1.6 system-ui;box-sizing:border-box">
      <a href="../index.html?extensions=1" style="display:inline-block;margin-bottom:18px;color:#9bb8ff;text-decoration:none">← 拡張機能へ戻る</a>
      <h2 style="margin:0 0 10px">Editor Error</h2>
      <p style="color:#a7b7cc">真っ黒な画面にはせず、読み込みエラーをここに表示します。</p>
      <pre style="white-space:pre-wrap;background:#101d30;border:1px solid #2d4665;border-radius:10px;padding:14px;color:#ffb7b7">${message.replace(/[&<>]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[s]))}</pre>
    </div>`;
}

window.addEventListener("error",event=>{
  if(event.error)showFatal(event.error);
});
window.addEventListener("unhandledrejection",event=>showFatal(event.reason));

try{
  if(!window.StatsMakerRequire)throw new Error("Stats Maker runtime failed to load");
  window.StatsMakerRequire("editor/editor.js");
}catch(error){
  showFatal(error);
}
})();
