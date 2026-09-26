const PROJECT_KEY="statsMakerV2Projects";
const PREF_KEY="statsMakerV2Preferences";

function parseProjects(){
  try{
    const raw=localStorage.getItem(PROJECT_KEY);
    const list=raw?JSON.parse(raw):[];
    return Array.isArray(list)?list:[];
  }catch{return []}
}

export function listProjects(){
  return parseProjects().sort((a,b)=>(b.meta?.updatedAt||"").localeCompare(a.meta?.updatedAt||""));
}

export function getProject(id){
  return parseProjects().find(p=>p.id===id)||null;
}

export function saveProject(project){
  const list=parseProjects();
  const idx=list.findIndex(p=>p.id===project.id);
  const copy=structuredClone(project);
  copy.meta.updatedAt=new Date().toISOString();
  if(idx>=0)list[idx]=copy;
  else list.push(copy);
  localStorage.setItem(PROJECT_KEY,JSON.stringify(list));
  return copy;
}

export function deleteProject(id){
  localStorage.setItem(PROJECT_KEY,JSON.stringify(parseProjects().filter(p=>p.id!==id)));
}

export function getPreferences(){
  try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch{return {}}
}
export function savePreferences(prefs){
  localStorage.setItem(PREF_KEY,JSON.stringify(prefs||{}));
}
