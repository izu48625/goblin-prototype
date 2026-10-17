import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import test from 'node:test';
import {cardFromTopic,renderOgPng} from '../worker/og-image.js';

const topic={title:'世界サッカー選手ランキング 2026',score_scale:100,weighted:true,
 snapshot:{weighted:true,metadata:{category:'sports'},criteria:[{weight:2},{weight:1}],rows:[
 {name:'Messi',scores:[95,98]},{name:'Ronaldo',scores:[93,94]},
 {name:'Mbappe',scores:[null,100]},{name:'Unrated',scores:[null,null]}]}};
function chunks(buf){
 const result=[];let offset=8;
 while(offset<buf.length){
  const length=new DataView(buf.buffer,buf.byteOffset+offset,4).getUint32(0);
  const type=new TextDecoder().decode(buf.subarray(offset+4,offset+8));
  result.push({type,data:buf.subarray(offset+8,offset+8+length)});offset+=length+12;
 }
 return result;
}
test('weighted ranking excludes missing scores',()=>{
 const card=cardFromTopic(topic);
 assert.equal(card.category,'SPORTS');
 assert.equal(card.targets,4);assert.equal(card.metrics,2);
 assert.deepEqual(card.ranking.map(x=>x.name),['Mbappe','Messi','Ronaldo']);
 assert.deepEqual(card.ranking.map(x=>x.value),[100,96,93.3]);
});
test('empty sheet generates a PNG',()=>{
 const card=cardFromTopic({title:'無題',snapshot:{criteria:[],rows:[]}});
 assert.equal(card.ranking.length,0);
 assert.ok(renderOgPng(card).length>90000);
});
test('PNG structure, dimensions and inflate payload',()=>{
 const image=renderOgPng(cardFromTopic(topic));
 assert.deepEqual([...image.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 const parts=chunks(image);
 assert.deepEqual(parts.map(p=>p.type),['IHDR','PLTE','IDAT','IEND']);
 const view=new DataView(parts[0].data.buffer,parts[0].data.byteOffset);
 assert.equal(view.getUint32(0),600);assert.equal(view.getUint32(4),315);
 assert.equal(view.getUint8(8),4);assert.equal(view.getUint8(9),3);
 assert.equal(inflateSync(parts[2].data).length,(600/2+1)*315);
});
