import {saveImageFile,getImageUrl,deleteImage} from "../core/images.js";

function imageFileFromClipboardEvent(event){
  const items=[...(event.clipboardData?.items||[])];
  for(const item of items){
    if(item.kind==="file" && item.type.startsWith("image/")){
      return item.getAsFile();
    }
  }
  return null;
}

function chooseFile(){
  return new Promise(resolve=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept="image/*";
    input.onchange=()=>resolve(input.files?.[0]||null);
    input.click();
  });
}

export function createImageManager({
  imageRef=null,
  shape="circle",
  label="Image",
  onChange,
  onShapeChange,
  allowShape=true
}){
  const box=document.createElement("div");
  box.className="image-manager";
  box.tabIndex=0;

  box.innerHTML=`
    <div class="image-manager-head">
      <span class="image-manager-label"></span>
      <button type="button" class="btn compact image-remove">Remove</button>
    </div>

    <div class="image-dropzone">
      <div class="image-preview ${shape}">
        <span class="image-placeholder">＋</span>
        <img alt="">
      </div>
      <div class="image-drop-copy">
        <b>Upload image</b>
        <small>Tap / Drop / Paste</small>
      </div>
    </div>

    <div class="image-manager-actions">
      <button type="button" class="btn image-upload">Upload</button>
      <button type="button" class="btn image-paste">Paste</button>
    </div>

    <div class="image-shape-row ${allowShape?"":"hidden"}">
      <button type="button" data-shape="circle">Circle</button>
      <button type="button" data-shape="square">Square</button>
      <button type="button" data-shape="rounded">Rounded</button>
      <button type="button" data-shape="original">Original</button>
    </div>

    <div class="image-manager-status"></div>
  `;

  box.querySelector(".image-manager-label").textContent=label;

  const drop=box.querySelector(".image-dropzone");
  const preview=box.querySelector(".image-preview");
  const img=box.querySelector("img");
  const placeholder=box.querySelector(".image-placeholder");
  const removeBtn=box.querySelector(".image-remove");
  const status=box.querySelector(".image-manager-status");

  function setStatus(text,type=""){
    status.textContent=text||"";
    status.className=`image-manager-status ${type}`;
  }

  function updateShape(next){
    preview.className=`image-preview ${next}`;
    box.querySelectorAll("[data-shape]").forEach(b=>{
      b.classList.toggle("active",b.dataset.shape===next);
    });
  }

  updateShape(shape);

  async function hydrate(){
    if(!imageRef){
      img.removeAttribute("src");
      img.classList.add("hidden");
      placeholder.classList.remove("hidden");
      removeBtn.disabled=true;
      return;
    }
    try{
      const url=await getImageUrl(imageRef);
      if(url){
        img.src=url;
        img.classList.remove("hidden");
        placeholder.classList.add("hidden");
        removeBtn.disabled=false;
      }else{
        img.classList.add("hidden");
        placeholder.classList.remove("hidden");
        removeBtn.disabled=true;
      }
    }catch(e){
      console.error(e);
      setStatus("Image load failed","error");
    }
  }

  async function acceptFile(file){
    if(!file)return;
    try{
      setStatus("Optimizing...");
      const saved=await saveImageFile(file,{maxDimension:1200,quality:.86});
      const old=imageRef;
      imageRef=saved.id;

      if(old && old!==imageRef){
        deleteImage(old).catch(console.warn);
      }

      await hydrate();
      setStatus(`${saved.width}×${saved.height} saved`,"ok");
      onChange?.(imageRef,saved);
    }catch(e){
      console.error(e);
      setStatus(e?.message||"Image failed","error");
    }
  }

  drop.addEventListener("click",async()=>acceptFile(await chooseFile()));
  box.querySelector(".image-upload").addEventListener("click",async()=>acceptFile(await chooseFile()));

  box.querySelector(".image-paste").addEventListener("click",async()=>{
    try{
      if(!navigator.clipboard?.read){
        setStatus("Use Ctrl/Cmd+V or long press paste","warn");
        box.focus();
        return;
      }
      const items=await navigator.clipboard.read();
      for(const item of items){
        const imageType=item.types.find(t=>t.startsWith("image/"));
        if(imageType){
          const blob=await item.getType(imageType);
          const file=new File([blob],"clipboard-image",{type:imageType});
          await acceptFile(file);
          return;
        }
      }
      setStatus("No image in clipboard","warn");
    }catch(e){
      setStatus("Use Ctrl/Cmd+V or long press paste","warn");
      box.focus();
    }
  });

  box.addEventListener("paste",async e=>{
    const file=imageFileFromClipboardEvent(e);
    if(file){
      e.preventDefault();
      await acceptFile(file);
    }
  });

  ["dragenter","dragover"].forEach(type=>{
    drop.addEventListener(type,e=>{
      e.preventDefault();
      drop.classList.add("dragging");
    });
  });
  ["dragleave","drop"].forEach(type=>{
    drop.addEventListener(type,e=>{
      e.preventDefault();
      drop.classList.remove("dragging");
    });
  });
  drop.addEventListener("drop",async e=>{
    const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith("image/"));
    await acceptFile(file);
  });

  removeBtn.addEventListener("click",async()=>{
    const old=imageRef;
    imageRef=null;
    await hydrate();
    setStatus("");
    onChange?.(null,null);
    if(old)deleteImage(old).catch(console.warn);
  });

  box.querySelectorAll("[data-shape]").forEach(b=>{
    b.addEventListener("click",()=>{
      shape=b.dataset.shape;
      updateShape(shape);
      onShapeChange?.(shape);
    });
  });

  hydrate();
  return box;
}
