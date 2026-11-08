// Records the exchanges the golden tests replay: node tests/fixtures/record.mjs
// Every response is stored verbatim as <n>.json beside an index of request key -> file. Re-record when a source
// changes, then update the expected numbers in tests/golden.test.js from the diff.
import fs from 'node:fs';
import {censusMany,sephSectors} from '../../site/js/api.js';
import {MEASURE_IDS} from '../../site/js/regional-model.js';
import {CANADA,PT,provinceGeo} from '../../site/js/model.js';
import {key} from './replay.mjs';

const dir=new URL('.',import.meta.url),index={},live=globalThis.fetch;
globalThis.fetch=async(url,o={})=>{
  const r=await live(url,{...o,headers:{...o.headers,'Accept-Language':'en'}}),text=await r.text(),k=key(url,o.body),file=`${Object.keys(index).length}.json`;
  if(!r.ok)throw Error(`${r.status} ${url}`);
  index[k]=file;fs.writeFileSync(new URL(file,dir),text);
  return new Response(text,{status:r.status});
};
await censusMany('PR',[CANADA.id,...PT.map(([c])=>provinceGeo(c).id)],MEASURE_IDS);
await sephSectors(provinceGeo('46'));
fs.writeFileSync(new URL('index.json',dir),JSON.stringify({recorded:new Date().toISOString().slice(0,10),index},null,1));
console.log(Object.keys(index).length,'exchanges');
