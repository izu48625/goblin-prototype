// Read-only live asset deployment check. No Supabase, no auth creation,
// no rating submissions, no private work URLs.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const root=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/+$/,'');
async function fetchAsset(path){
  const response=await fetch(root+path,{headers:{Accept:'text/html,application/javascript',
    'Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(16000)});
  return {status:response.status,body:await response.text(),contentType:response.headers.get('content-type')||''};
}
let passed=false;
for(let attempt=1;attempt<=10;attempt++){
  try{
    const home=await fetchAsset('/index.html');
    assert.equal(home.status,200);
    assert(home.body.includes('cloud/community-home.js?v=r133-entry1'),
      'New Community shell script reference not yet deployed');
    assert(home.body.includes('.communityLoadBack:focus-visible'),
      'Accessible error recovery link styling not yet deployed');
    const [logic,model]=await Promise.all([
      fetchAsset('/cloud/community-home.js?v=r133-entry1'),
      fetchAsset('/cloud/community-rating-model.js?v=r133-entry1')
    ]);
    assert.equal(logic.status,200);
    assert.equal(model.status,200);
    assert(logic.body.includes('const preflight=await loadTopic(sb);'));
    assert(logic.body.includes('if(!canJoinCommunityTopic(topic))throw new Error'));
    const validate=logic.body.indexOf('const preflight=await loadTopic(sb);');
    const authenticate=logic.body.indexOf('await ensureUser(sb);',validate);
    const ownScores=logic.body.indexOf('context=await loadData(sb,preflight);',authenticate);
    assert(validate>0&&authenticate>validate&&ownScores>authenticate,
      'Production must validate current author permissions before identity creation');
    assert(logic.body.includes("back.href='public.html?id='+encodeURIComponent(topicId)"),
      'Recovery navigation missing');
    assert(model.body.includes('export function canJoinCommunityTopic(topic)'));
    assert(model.body.includes("topic.visibility==='public'||topic.visibility==='unlisted'"));
    assert(model.body.includes("topic.show_community===true && topic.allow_ratings===true"));
    passed=true;
    console.log('LIVE R133 PASS',{origin:root,attempt,checked:'public shell, consent preflight, return link'});
    break;
  }catch(error){
    console.log('R133 deployment pending '+attempt+'/10: '+error.message);
    if(attempt<10)await delay(10000);
  }
}
assert(passed,'Updated Community entry assets were not deployed during bounded verification window');
