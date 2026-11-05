const PROJECT_KEY="statsMakerV2Projects";
const PREF_KEY="statsMakerV2Preferences";

const IMAGE_BANK_FIELD="__statsMakerSharedImages";
const IMAGE_REF_PREFIX="__statsMakerImage:";
const isEmbeddedImage=value=>typeof value==="string"&&value.length>256&&/^data:image\//i.test(value);

// Charts may reuse the exact same uploaded image dozens of times.
// Keep one copy in this same self-contained project library, never a pointer
// to the mutable Home sheet or to external storage that can disappear.
function visitImages(node,visit){
  if(!node||typeof node!=="object")return;
  if(Array.isArray(node)){
    node.forEach(child=>visitImages(child,visit));
    return;
  }
  Object.keys(node).forEach(key=>{
    if(key===IMAGE_BANK_FIELD)return;
    const child=node[key];
    if((key==="image"||key==="imageData")&&typeof child==="string")
      node[key]=visit(child);
    else if(child&&typeof child==="object")visitImages(child,visit);
  });
}
function expandSharedImages(list){
  const bank=list[0]?.[IMAGE_BANK_FIELD];
  if(bank!==undefined && (!bank||typeof bank!=="object"||Array.isArray(bank)))
    throw new Error("Invalid shared image bank");
  list.forEach((project,index)=>{
    if(index>0&&Object.hasOwn(project,IMAGE_BANK_FIELD))
      throw new Error("Unexpected shared image bank");
    visitImages(project,value=>{
      if(!value.startsWith(IMAGE_REF_PREFIX))return value;
      const key=value.slice(IMAGE_REF_PREFIX.length);
      const image=Object.hasOwn(bank||{},key)?bank[key]:null;
      if(!isEmbeddedImage(image))throw new Error("Missing shared chart image");
      return image;
    });
  });
  if(list.length)delete list[0][IMAGE_BANK_FIELD];
  return list;
}
function persistProjects(list){
  const output=structuredClone(list);
  const counts=new Map();
  output.forEach(project=>visitImages(project,value=>{
    if(isEmbeddedImage(value))counts.set(value,(counts.get(value)||0)+1);
    return value;
  }));
  const refs=new Map(),bank={};
  output.forEach(project=>visitImages(project,value=>{
    if((counts.get(value)||0)<2)return value;
    let key=refs.get(value);
    if(!key){
      key="i"+(refs.size+1);
      refs.set(value,key);
      bank[key]=value;
    }
    return IMAGE_REF_PREFIX+key;
  }));
  if(refs.size && output.length)output[0][IMAGE_BANK_FIELD]=bank;
  // A single atomic key replacement preserves prior bytes on quota failure.
  localStorage.setItem(PROJECT_KEY,JSON.stringify(output));
}


// Malformed persistent storage is NOT an empty project library.
// Reads retain their previous fallback for compatibility; writes fail closed
// so the next autosave/import/delete cannot erase recoverable raw bytes.
function parseProjects({forWrite=false}={}){
  try{
    const raw=localStorage.getItem(PROJECT_KEY);
    if(raw===null)return [];
    const list=JSON.parse(raw);
    if(!Array.isArray(list)||list.some(p=>
      !p||typeof p!=="object"||Array.isArray(p)||
      typeof p.id!=="string"||!p.id.trim()||
      !p.meta||typeof p.meta!=="object"||Array.isArray(p.meta)
    )||new Set(list.map(p=>p.id)).size!==list.length){
      throw new Error("Invalid saved project list");
    }
    return expandSharedImages(list);
  }catch(error){
    if(forWrite){
      throw new Error("Existing chart storage could not be read. Save blocked to protect previous work.",{cause:error});
    }
    return [];
  }
}

export function listProjects(){
  return parseProjects().sort((a,b)=>(b.meta?.updatedAt||"").localeCompare(a.meta?.updatedAt||""));
}

export function getProject(id){
  return parseProjects().find(p=>p.id===id)||null;
}

export function saveProject(project){
  const list=parseProjects({forWrite:true});
  const idx=list.findIndex(p=>p.id===project.id);
  const copy=structuredClone(project);
  copy.meta.updatedAt=new Date().toISOString();
  if(idx>=0)list[idx]=copy;
  else list.push(copy);
  persistProjects(list);
  return copy;
}

export function deleteProject(id){
  persistProjects(parseProjects({forWrite:true}).filter(p=>p.id!==id));
}

export function getPreferences(){
  try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch{return {}}
}
export function savePreferences(prefs){
  localStorage.setItem(PREF_KEY,JSON.stringify(prefs||{}));
}
