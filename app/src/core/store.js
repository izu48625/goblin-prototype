const PROJECT_KEY="statsMakerV2Projects";
const PREF_KEY="statsMakerV2Preferences";

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
    return list;
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
  localStorage.setItem(PROJECT_KEY,JSON.stringify(list));
  return copy;
}

export function deleteProject(id){
  localStorage.setItem(PROJECT_KEY,JSON.stringify(parseProjects({forWrite:true}).filter(p=>p.id!==id)));
}

export function getPreferences(){
  try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch{return {}}
}
export function savePreferences(prefs){
  localStorage.setItem(PREF_KEY,JSON.stringify(prefs||{}));
}
