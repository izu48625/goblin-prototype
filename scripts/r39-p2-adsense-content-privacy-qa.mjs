import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const files=['ja/index.html','en/index.html','ja/legal.html','en/legal.html',
  'cloud/ad-layout.js','cloud/analytics-config.js'];
const [jaIntro,enIntro,jaLegal,enLegal,ads,analytics]=await Promise.all(files.map(read));
const terms=[
  [jaLegal,/Google広告の導入予定とCookie/,/Google マイ アド センター/,
    /2026年10月14日現在、実際のAdSense広告の配信・広告用トラッキングは開始していません/,
    /第三者配信事業者/,/EEA、英国、スイス/,/著作権/],
  [enLegal,/Planned Google advertising and cookies/,/Google My Ad Center/,
    /As of October 14, 2026, live AdSense ads and ad-related tracking have not been activated/,
    /third-party vendors/,/EEA, UK and Switzerland/,/Quality and rights of public works/]
];
for(const [page,...patterns] of terms){
  for(const re of patterns)assert(re.test(page),'Missing AdSense policy disclosure: '+re);
  assert(page.includes('https://policies.google.com/technologies/partner-sites'),
    'Google partner-sites disclosure absent');
  assert(page.includes('https://optout.aboutads.info/'),
    'Third-party opt-out reference absent');
  for(const id of ['terms','privacy','copyright','contact'])
    assert(page.includes('id="'+id+'"'),'Existing terms/privacy/contact anchor removed '+id);
  assert(!/<script[^>]+(?:adsbygoogle|pagead2\.googlesyndication)/i.test(page),
    'Do not silently load real advertising during signup');
}
assert(jaLegal.includes('最終更新：2026年10月14日'));
assert(enLegal.includes('Last updated: October 14, 2026'));
assert(jaIntro.includes('id="rating-guide"')&&enIntro.includes('id="rating-guide"'));
assert(jaIntro.includes('架空データ')&&enIntro.includes('fictional examples'),
  'Do not present made-up example work as genuine public user submissions');
assert(jaIntro.includes('攻撃8・守備6・連携7')&&enIntro.includes('scores 8, 6, and 7'),
  'Original scoring guide must include concrete useful example');
assert(jaIntro.includes('実際の統計')&&enIntro.includes('factual statistics'));
assert(analytics.includes('enabled:false')&&analytics.includes("measurementId:''"),
  'GA4 must stay disabled until owner grants explicit approval');
assert(ads.includes("get('adPreview')==='1'"),
  'Only development preview ads may be displayed before account approval');
const isPlaceholderTitle=title=>/^(?:新しいお題|untitled|new topic|new sheet|無題)(?:\s*\d+)?$/i.test(title);
assert(isPlaceholderTitle('新しいお題 10'),'numbered placeholder title regression');
assert(isPlaceholderTitle('Untitled 7'),'English numbered placeholder title regression');
assert(!isPlaceholderTitle('新しいお題で友人の能力を比較'),'legitimate longer title must not be flagged');
console.log('R39 P2 JA/EN original landing content, UGC terms and pre-AdSense privacy QA PASS');

// Read-only public listing quality check. No guessing about image copyrights;
// only surface review signals. Never fetch unlisted/private or write to Supabase.
if(process.argv[2]==='public-readonly'){
  const config=await read('cloud/supabase.js');
  const url=config.match(/SUPABASE_URL='([^']+)'/)?.[1];
  const key=config.match(/SUPABASE_PUBLISHABLE_KEY='([^']+)'/)?.[1];
  assert(url?.startsWith('https://')&&key?.startsWith('sb_publishable_'),
    'Only publicly shipped Supabase URL and publishable key may be used');
  const params=new URLSearchParams({
    select:'id,title,description,visibility,snapshot,source_topic_id,score_scale,weighted',
    visibility:'eq.public',order:'published_at.desc',limit:'60'
  });
  let response;
  try{
    response=await fetch(url+'/rest/v1/topics?'+params,{
      headers:{apikey:key,Authorization:'Bearer '+key,
        'User-Agent':'StatsMaker-R39-P2-ReadOnly-Quality/1.0'},
      signal:AbortSignal.timeout(20000)
    });
  }catch(e){
    console.log('R39 P2 LIVE PUBLIC SAMPLE UNVERIFIED: read-only request failed. Manual public-work inspection still required.',String(e));
    process.exit(0);
  }
  if(!response.ok){
    console.log('R39 P2 LIVE PUBLIC SAMPLE UNVERIFIED: HTTP '+response.status+'. Manual review required.');
    process.exit(0);
  }
  const rows=await response.json();
  assert(Array.isArray(rows),'Public topics response is not a list');
  assert(rows.every(row=>row.visibility==='public'),'Unlisted/private records must never enter audit');
  const flagged=[];
  const fingerprintCounts=new Map();
  for(const work of rows){
    // This only detects identical public score snapshots; not stolen work.
    const snapshot=work.snapshot && typeof work.snapshot==='object'?work.snapshot:{};
    const key=JSON.stringify(snapshot);
    fingerprintCounts.set(key,(fingerprintCounts.get(key)||0)+1);
  }
  for(const work of rows){
    const reasons=[];
    const title=String(work.title||'').trim();
    const description=String(work.description||'').trim();
    const snapshot=work.snapshot && typeof work.snapshot==='object'?work.snapshot:{};
    const targets=Array.isArray(snapshot.rows)?snapshot.rows:[];
    const criteria=Array.isArray(snapshot.criteria)?snapshot.criteria:[];
    if(!title || isPlaceholderTitle(title))
      reasons.push('unhelpful-title');
    if(!description)reasons.push('empty-description');
    else if(description.length<25)reasons.push('thin-description');
    if(/(?:コピー\s*){2,}|(?:（Remix）){2,}/i.test(title))
      reasons.push('repeated-copy-or-remix-title');
    if(/（Remix）/i.test(title) && !work.source_topic_id)
      reasons.push('remix-source-reference-review');
    if(['GOAT','GOATネオ'].includes(title))reasons.push('ambiguous-title');
    if(fingerprintCounts.get(JSON.stringify(snapshot))>1)
      reasons.push('identical-public-score-snapshot');
    if(targets.length<2)reasons.push('few-targets');
    if(criteria.length<2)reasons.push('few-criteria');
    if(targets.some(item=>!String(item?.name||'').trim()))reasons.push('unnamed-targets');
    if(criteria.some(item=>!String(item?.name||'').trim()))reasons.push('unnamed-criteria');
    if(reasons.length)flagged.push({id:work.id,reasons});
  }
  const totals={sampledPublic:rows.length,flagged:flagged.length,
    byReason:Object.fromEntries([...new Set(flagged.flatMap(x=>x.reasons))]
      .sort().map(reason=>[reason,flagged.filter(x=>x.reasons.includes(reason)).length]))};
  console.log('R39 P2 LIVE PUBLIC QUALITY REVIEW (NOT a copyright verdict)',JSON.stringify(totals));
  console.log('R39 P2 public review links',
    JSON.stringify(flagged.slice(0,20).map(x=>({url:'https://statsmaker.app/public.html?id='+x.id,reasons:x.reasons}))));
  console.log('R39 P3 QUALITY SIGNALS ARE NOT GOOGLE RULES: No minimum title/description character count or duplicate-snapshot prohibition is inferred.');
  console.log('R39 P2 RIGHTS STILL NEED HUMAN REVIEW: uploaded images, quoted text, creator authorization and harassment cannot be inferred from titles or scores.');
}
