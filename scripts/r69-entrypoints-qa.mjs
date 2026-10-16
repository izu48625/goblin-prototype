import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// No network, no user data access: verify every promoted URL has a source file.
// The path list is intentionally fixed to the opt-in campaign playbook.
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const paths=[
 ['index.html','home'],
 ['discover.html','browse'],
 ['ja/index.html','Japanese landing'],
 ['en/index.html','English landing'],
 ['ja/chart-guide.html','Japanese charts'],
 ['en/chart-guide.html','English charts'],
 ['ja/png-guide.html','Japanese PNG'],
 ['en/png-guide.html','English PNG']
];
const read=p=>readFileSync(resolve(root,p),'utf8');
for(const [p,label] of paths){
 assert(existsSync(resolve(root,p)),label+' destination missing: '+p);
 assert.match(read(p),/<html lang="(?:ja|en)"/,
   'Page must explicitly declare Japanese or English: '+p);
}
const ja=read('ja/index.html'),en=read('en/index.html');
const supported=[
 [ja,'../index.html?lang=ja'],[ja,'../discover.html?lang=ja'],
 [en,'../index.html?lang=en'],[en,'../discover.html?lang=en'],
 [ja,'/ja/chart-guide.html'],[ja,'/ja/png-guide.html'],
 [en,'/en/chart-guide.html'],[en,'/en/png-guide.html']
];
for(const [source,href] of supported)
 assert(source.includes('href="'+href+'"'),'Promoted existing page has no CTA: '+href);
const doc=read('R69_ORGANIC_GROWTH_PLAYBOOK.md');
for(const [path] of paths){
 const url=path==='index.html'?'https://statsmaker.app/':
   'https://statsmaker.app/'+(path.endsWith('/index.html')
       ?path.replace(/index\.html$/,''):path);
 assert(doc.includes(url),'Campaign references missing valid canonical URL '+url);
}
const analytics=read('cloud/analytics-config.js');
assert.match(analytics,/enabled:false/);
assert.match(analytics,/measurementId:''/);
const preview=read('cloud/ad-layout.js');
assert(preview.includes('adPreview=1'),'Only explicitly requested advertising preview is allowed');
const home=read('index.html');
assert(home.includes('google-adsense-account') &&
       !home.includes('adsbygoogle.js'),
       'AdSense ownership tag must stay without production ad injection');
console.log('R69 no-cost growth entrypoint QA PASS: 8 supported URLs, JA/EN CTAs, no GA4 or live Ads');
