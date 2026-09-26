const DB_NAME="statsMakerV2Assets";
const DB_VERSION=1;
const STORE="images";

let dbPromise=null;
const objectUrlCache=new Map();

function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE,{keyPath:"id"});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

function uid(){
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
}

function fileToBitmap(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror=()=>{
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src=url;
  });
}

function canvasToBlob(canvas,type="image/jpeg",quality=.86){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(blob)resolve(blob);
      else reject(new Error("Image compression failed"));
    },type,quality);
  });
}

export async function optimizeImageFile(file,{
  maxDimension=1200,
  quality=.86
}={}){
  if(!file || !file.type?.startsWith("image/")){
    throw new Error("Please choose an image file.");
  }

  const img=await fileToBitmap(file);
  const originalWidth=img.naturalWidth||img.width;
  const originalHeight=img.naturalHeight||img.height;
  const scale=Math.min(1,maxDimension/Math.max(originalWidth,originalHeight));
  const width=Math.max(1,Math.round(originalWidth*scale));
  const height=Math.max(1,Math.round(originalHeight*scale));

  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(img,0,0,width,height);

  const preserveAlpha=file.type==="image/png" || file.type==="image/webp";
  let blob;
  if(preserveAlpha){
    blob=await canvasToBlob(canvas,"image/webp",quality);
  }else{
    blob=await canvasToBlob(canvas,"image/jpeg",quality);
  }

  return {
    blob,
    width,
    height,
    originalWidth,
    originalHeight,
    sourceName:file.name||"pasted-image",
    mime:blob.type
  };
}

export async function saveImageFile(file,options={}){
  const optimized=await optimizeImageFile(file,options);
  const id=uid();
  const record={
    id,
    blob:optimized.blob,
    width:optimized.width,
    height:optimized.height,
    originalWidth:optimized.originalWidth,
    originalHeight:optimized.originalHeight,
    sourceName:optimized.sourceName,
    mime:optimized.mime,
    createdAt:new Date().toISOString()
  };

  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error("Image save failed"));
    tx.onabort=()=>reject(tx.error||new Error("Image save aborted"));
  });

  return {
    id,
    width:record.width,
    height:record.height,
    sourceName:record.sourceName,
    mime:record.mime
  };
}

export async function getImageRecord(id){
  if(!id)return null;
  const db=await openDB();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error||new Error("Image load failed"));
  });
}

export async function getImageUrl(id){
  if(!id)return null;
  if(objectUrlCache.has(id))return objectUrlCache.get(id);

  const record=await getImageRecord(id);
  if(!record?.blob)return null;

  const url=URL.createObjectURL(record.blob);
  objectUrlCache.set(id,url);
  return url;
}

export async function deleteImage(id){
  if(!id)return;
  const cached=objectUrlCache.get(id);
  if(cached){
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(id);
  }

  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error("Image delete failed"));
  });
}

export async function cloneImage(id){
  if(!id)return null;
  const record=await getImageRecord(id);
  if(!record?.blob)return null;

  const newId=uid();
  const copy={...record,id:newId,createdAt:new Date().toISOString()};
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(copy);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error("Image clone failed"));
  });
  return newId;
}

export function revokeObjectUrls(){
  for(const url of objectUrlCache.values())URL.revokeObjectURL(url);
  objectUrlCache.clear();
}
