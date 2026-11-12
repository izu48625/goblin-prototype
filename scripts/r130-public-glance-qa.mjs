import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [page,source,css]=await Promise.all([read('public.html'),read('cloud/public.js'),read('cloud/public.css')]);
assert(/cloud\/public\.js\?v=[a-z0-9._-]+/i.test(page)&&
  /cloud\/public\.css\?v=[a-z0-9._-]+/i.test(page),
  'Public visitor must load independently versioned score preview assets');
assert(page.includes('name="robots" content="noindex,follow"'),
  'Viewer should retain noindex; SEO goes through visibility-verified /work/:id');
const start=source.indexOf('  function publicGlance(');
const end=source.indexOf('  function socialCategoryLabel(',start);
assert(start>=0&&end>start,'The current public renderer must define the preview');
const renderStart=source.indexOf('$'+'{publicGlance({rows,criteria,creatorRanking,scale,weighted,ja,publicTargetHtml})}');
const actionsStart=source.indexOf('<div class="primaryActions">');
const matrixStart=source.indexOf('<div class="tableWrap creatorScoreTable"');
assert(renderStart>=0&&renderStart<actionsStart&&renderStart<matrixStart,
  'Comparison highlights must precede the actions and full score matrix');
assert(source.includes('const creatorRanking=rows.map('),
  'Reuse existing creator-average ranking; do not recalculate independently');
assert(source.includes('const tableRows=rows.map('),'All detailed scores must remain intact');
assert(source.includes('const metricChips=criteria.map('),'Existing criteria detail must remain intact');
assert(source.includes('<section id="communitySection"'),'Community must remain intact');
assert(css.includes('@media(max-width:700px)')&&css.includes('.glanceLayout{grid-template-columns:1fr}'),
  'Preview must stack on narrow screens');
assert(css.includes('.glanceRankName .publicTargetText'),'Long subject names must be constrained');

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>value===null||value===undefined||value===''?null:
  Number.isFinite(Number(value))?Number(value):null;
const fmt=value=>value==null?'—':Number.isInteger(Number(value))?String(value):Number(value).toFixed(1);
const scope={esc,num,fmt};
vm.createContext(scope);
vm.runInContext(source.slice(start,end)+'\nthis.glance=publicGlance;',scope);
const glance=scope.glance;
const criteria=['Attack','Speed','Defense','Strategy'].map(name=>({name}));
const malicious='Rival <img src=x onerror=alert(1)>';
const rows=[
  {name:'Hero & Friend',scores:[9,8,8,9]},
  {name:malicious,scores:[8,9,7,8]},
  {name:'Third',scores:[6,7,7,8]}
];
const ranking=[
  {index:0,name:rows[0].name,value:8.5},
  {index:1,name:rows[1].name,value:8.0},
  {index:2,name:rows[2].name,value:7.0}
];
const args={rows,criteria,creatorRanking:ranking,scale:10,weighted:false,ja:true,
  publicTargetHtml:(name)=>'<span>'+esc(name)+'</span>'};
const html=glance(args);
assert(html.includes('比較結果をひと目で')&&html.includes('作成者の総合TOP3'));
assert(html.includes('Hero &amp; Friend'));
assert(html.includes('8.5 <small>/ 10</small>'));
assert(html.includes('width:85.0%')&&html.includes('width:80.0%'));
assert(html.includes('レーダーは入力された元の点数'));
assert(html.includes('aria-labelledby="creatorRadarTitle creatorRadarDescription"'));
assert(html.includes('<svg class="glanceRadarSvg"'));
assert(html.includes('4. Strategy'),'Axis labels must be available to screen readers');
assert(!html.includes(malicious),'Malicious creator name must be HTML-escaped');
assert(html.includes('Rival &lt;img src=x onerror=alert(1)&gt;'));
assert(!html.includes('>undefined<'));
assert.equal((html.match(/class="glanceRadarRing"/g)||[]).length,4);
assert.equal((html.match(/fill-opacity="0.13"/g)||[]).length,3,
  'All three fully scored subjects should be compared using their own submitted scores');
const weighted=glance({...args,weighted:true,ja:false});
assert(weighted.includes('Weighted average'));
assert(weighted.includes('Radar uses original entered scores'));

const partial=glance({...args,rows:[
  {name:'A',scores:[9,null,8,9]},{name:'B',scores:[7,8,8,9]},
  {name:'C',scores:[6,7,8,9]}
]});
assert.equal((partial.match(/fill-opacity="0.13"/g)||[]).length,2,
  'An incomplete subject must not render a fake zero radar polygon');
const tooFew=glance({...args,criteria:criteria.slice(0,2)});
assert(!tooFew.includes('class="glanceRadarSvg"'));
assert(tooFew.includes('glanceNoRadar'));
const noScores=glance({...args,creatorRanking:[],rows:[],criteria:[]});
assert(noScores.includes('公開された点数はまだありません'));
assert(!noScores.includes('NaN')&&!noScores.includes('class="glanceRadarSvg"'));
const escapedCriteria=glance({...args,criteria:[
  {name:'Attack'},{name:'<script>bad</script>'},{name:'Defense'}]});
assert(!escapedCriteria.includes('<script>bad</script>'));
assert(escapedCriteria.includes('&lt;script&gt;bad&lt;/script&gt;'));
const allMetrics=glance({...args,criteria:Array.from({length:10},(_,i)=>({name:'Metric '+i})),
  rows:rows.map((r,i)=>({...r,scores:Array.from({length:10},(_,j)=>Math.max(0,10-i-j/10))}))});
assert(allMetrics.includes('10. Metric 9'));
assert.equal((allMetrics.match(/glanceRadarAxisLabel/g)||[]).length,10);

console.log('R130 public comparison glance PASS: real top-3 scores, raw radar, privacy, no-zeros, XSS, long labels and mobile CSS');
