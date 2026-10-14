import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../cloud/discover.js',import.meta.url),'utf8');
assert(!source.includes('.limit(60)'));
assert(!source.includes('.limit(500)'));
assert(source.includes('state.visible+=12'));
assert(source.includes("state.visible=12"));
const start=source.indexOf('  const PAGE_SIZE=200;');
const end=source.indexOf('  async function participantCounts(',start);
assert(start>=0&&end>start);
const code=source.slice(start,end);
for(const size of [0,11,12,13,60,61,120,1000,1001]){
  const all=Array.from({length:size},(_,i)=>({
    id:String(i).padStart(6,'0'),visibility:'public',
    published_at:'2026-10-14',snapshot:{}
  }));
  const calls=[];
  const sb={
    from(table){
      assert.equal(table,'topics');
      const q={
        select(fields){assert(fields.includes('visibility'));return q},
        eq(k,v){assert.equal(k,'visibility');assert.equal(v,'public');return q},
        order(){return q},
        async range(a,b){
          calls.push([a,b]);
          return {data:all.slice(a,b+1),error:null};
        }
      };
      return q;
    }
  };
  const ctx=vm.createContext({sb,Set});
  const result=await vm.runInContext('(async()=>{'+code+'return await allPublicTopics()})()',ctx);
  assert.equal(result.length,size,'Incorrect work count '+size);
  assert.equal(new Set(result.map(x=>x.id)).size,size);
  assert(calls.every(([a,b])=>b-a===199));
  assert.equal(calls.length,Math.floor(size/200)+1);
}
const old='new Date(b.published_at||b.snapshot_updated_at||0)-new Date(a.published_at||a.snapshot_updated_at||0)||String(a.id).localeCompare(String(b.id))';
assert(source.includes(old),'Stable tie-break missing');
for(const marker of ["state.sort==='popular'","state.sort==='community'","state.sort==='remix'","normalize('NFKC')","relation||''","topic?.visibility!=='public'"]){
  assert(source.includes(marker),'Missing invariant '+marker);
}
console.log('R39 Discover fixtures: 0/11/12/13/60/61/120/1000/1001 passed');
