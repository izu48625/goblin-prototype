import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const styles=await read('cloud/r71-showcase.css');
const discover=await read('cloud/discover.js');
const cardStyle=await read('cloud/discover.css');
const page=await read('discover.html');
const root=await read('index.html');
assert(root.includes('id="basicRoot"')&&root.includes('id="basicFrame"'),'Home editor must remain intact');
assert(root.includes('id="extLauncher"'),'Home extension launcher intact');
assert(page.includes('cloud/discover.css?v=r71p1')&&/cloud\\/discover\\.js\\?v=[a-zA-Z0-9-]+/.test(page),'Cache bust visible');
assert(discover.includes("const initialCategory=incoming.get('category')"));
assert(discover.includes('categories.includes(initialCategory)'));
assert(discover.includes("initialView==='community'"));
assert(discover.includes("topic.visibility!=='public'"),'No non-Public records');
assert(discover.includes("cache:'no-store'"),'Do not reuse old browser response');
assert(discover.includes('${creatorPreviewHtml(topic)}'),'Previews from already fetched snapshots');
assert(!discover.includes("img src=\"/api/og"),'No OG thumbnail fanout');
assert(styles.includes('scroll-snap-type:x mandatory'));
assert(cardStyle.includes('/* R71: reveal truthful Public score previews'));
for(const lang of ['ja','en']){
 const html=await read(lang+'/index.html');
 assert(html.includes('r71-showcase.css?v=r71p1'));
 assert.equal((html.match(/id="visual-examples"/g)||[]).length,1);
 assert.equal((html.match(/class="r71ShowcaseCard"/g)||[]).length,3);
 assert(html.indexOf('id="visual-examples"')<html.indexOf('>How it works<') || lang==='ja',
   'English native gallery near hero');
 assert(html.includes('id="r71CategoryHeading"'));
 for(const chart of ['radar','ranking','tier']){
   assert(html.includes('/ja/example-images/sample-'+chart+'.png'),'Native '+chart);
   assert(html.includes('/'+lang+'/examples.html#'+chart),'Native guide link');
 }
 for(const category of ['manga_anime','game','sports','movie_tv']){
   assert(html.includes('/discover.html?lang='+lang+'&category='+category),'Real Discover filter '+category);
 }
 assert(html.includes('/discover.html?lang='+lang+'&view=community'));
 assert(html.includes('id="rating-guide"')&&html.includes('id="png-guide"'),'SEO guide copy retained');
 assert(html.includes('legal.html#contact'),'Contact retained');
 assert(!html.includes('adsbygoogle.js'),'No ads injected');
}
const analytics=await read('cloud/analytics-config.js');
assert(analytics.includes('enabled:false'),'No GA4 activation');
console.log('R71 static integrity, valid category links and privacy contract PASS');