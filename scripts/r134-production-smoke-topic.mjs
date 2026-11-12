// R134: Select a *currently* public, author-enabled work for read-only
// production smoke checks. Never depend on stale static example UUIDs.
// Data API reads use the same public publishable key shipped by the Worker.
import {readFile} from 'node:fs/promises';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function chooseCurrentPublicSmokeTopic(rows,preferredId=''){
  if(!Array.isArray(rows))throw new Error('Public work query returned invalid data');
  const allowed=rows.filter(row=>row?.visibility==='public'&&
    row?.show_community===true&&row?.allow_ratings===true&&UUID.test(String(row.id||'')));
  if(!allowed.length)throw new Error('No current Public work allows Community: cannot run smoke safely');
  const preferred=allowed.find(row=>row.id===preferredId);
  return (preferred||allowed[0]).id;
}

export async function resolveCurrentPublicSmokeTopic(preferredId='',fetchFn=fetch){
  const src=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
  const origin=src.match(/const SUPABASE_URL='(https:\/\/[^']+)'/)?.[1];
  const key=src.match(/const SUPABASE_KEY='(sb_publishable_[^']+)'/)?.[1];
  if(!origin||!key)throw new Error('The production publishable API config could not be read');
  const query=new URLSearchParams({
    select:'id,visibility,show_community,allow_ratings',
    visibility:'eq.public',
    order:'published_at.desc',
    limit:'50'
  });
  const res=await fetchFn(origin+'/rest/v1/topics?'+query,{
    method:'GET',headers:{apikey:key,Accept:'application/json'},
    cache:'no-store',signal:AbortSignal.timeout(16000)
  });
  if(!res.ok)throw new Error('Anonymous Public candidate discovery failed HTTP '+res.status);
  const data=await res.json();
  const id=chooseCurrentPublicSmokeTopic(data,preferredId);
  console.log('R134 current Public smoke topic verified; candidates:',data.length,
    'preferred used:',id===preferredId);
  return id;
}
