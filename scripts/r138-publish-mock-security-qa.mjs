import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [mock,editor,security]=await Promise.all([
  read('scripts/r28-publish-lifecycle-test.mjs'),
  read('base/js/app.js'),
  read('security/R136_INTERNAL_FUNCTION_EXECUTE_RESTRICTION.sql')
]);
assert(editor.includes("sb.rpc('topic_has_submissions',{p_topic_id:topicId})"),
  'Security review must retain the real client dependency');
assert(security.includes('TO authenticated, service_role;'),
  'Authenticated owner needs EXECUTE until safely replaced');
assert(security.includes('FROM PUBLIC, anon;'),'Anonymous privilege must remain denied');
assert(mock.includes("storage:{from(bucket){"),'Mock must support Storage initialization');
assert(mock.includes("bucket!=='topic-target-images'"));
assert(mock.includes('Text-only QA unexpectedly attempted image upload'),
  'No production image operation should slip into browser mock');
console.log('R138 PASS: publish UI depends on authenticated helper and mocked Storage, anon RPC remains denied');
