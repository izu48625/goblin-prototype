import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canJoinCommunityTopic,buildCommunitySheet,collectCommunityScores} from '../cloud/community-rating-model.js';

const topic={id:'57b432ed-fbf2-4261-b57d-9e0f27356d2e',visibility:'public',
  allow_ratings:true,show_community:true};
assert.equal(canJoinCommunityTopic(topic),true,'Both author consent flags should allow Public join');
assert.equal(canJoinCommunityTopic({...topic,visibility:'unlisted'}),true,
  'Existing direct-link Unlisted participation must remain available');
for(const visibility of ['private','unknown','',null]){
  assert.equal(canJoinCommunityTopic({...topic,visibility}),false,
    'A non-viewable Community work must not allow join');
}
for(const property of ['show_community','allow_ratings']){
  for(const flag of [false,null,undefined,'true',1]){
    assert.equal(canJoinCommunityTopic({...topic,[property]:flag}),false,
      'Only a genuine boolean author permission may enable Community join');
  }
}
assert.equal(canJoinCommunityTopic(null),false);
assert.equal(canJoinCommunityTopic({}),false);

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [host,source,model]=await Promise.all([
  read('index.html'),read('cloud/community-home.js'),read('cloud/community-rating-model.js')
]);
assert(source.includes("import {buildCommunitySheet,collectCommunityScores,canJoinCommunityTopic}"));
assert(source.includes("if(!canJoinCommunityTopic(topic))throw new Error"),
  'Current author flags must be checked in a fail-closed preflight');
const sequence=source.indexOf("const preflight=await loadTopic(sb);");
const identity=source.indexOf("await ensureUser(sb);",sequence);
const hydrate=source.indexOf("context=await loadData(sb,preflight);",identity);
assert(sequence>0&&identity>sequence&&hydrate>identity,
  'Read-only preflight must precede anonymous login, then own scores');
const select=source.match(/\.select\('id,title,description,language_code[^']+'\)/)?.[0]||'';
for(const key of ['visibility','allow_ratings','show_community','community_minimum'])
  assert(select.includes(key),'Preflight should validate '+key+' from current source');
assert(source.includes("back.href='public.html?id='+encodeURIComponent(topicId)"),
  'Failed join must offer a safe, validated back link');
assert(source.includes("loading.appendChild(back)"));
assert(host.includes('cloud/community-home.js?v=r133-entry1'),'Fresh Community module must load');
assert(host.includes('.communityLoadBack:focus-visible'),'Back control must be keyboard accessible');

const sheet=buildCommunitySheet({
  id:topic.id,title:'Scores',score_scale:10,weighted:false
},[{id:'a',name:'A'}],[{id:'c',name:'Attack',weight:1}],[]);
assert.deepEqual(sheet.rows[0].scores,[null]);
assert.deepEqual(collectCommunityScores({...sheet,rows:[{...sheet.rows[0],scores:[7]}]},
  {topic:{id:topic.id,score_scale:10},items:[{id:'a',name:'A'}],
    criteria:[{id:'c',name:'Attack'}]}),
  {entries:[{item_id:'a',criterion_id:'c',score:7}],completed:1});
assert(!model.includes('signInAnonymously'),'Permission validator cannot create accounts');
console.log('R133 Community permission and auth-order preflight PASS');
