import {createProject} from '../app/src/core/project.js';
import {saveProject} from '../app/src/core/store.js';
import {syncSourceProject} from '../app/src/core/source-sync.js';

// An explicit, one-time local snapshot of the participant's OWN ratings.
// Never reads a Community aggregate or another participant's raw ratings.
export function createCommunityVisualProject(type,sheet){
  if(!sheet||!Array.isArray(sheet.rows)||!Array.isArray(sheet.cols))
    throw new Error('Community rating sheet is unavailable.');
  if(!sheet.rows.some(row=>row.scores?.some(Number.isFinite)))
    throw new Error('Enter scores before creating a chart.');
  const project=createProject(type);
  syncSourceProject(project,{},sheet);
  // A graph draft must NEVER later follow the unrelated active Home sheet.
  // The snapshot is copied to the graph project and remains local to this device.
  project.settings.sourceLinked=false;
  project.settings.communitySnapshot=true;
  delete project.settings.sourceSheetId;
  project.meta.subtitle=project.meta.subtitle||'Community / Your rating';
  return project;
}

window.addEventListener('statsmaker:communityVisual',event=>{
  try{
    const {type,sheet,topicId}=event.detail||{};
    const project=createCommunityVisualProject(type,sheet);
    saveProject(project);
    const route=new URL('../app/editor.html',import.meta.url);
    route.searchParams.set('id',project.id);
    route.searchParams.set('from','community');
    if(/^[0-9a-f-]{36}$/i.test(topicId||''))route.searchParams.set('topic',topicId);
    window.location.assign(route.href);
  }catch(error){
    console.error('[Stats Maker] Community visualization failed',error);
    const text=document.documentElement.lang==='en'?'Could not open visual tool: ':'拡張機能を開けませんでした：';
    const msg=document.getElementById('message');
    if(msg){msg.textContent=text+(error?.message||String(error));msg.className='message error';}
  }
});
