import {cp,copyFile,mkdir,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const out=join(root,'dist');

const directories=['app','base','cloud','css','js'];
const files=[
  'index.html',
  'discover.html',
  'public.html',
  'rate.html',
  'editor.html',
  'base.html',
  'my.html',
  'robots.txt'
];

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const dir of directories){
  await cp(join(root,dir),join(out,dir),{recursive:true});
}
for(const file of files){
  await copyFile(join(root,file),join(out,file));
}

console.log('Cloudflare static bundle ready: '+out);
