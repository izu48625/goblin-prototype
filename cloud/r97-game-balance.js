/* R97: genuinely original interactive game-balancing worksheet.
   Same authored sample in JA/EN; no Supabase, ads, trackers, storage, or external data. */
(() => {
 'use strict';
 const root=document.querySelector('#r97Lab');
 if(!root)return;
 const en=document.documentElement.lang==='en';
 const items=[
  {name:en?'Wind Dagger':'疾風の短剣',scores:[52,98,25,70]},
  {name:en?'Iron Shield':'鋼の盾',scores:[35,38,98,92]},
  {name:en?'Azure Spear':'蒼の槍',scores:[84,68,66,67]},
  {name:en?'Moon Bow':'月影の弓',scores:[72,83,30,58]},
  {name:en?'Stone Hammer':'岩砕きの槌',scores:[97,24,78,42]}
 ];
 const numbers=[...root.querySelectorAll('[data-weight]')];
 const output=root.querySelector('[data-r97-result]');
 const summary=root.querySelector('[data-r97-summary]');
 const formula=root.querySelector('[data-r97-formula]');
 const make=(tag,className,txt)=>{const node=document.createElement(tag);if(className)node.className=className;if(txt!==undefined)node.textContent=txt;return node};
 function compute(){
  const weights=numbers.map(x=>Number(x.value));
  numbers.forEach((n,i)=>root.querySelector('[data-weight-output="'+i+'"]').textContent=String(weights[i]));
  const denom=weights.reduce((a,b)=>a+b,0);
  output.replaceChildren();
  if(!denom){
   summary.textContent=en?'All weights are zero. Increase at least one weight to compare.':'すべての重みが0です。1項目以上の重みを増やしてください。';
   formula.textContent='';
   return;
  }
  const ranked=items.map(x=>({...x,weighted:x.scores.reduce((total,n,i)=>total+n*weights[i],0)/denom}))
    .sort((a,b)=>b.weighted-a.weighted||a.name.localeCompare(b.name));
  const leader=ranked[0];
  const ties=ranked.filter(x=>Math.abs(x.weighted-leader.weighted)<1e-9);
  summary.textContent=(en?'Current leader: ':'現在の1位：')+ties.map(x=>x.name).join(en?', ':'・')+
   ' ('+leader.weighted.toFixed(2)+(en?'/100 points':'点 / 100点')+')';
  formula.textContent=en?'Calculation: sum of (each score × its weight) ÷ sum of weights. Ties are not forced into different ranks.'
    :'計算式：各項目の「点数×重み」の合計 ÷ 重みの合計。同点は無理に順位を分けません。';
  ranked.forEach((x,i)=>{
   const tr=make('tr');
   const rank=make('th',null,String(1+ranked.filter(y=>y.weighted>x.weighted+1e-9).length));
   rank.scope='row';
   const name=make('td',null,x.name);
   const avg=make('td','r97Score',x.weighted.toFixed(2));
   const barCell=make('td');const bar=make('div','r97Bar');
   bar.setAttribute('role','img');
   bar.setAttribute('aria-label',(en?'Weighted score ':'加重得点 ')+x.weighted.toFixed(2)+(en?' out of 100':' / 100点'));
   const fill=make('span');fill.style.width=Math.max(0,Math.min(100,x.weighted))+'%';bar.append(fill);barCell.append(bar);
   tr.append(rank,name,avg,barCell);output.append(tr);
  });
 }
 numbers.forEach(x=>x.addEventListener('input',compute));
 root.querySelector('[data-r97-reset]').addEventListener('click',()=>{
  numbers.forEach(x=>x.value='1');compute();
 });
 root.querySelectorAll('[data-r97-scenario]').forEach(button=>button.addEventListener('click',()=>{
  const presets={speed:[1,3,0,1],defense:[1,0,3,1],power:[4,1,0,0]};
  const values=presets[button.dataset.r97Scenario];
  if(!values)return;
  numbers.forEach((x,i)=>x.value=String(values[i]));compute();
 }));
 compute();
})();