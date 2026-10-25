// R83: isolated scoring explainer. No storage, tracking, network, or app writes.
export const SAMPLE_SCORES = Object.freeze([[9,5,8],[7,8,7],[6,9,6]]);
export function weightedAverage(scores, weights) {
  if (!Array.isArray(scores) || !Array.isArray(weights) || scores.length !== weights.length || !scores.length) throw new TypeError('Invalid rating vector');
  let total = 0, weightSum = 0;
  for(let i=0;i<scores.length;i++){
    const score=Number(scores[i]), weight=Number(weights[i]);
    if(!Number.isFinite(score) || score<0 || score>10 || !Number.isInteger(weight) || weight<1 || weight>5) throw new RangeError('Invalid score/weight');
    total+=score*weight; weightSum+=weight;
  }
  return total/weightSum;
}
export function rankSample(weights) {
  const results=SAMPLE_SCORES.map((scores,i)=>({index:i,score:weightedAverage(scores,weights)}));
  results.sort((a,b)=>b.score-a.score||a.index-b.index);
  return results.map((item,i)=>({...item,rank:i&&Math.abs(item.score-results[i-1].score)<1e-9?0:i+1}))
    .map((item,i,arr)=>item.rank===0?{...item,rank:arr.slice(0,i).reverse().find(a=>a.rank>0).rank}:item);
}
export function bindScoringGuide(root=document) {
  const block=root.getElementById('scoringPlayground');
  if(!block)return;
  const lang=block.dataset.lang==='en'?'en':'ja';
  const names=lang==='en'?['Plan A','Plan B','Plan C']:['プランA','プランB','プランC'];
  const controls=[...block.querySelectorAll('input[data-weight]')];
  const output=block.querySelector('[data-rank-results]');
  const summary=block.querySelector('[data-rank-summary]');
  if(controls.length!==3||!output||!summary)return;
  const paint=()=>{
    const weights=controls.map(input=>Number(input.value));
    controls.forEach((input,i)=>{const el=block.querySelector('[data-weight-value="'+i+'"]');if(el)el.textContent=String(weights[i]);});
    const ranked=rankSample(weights);
    output.replaceChildren(...ranked.map(({index,rank,score})=>{
      const row=root.createElement('tr');
      for(const value of [String(rank),names[index],score.toFixed(2)]){
        const cell=root.createElement('td');cell.textContent=value;row.appendChild(cell);
      }
      return row;
    }));
    const top=ranked.filter(x=>x.rank===1).map(x=>names[x.index]).join(lang==='ja'?'・':', ');
    summary.textContent=lang==='ja'?'現在の1位: '+top+'（重み '+weights.join(':')+'）':'Current leader: '+top+' (weights '+weights.join(':')+')';
  };
  controls.forEach(input=>input.addEventListener('input',paint));
  const reset=block.querySelector('[data-reset-weights]');
  if(reset)reset.addEventListener('click',()=>{controls.forEach(input=>{input.value='1'});paint();});
  paint();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>bindScoringGuide(document),{once:true});
  else bindScoringGuide(document);
}
