(function(){
"use strict";

function addHiddenExportModalIfMissing(){
  if(document.getElementById("exportPreviewModal"))return;

  const modal=document.createElement("div");
  modal.id="exportPreviewModal";
  modal.className="export-preview-modal hidden";
  modal.setAttribute("role","dialog");
  modal.setAttribute("aria-modal","true");
  modal.innerHTML=`
    <div class="export-preview-card">
      <div class="export-preview-head">
        <div>
          <b id="exportPreviewTitle">PNGプレビュー</b>
          <span>画像が完成しました</span>
        </div>
        <button id="exportPreviewClose" type="button" aria-label="Close">×</button>
      </div>
      <div class="export-preview-image-wrap">
        <img id="exportPreviewImage" alt="Export preview">
      </div>
      <p class="export-preview-help">
        「共有 / 保存」を押して、共有シートから画像またはファイルとして保存できます。
      </p>
      <div class="export-preview-actions">
        <button id="exportPreviewShare" class="btn primary" type="button">共有 / 保存</button>
        <button id="exportPreviewDismiss" class="btn ghost" type="button">閉じる</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function ensureElement(id, tag="div", parent=document.body){
  let el=document.getElementById(id);
  if(el)return el;
  el=document.createElement(tag);
  el.id=id;
  el.className="hidden";
  parent.appendChild(el);
  return el;
}

function ensureCompatibilityDom(){
  addHiddenExportModalIfMissing();

  // Extra defensive compatibility for older editor shells.
  ensureElement("mobileSaveState");
  ensureElement("mobilePanelTitle");
  ensureElement("mobilePanelContent");
}

function showFatal(error){
  console.error(error);
  const message=String(error?.stack||error?.message||error||"Unknown editor error");
  document.body.innerHTML=`
    <div style="min-height:100vh;background:#07101f;color:#eef4ff;padding:28px;font:14px/1.6 system-ui;box-sizing:border-box">
      <a href="../index.html?extensions=1&v=r13" style="display:inline-block;margin-bottom:18px;color:#9bb8ff;text-decoration:none">← 拡張機能へ戻る</a>
      <h2 style="margin:0 0 10px">Editor Error</h2>
      <p style="color:#a7b7cc">読み込みエラーを表示しています。Build: R13</p>
      <pre style="white-space:pre-wrap;background:#101d30;border:1px solid #2d4665;border-radius:10px;padding:14px;color:#ffb7b7">${message.replace(/[&<>]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[s]))}</pre>
    </div>`;
}

window.addEventListener("error",event=>{
  if(event.error)showFatal(event.error);
});
window.addEventListener("unhandledrejection",event=>showFatal(event.reason));

try{
  ensureCompatibilityDom();
  if(!window.StatsMakerRequire)throw new Error("Stats Maker runtime failed to load");
  window.StatsMakerRequire("editor/editor.js");
}catch(error){
  showFatal(error);
}
})();