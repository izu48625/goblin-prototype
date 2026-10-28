import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';

const BASE=process.env.BASE_URL||'http://127.0.0.1:8765';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const roadmap=await read('ROADMAP_R31_PLUS.md');
assert(roadmap.includes('Search Console所有権確認・サイトマップ送信・日英紹介ページのGoogle登録は本人確認済み'),
  'Roadmap must reflect the owner-completed GSC verification without repeating setup');
assert(roadmap.includes('https://statsmaker.app/sitemap.xml'));
const en=await read('en/index.html'),ja=await read('ja/index.html');
const originalIntro={
  ja:'キャラ比較や選手の能力値比較も、攻撃・防御・素早さなど好きな項目で採点。Stats Makerなら、同じ点数からレーダーチャート・ランキング・Tier表を作成して共有できます。',
  en:'Stats Maker is a chart maker for ranking characters, athletes, movies, games, products and anything else you want to compare.'
};
assert(ja.includes(originalIntro.ja),'Japanese introduction changed unexpectedly');
assert(en.includes(originalIntro.en),'English introduction changed unexpectedly');
for(const [s,language] of [[ja,'ja'],[en,'en']]){
  assert(s.includes('data-sm-localized-landing="'+language+'"'));
  assert(s.includes('/cloud/global-locale.css?v='),'Global navigation stylesheet remains versioned');
  assert(/\/cloud\/global-locale\.js\?v=r(?:35support1|38p3about1|47guideNav1|85examples1)/.test(s));
  assert(s.includes('hreflang="en"')&&s.includes('hreflang="ja"'));
}
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},locale:'ja-JP',
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  const browserErrors=[];
  page.on('pageerror',err=>browserErrors.push(err.message));
  for(const language of ['ja','en']){
    await page.goto(BASE+'/'+language+'/',{waitUntil:'domcontentloaded'});
    const bar=page.locator('.globalLocaleBar');
    await bar.waitFor({state:'visible'});
    assert.equal(await bar.count(),1,'Expected one common global bar');
    assert.equal(await bar.locator('.globalHomeBtn').count(),1);
    assert.equal(await bar.locator('.globalDiscoverBtn').count(),1);
    assert.equal(await bar.locator('[data-global-lang]').count(),2);
    assert.equal(await bar.locator('[data-global-lang="'+language+'"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('header nav').count(),0,'Landing has duplicate old top navigation');
    // Keep the original four compact feature cards, but allow the new
    // standalone R39 P2 original scoring-guide section below them.
    assert.equal(await page.locator('.grid').first().locator('article').count(),4);
    assert.equal(await page.locator('#rating-guide .grid article').count(),4,
      'Original score-method guide must have four useful steps');
    assert.equal(await page.locator('.hero h1').count(),1);
    assert.equal(await page.locator('main details').count(),4,
      'Four practical FAQs, including optional Community rating, must remain readable');
    const geometry=await page.evaluate(()=>{
      const card=document.querySelector('.grid article');
      const bar=document.querySelector('.globalLocaleBar');
      const title=card.querySelector('h3');
      const p=card.querySelector('p');
      return {
        width:innerWidth,docWidth:document.documentElement.scrollWidth,
        cardHeight:card.getBoundingClientRect().height,
        cardPadding:getComputedStyle(card).paddingTop,
        headingSize:parseFloat(getComputedStyle(title).fontSize),
        descriptionSize:parseFloat(getComputedStyle(p).fontSize),
        barHeight:bar.getBoundingClientRect().height,
        position:getComputedStyle(bar).position
      };
    });
    assert(geometry.docWidth<=geometry.width+2,'Page horizontally overflows iPhone '+JSON.stringify(geometry));
    assert(geometry.cardHeight<120,'Feature cards too tall on iPhone '+JSON.stringify(geometry));
    assert(parseFloat(geometry.cardPadding)<=13,'Card padding not compact');
    assert(geometry.headingSize<=16&&geometry.descriptionSize<=14);
    assert.equal(geometry.position,'sticky');
    assert(geometry.barHeight>=40&&geometry.barHeight<=52);
    const home=new URL(await bar.locator('.globalHomeBtn').getAttribute('href'));
    const discover=new URL(await bar.locator('.globalDiscoverBtn').getAttribute('href'));
    assert.equal(home.pathname,'/index.html');
    assert.equal(discover.pathname,'/discover.html');
    assert.equal(home.searchParams.get('lang'),language);
    assert.equal(discover.searchParams.get('lang'),language);
    await page.evaluate(()=>scrollTo(0,850));
    const offset=await bar.evaluate(el=>el.getBoundingClientRect().top);
    assert(Math.abs(offset)<2,'Common top bar did not stay fixed while scrolling');
    const stored=await page.evaluate(()=>localStorage.getItem('statsMaker.locale'));
    assert.equal(stored,language,'Landing did not synchronize chosen language');
    console.log('R34 compact cards and shared nav PASS',language,geometry);
  }
  await page.goto(BASE+'/ja/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-global-lang="en"]').click();
  await page.waitForURL(url=>url.pathname==='/en/'||url.pathname==='/en');
  assert.equal(await page.locator('[data-global-lang="en"]').getAttribute('aria-pressed'),'true');
  assert((await page.locator('h1').innerText()).includes('Turn ratings'));
  await page.locator('[data-global-lang="ja"]').click();
  await page.waitForURL(url=>url.pathname==='/ja/'||url.pathname==='/ja');
  assert((await page.locator('h1').innerText()).includes('評価や比較'));
  await page.locator('.globalDiscoverBtn').click();
  await page.waitForURL(url=>url.pathname.startsWith('/discover')&&url.searchParams.get('lang')==='ja');
  assert.equal(await page.locator('.globalLocaleBar').count(),1);
  assert.deepEqual(browserErrors,[],'Unexpected JS errors in localized pages');
  await context.close();
  console.log('R34 localized landing mobile compact layout/navigation/sitemap roadmap QA PASS');
}finally{await browser.close()}
