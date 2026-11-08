import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPublicScoreVisual} from '../worker/public-score-visual.js';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const seo=await read('worker/seo.js');
const originalWorker=await read('worker/index.js');
assert(seo.includes("import {renderPublicScoreVisual} from './public-score-visual.js'"),
  'Indexable work HTML must import the Public-only visualization');
assert(seo.includes('const scoreVisual=renderPublicScoreVisual(displaySubjects,displayMetrics,alignedScores,lang,validScale);'),
  'Render only from the current aligned 6×5 Public score excerpt');
assert(seo.includes("    scoreVisual+\n    (list.length?"),'Visual data belongs directly in indexable HTML');
assert(seo.includes('publicScoreVisualCss'),'SSR must have layout CSS without browser JavaScript');
assert(seo.includes("visibility:'eq.public'"),'Never expand SEO query beyond Public rows');
assert(seo.includes("return response(html,'text/html; charset=utf-8',200,'no-store');"),
  'Visibility revocation must not leave a cached SSR page');
assert(!seo.includes('service_role'),'Public page cannot use a privileged Supabase key');
assert(originalWorker.includes("if(seoWork)"),'Worker first must still handle canonical Public URLs');

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const malware='<img src=x onerror=alert(1)>';
const names=['Alice & Bob',malware,'Charlie'];
const columns=['Attack','Speed','Defense','Strategy'];
const values=[[10,8,9,7],[8,9,7,8],[7,6,6,8]];
const html=renderPublicScoreVisual(names,columns,values,'en',10);
assert(html.includes('Visual comparison of published scores'));
assert(html.includes('class="seoVisualBars"'));
assert(html.includes('class="seoVisualRadar"'));
assert(html.includes('score bars'));
assert(html.includes('>10 / 10</strong>'),'Maximum raw score should be visible with its scale');
assert(html.includes('width:100.0%')&&html.includes('width:80.0%'));
assert(html.includes('Alice &amp; Bob'));
assert(html.includes(esc(malware)));
assert(!html.includes(malware),'Submitted user HTML must not execute');
assert(html.includes('<svg role="img" aria-labelledby="seoPreviewTitle seoPreviewDescription"'));
assert(html.includes('<desc id="seoPreviewDescription">1. Attack / 2. Speed / 3. Defense / 4. Strategy</desc>'));
assert.equal((html.match(/fill-opacity=".17"/g)||[]).length,3);
assert(!html.includes('NaN')&&!html.includes('Infinity'));
const ja=renderPublicScoreVisual(names,columns,values,'ja',10);
assert(ja.includes('公開スコアをグラフで比較'));
assert(ja.includes('項目ごとの比較であり総合順位ではありません。'));
assert(ja.includes('レーダー · 採点済み対象の抜粋'));

// Preserve individual author-entered scores, missing is never treated as zero.
const missing=renderPublicScoreVisual(
  ['Alpha','Beta','Gamma'],columns,
  [[10,null,9,7],[8,9,7,8],[7,6,6,8]],'ja',10);
assert(!missing.includes('NaN'));
assert.equal((missing.match(/fill-opacity=".17"/g)||[]).length,2,
  'Do not draw a polygon for subjects with an unscored criterion');
const zero=renderPublicScoreVisual(['Zero','A','B'],columns,
  [[0,0,0,0],[8,8,8,8],[7,7,7,7]],'ja',10);
assert(zero.includes('>0 / 10</strong>'),'Actual zero ratings are different from missing');
const invalid=renderPublicScoreVisual(['X','Y','Z'],columns,
  [[true,'false',Infinity,''],['NaN',-1,1000,''],[null,null,null,null]],'ja',10);
assert.equal(invalid,'','Do not generate charts from invalid or unscored values');
const noMulti=renderPublicScoreVisual(['A'],columns,[[5,6,7,8]],'ja',10);
assert.equal(noMulti,'','Do not invent comparisons with just one rated subject');
assert.equal(renderPublicScoreVisual(names,columns,values,'ja',5),'');
assert.equal(renderPublicScoreVisual([],columns,[],'ja',10),'');
assert.equal(renderPublicScoreVisual(names,[],values,'ja',10),'');
assert.equal(renderPublicScoreVisual(null,columns,values,'ja',10),'');

const twoCriteria=renderPublicScoreVisual(names,columns.slice(0,2),values,'en',10);
assert(twoCriteria.includes('seoVisualMetric'));
assert(!twoCriteria.includes('class="seoVisualRadar"'));
assert(twoCriteria.includes('Missing values are never treated as zero.'));

const overflow=renderPublicScoreVisual(names,Array.from({length:10},(_,i)=>'Criterion '+i),
  names.map(()=>Array(10).fill(9)),'en',10);
assert.equal((overflow.match(/class="seoVisualMetric"/g)||[]).length,3,
  'Only first 3 metrics get score bars; no unbounded render');
assert(!overflow.includes('Criterion 5'),'Only first 5 metrics may be drawn');
assert(!overflow.includes('Criterion 9'));

const injection=renderPublicScoreVisual([malware,'Safe'],[malware,'Defense','Speed'],
  [[9,8,9],[7,8,9]],'ja',10);
assert(!injection.includes(malware),'Labels must be escaped even in graph metadata');
assert(injection.includes('&lt;img src=x onerror=alert(1)&gt;'));

const missingFirst=renderPublicScoreVisual(['X','Y','Z'],['','Speed','Defense','Attack'],
  [[1,9,8,7],[1,7,8,9],[1,8,7,8]],'ja',10);
assert(missingFirst.includes('Speed'));
assert(!missingFirst.includes('NaN'),'Blank criterion must not misalign score array');

console.log('R131 PASS: Public-only SSR source, honest 6x5 preview, no-JS SVG, XSS, null/zero distinction, max scores, JA/EN, bounded layout');
