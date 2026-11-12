// Reuse the read-only Public-work selector from the successful production smoke.
// Writes only the ephemeral GitHub Actions environment file, never Supabase.
import {appendFileSync} from 'node:fs';
import {resolveCurrentPublicSmokeTopic} from './r134-production-smoke-topic.mjs';
const id=await resolveCurrentPublicSmokeTopic(process.env.PUBLIC_TOPIC_ID||'');
if(!process.env.GITHUB_ENV)throw new Error('GitHub Actions environment file is missing');
appendFileSync(process.env.GITHUB_ENV,'PUBLIC_TOPIC_ID='+id+'\n','utf8');
console.log('R139 OGP fixture: current Public work selected from read-only anonymous API');
