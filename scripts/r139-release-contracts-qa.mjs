import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [outer,home,pub,p4,p3,p17,readiness,ogWorkflow,selector,publicSelector]=await Promise.all([
  'index.html','base/index.html','public.html','scripts/r38-p4-live-palette-qa.mjs',
  'scripts/r38-p3-ui-regression-qa.mjs','scripts/r38-p17-prelaunch-readonly-qa.mjs',
  'scripts/r38-readonly-readiness-qa.mjs','.github/workflows/ogp-smoke.yml',
  'scripts/r139-select-current-ogp-work.mjs','scripts/r134-production-smoke-topic.mjs'
].map(read));
const asset=(src,pattern,label)=>{const val=src.match(pattern)?.[1];assert(val,'Missing '+label);return val;};
const keys={
  iframe:asset(outer,/base\/index\.html\?v=([a-z0-9._-]+)/i,'Home iframe revision'),
  css:asset(home,/css\/style\.css\?v=([a-z0-9._-]+)/i,'Home CSS revision'),
  app:asset(home,/js\/app\.js\?v=([a-z0-9._-]+)/i,'Home app revision'),
  i18n:asset(home,/js\/i18n\.js\?v=([a-z0-9._-]+)/i,'Home translation revision'),
  publicCSS:asset(pub,/cloud\/public\.css\?v=([a-z0-9._-]+)/i,'public CSS revision'),
  publicJS:asset(pub,/cloud\/public\.js\?v=([a-z0-9._-]+)/i,'public JS revision')
};
assert(Object.values(keys).every(v=>/^[a-z0-9._-]+$/i.test(v)),
  'Every referenced asset must carry a valid cache revision');
assert(p4.includes("const APP_KEY=version("));
assert(p4.includes("host.base+'/base/js/app.js?v='+APP_KEY"));
assert(p4.includes("host.base+'/base/css/style.css?v='+STYLE_KEY"));
assert(p17.includes('keys.cssKey')&&p17.includes('keys.appKey')&&p17.includes('keys.i18nKey'));
assert(p17.includes('keys.publicCSSKey')&&p17.includes('keys.publicJSKey'));
assert(!p17.includes('home.cssKey===homeKey'));
assert(p3.includes('expectedFrame&&iframeSource?.includes(expectedFrame)'));
assert(p3.includes('expectedCssHref&&cssSource===expectedCssHref'));
assert(!readiness.includes("const KNOWN_PUBLIC='57b432ed-"));
assert(readiness.includes('const currentPublicId=await resolveCurrentPublicSmokeTopic()'));
assert(ogWorkflow.includes('node scripts/r139-select-current-ogp-work.mjs'));
assert(!ogWorkflow.includes('PUBLIC_TOPIC_ID: 57b432ed-'));
assert(selector.includes('resolveCurrentPublicSmokeTopic'));
assert(selector.includes("appendFileSync(process.env.GITHUB_ENV"));
assert(publicSelector.includes("visibility:'eq.public'") &&
  publicSelector.includes('row?.show_community===true'));
console.log('R139 PASS: actual independent asset versions, safe current Public SEO and OGP IDs',keys);
