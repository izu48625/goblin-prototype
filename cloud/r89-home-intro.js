/* R89: light, first-party Home introduction; no data writes/network/tracking. */
(() => {
  'use strict';
  const intro=document.getElementById('r89HomeIntro');
  if(!intro||document.body.classList.contains('communityShell'))return;
  const langCopy={
    ja:{title:'好きなものを採点・比較しよう',desc:'レーダー・ランキング・Tier表などのグラフを作成。すぐ下の表から始められます。',
      examples:'作例を見る',close:'案内を閉じて採点表を広く表示',guide:'はじめての方へ｜作例と使い方',
      heading:'採点をグラフ・ランキング・Tier表で見比べる',
      paragraphs:[
        'Stats Makerは、キャラクター、スポーツ、ゲーム、映画など好きなテーマを自分の基準で評価し、比較できるWebツールです。対象名と評価項目を入力すると、表で点数を管理しながら、レーダーチャートやランキング、Tier表、棒グラフなどに切り替えられます。',
        '棒グラフでドリンクの好みを比べる、象限グラフで散歩ルートを比較する、折れ線で学習習慣の変化を見るなど、5種類の使い道を数値・完成画像・手順つきで紹介しています。さらに同じ6チームの数値をレーダー、ランキング、Tier表に変換する3作例もあります。',
        '作例の点数は説明用のサンプルです。実測値や公式の評価を表すものではありません。自分の作品は保存・画像出力ができ、公開するかどうかは設定で選べます。'
      ],
      sectionTitles:['何から始める？','完成した作例から選べます'],
      instructions:[
        'ホームの採点表に、比較する対象と共通の採点項目を入力する。',
        '各項目を同じ尺度で採点する。主観評価なら基準を揃える。',
        '「データやグラフ」から目的に合うグラフを選び、PNGで保存する。'
      ],
      links:['5つの実践作例','3つの形式比較','採点基準と重み付け','お問い合わせ']
    },
    en:{title:'Rate and compare what you love',desc:'Create radar charts, rankings and tier lists. Start with the scoring table right below.',
      examples:'View examples',close:'Dismiss introduction and expand the scoring table',guide:'Getting started | Examples and instructions',
      heading:'Create ratings, comparisons and visual charts',
      paragraphs:[
        'Stats Maker is a free-to-use chart and rating tool for comparing characters, sports, games, movies and your own ideas. Enter subjects and scoring criteria in the table, then switch between radar charts, rankings, tier lists and other visual formats.',
        'Explore five practical uses, such as comparing drinks on a bar chart, plotting walking routes on two axes and tracking study habits over time. See the exact input scores, native exported images and steps for each chart. Three more examples show how the same ratings can become radar, ranking and tier charts.',
        'All example numbers are illustrative, not measured findings or official ratings. Your own work stays local unless you choose to publish it; you can save, edit and export charts as images.'
      ],
      sectionTitles:['Get started in three steps','Start with a finished example'],
      instructions:[
        'Enter your subjects and the same scoring criteria for each in the Home table.',
        'Use a consistent scale and define what each score means.',
        'Open Visual Tools to select a chart format and export a PNG.'
      ],
      links:['Five practical examples','Three format comparisons','Scoring and weighting guide','Contact']
    }
  };
  function setLanguage(lang){
    const current=lang==='en'?'en':'ja', c=langCopy[current];
    intro.querySelector('h1').textContent=c.title;
    intro.setAttribute('aria-label',current==='en'?'Stats Maker introduction':'Stats Makerの使い方');
    intro.querySelector('p').textContent=c.desc;
    const link=intro.querySelector('a');link.textContent=c.examples;link.href='/'+current+'/use-cases.html';
    const close=intro.querySelector('button');close.setAttribute('aria-label',c.close);close.title=c.close;
    const guide=document.getElementById('r87HomeGuide');
    if(guide){
      guide.querySelector('summary').textContent=c.guide;
      guide.querySelector('h2').textContent=c.heading;
      guide.querySelectorAll('h3').forEach((x,i)=>{if(c.sectionTitles[i])x.textContent=c.sectionTitles[i]});
      guide.querySelectorAll('.r87HomeGuideBody>p:not(.r87HomeGuideLinks)').forEach((x,i)=>{if(c.paragraphs[i])x.textContent=c.paragraphs[i]});
      guide.querySelectorAll('ol>li').forEach((x,i)=>{if(c.instructions[i])x.textContent=c.instructions[i]});
      guide.querySelectorAll('.r87HomeGuideLinks a').forEach((x,i)=>{
        x.textContent=c.links[i]||x.textContent;
        x.href='/'+current+'/'+(['use-cases.html','examples.html','scoring-guide.html','legal.html#contact'][i]);
      });
    }
  }
  window.SM_R89_LANGUAGE=setLanguage;
  const initial=new URLSearchParams(location.search).get('lang');
  const stored=initial==='ja'||initial==='en'?initial:
    localStorage.getItem('statsMaker.locale')||localStorage.getItem('statsMakerV2Language')||navigator.language;
  setLanguage(String(stored||'en').toLowerCase().startsWith('ja')?'ja':'en');
  const HIDDEN_KEY='statsMaker.r89HomeIntroHidden';
  const preferenceRead=()=>{try{return localStorage.getItem(HIDDEN_KEY)==='1'}catch{return false}};
  const preferenceWrite=hidden=>{try{
    if(hidden)localStorage.setItem(HIDDEN_KEY,'1');
    else localStorage.removeItem(HIDDEN_KEY);
  }catch{/* Private browsing must not disable the intro controls. */}};
  const requested=new URLSearchParams(location.search).get('intro')==='1';
  if(requested)preferenceWrite(false);
  if(!requested&&preferenceRead())document.body.classList.add('r89IntroDismissed');
  intro.querySelector('button').addEventListener('click',()=>{
    document.body.classList.add('r89IntroDismissed');preferenceWrite(true);
  });
  // Accessible "Show introduction" entry in the global Help menu.
  window.addEventListener('statsmaker:home-intro-show',()=>{
    preferenceWrite(false);document.body.classList.remove('r89IntroDismissed');
    intro.querySelector('h1')?.focus?.({preventScroll:true});
  });
  window.addEventListener('statsmaker:site-languagechange',e=>setLanguage(e.detail?.locale));
})();
