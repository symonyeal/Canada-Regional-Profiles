import test from 'node:test';
import assert from 'node:assert/strict';
import {squarify,niceTicks,geographyType,compact,ramp,luminance,tradedShare} from '../site/js/model.js';
import {parse,serialize,withGeography} from '../site/js/state.js';
import {boundaryWhere} from '../site/js/geo.js';
import {parseSelection,serializeSelection} from '../site/js/tools/choropleth.js';
import {request,clearCache,units,SourceError} from '../site/js/api.js';
import {FILTERS,PROFILE_IDS,HH_INCOME5} from '../site/js/census.js';

test('squarified tiles cover the rectangle with areas proportional to the values',()=>{
  const v=[50,20,12,9,5,3,1],W=600,H=400,r=squarify(v,0,0,W,H),total=v.reduce((a,b)=>a+b,0);
  r.forEach((x,i)=>assert.ok(Math.abs(x.w*x.h-v[i]/total*W*H)<1e-6));
  for(const x of r){assert.ok(x.x>=-1e-9&&x.y>=-1e-9&&x.x+x.w<=W+1e-9&&x.y+x.h<=H+1e-9);}
  for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],b=r[j];
    const overlap=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));assert.ok(overlap<1e-6);}
  assert.deepEqual(squarify([],0,0,10,10),[]);
});
test('nice ticks cover the range with 1, 2 or 5 times a power of ten',()=>{
  for(const [lo,hi] of [[0,39876],[0,0.73],[-12,31],[3,3]]){const t=niceTicks(lo,hi);
    assert.ok(t[0]<=lo&&t.at(-1)>=hi);const step=t[1]-t[0],e=10**Math.floor(Math.log10(step));assert.ok([1,2,5,10].some(k=>Math.abs(step/e-k)<1e-9));}
});
test('every Census 2021 DGUID schema used by the profile maps to its geography level',()=>{
  assert.equal(geographyType('2021A000011124'),'PR');assert.equal(geographyType('2021A000246'),'PR');
  assert.equal(geographyType('2021A00034611'),'CD');assert.equal(geographyType('2021A00054611040'),'CSD');
  assert.equal(geographyType('2021S0503602'),'CMACA');assert.equal(geographyType('2021S0504610'),'CMACA');
  assert.equal(geographyType('2021S050535505'),'CMACA');assert.equal(geographyType('2021S05004650'),'ER');assert.equal(geographyType('2021S05100011'),'POPCNTR');
  assert.equal(geographyType('2021Z9999999'),null);
});
test('boundary layers keyed by provincial part are queried by unit code, others by DGUID',()=>{
  assert.equal(boundaryWhere({id:'2021S0503602',type:'CMACA'}),"CMAUID='602'");
  assert.equal(boundaryWhere({id:'2021S050535505',type:'CMACA'}),"CMAPUID='35505'");
  assert.equal(boundaryWhere({id:'2021S05100011',type:'POPCNTR'}),"PCUID='0011'");
  assert.equal(boundaryWhere({id:'2021A00054611040',type:'CSD'}),"DGUID='2021A00054611040'");
  assert.equal(boundaryWhere({id:'2021A000011124',type:'PR'}),'1=1');
});
test('shared URLs round-trip; malformed values fall back; a new geography drops area selections',()=>{
  const s=parse('?geo=2021S0504610&lg=rail&lgf=YWG&li=traded&cp=household&mkr=2-5&bench=PT','#largest');
  assert.equal(s.geo.type,'CMACA');assert.equal(s.section,'largest');
  assert.equal(parse(serialize(s).split('#')[0],'#largest').t.li,'traded');
  assert.deepEqual(parse(serialize(s).split('#')[0]).t,s.t);
  const bad=parse('?geo=../etc&lg=boats&cp=<script>&mkr=1;drop');
  assert.equal(bad.geo.id,'2021A000011124');assert.equal(bad.t.lg,'air');assert.equal(bad.t.cp,'economic');assert.equal(bad.t.mkr,'');
  const moved=withGeography(s,{id:'2021A000246',type:'PR'});
  assert.equal(moved.t.lgf,'');assert.equal(moved.t.li,'traded');assert.equal(moved.t.lg,'rail');
  assert.equal(serialize(parse('')),'');
});
test('filter selections keep a contiguous interval for ordered bins and any subset for categories',()=>{
  const income=FILTERS.consumers.maps.income,type=FILTERS.consumers.maps.hhtype;
  assert.deepEqual(parseSelection(income,'',12).flatMap((v,i)=>v?[i]:[]),[3,4,5,6]);
  assert.deepEqual(parseSelection(income,'7-2',12).flatMap((v,i)=>v?[i]:[]),[2,3,4,5,6,7]);
  assert.equal(serializeSelection(income,parseSelection(income,'2-7',12)),'2-7');
  const none=serializeSelection(type,Array(8).fill(false));assert.equal(parseSelection(type,none,8).some(Boolean),false);
  assert.deepEqual(parseSelection(type,'0.3.7',8).flatMap((v,i)=>v?[i]:[]),[0,3,7]);
  assert.equal(income.text(income.bins[3],income.bins[6]),'$30,000 - $70,000');
});
test('every exhibit characteristic is requested, and grouped bands use only published components',()=>{
  const ids=new Set(PROFILE_IDS);for(const [,parts] of HH_INCOME5.groups)for(const p of parts)assert.ok(ids.has(p));
  for(const g of Object.values(FILTERS))for(const m of Object.values(g.maps)){if(m.total)assert.ok(ids.has(m.total));for(const b of m.bins??[])assert.ok(ids.has(b.id));}
});
test('number formats follow the reference style and label colours keep contrast',()=>{
  assert.equal(compact(1517379),'1.5M');assert.equal(compact(97040,'$'),'$97.0K');assert.equal(compact(942),'942');
  const r=ramp(['#000000','#ffffff'],3);assert.deepEqual(r,['#000000','#808080','#ffffff']);
  assert.ok(luminance('#473729')<.3&&luminance('#f1e9e2')>.3);
});
test('traded share is exactly one half for evenly split codes (classified traded under the at-least-half rule)',()=>{
  assert.equal(tradedShare('1111',['111110','111120'],['111110']),.5);
});

// ---------- network behaviour with a substituted fetch ----------
const realFetch=globalThis.fetch;
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('retries race parallel copies and settle on the first success',async()=>{
  clearCache();let n=0;
  globalThis.fetch=async()=>{n++;if(n<=2)throw new TypeError('Failed to fetch');return reply(200,{ok:n});};
  try {const d=await request('https://example.test/flaky',{attempts:3,race:3,backoff:1});assert.ok(d.ok>=3);}
  finally {globalThis.fetch=realFetch;}
});
test('permanent failures are not retried and keep their kind; failed requests can be retried later',async()=>{
  clearCache();let n=0;
  globalThis.fetch=async()=>{n++;return reply(404,{});};
  try {await assert.rejects(request('https://example.test/missing',{attempts:4,backoff:1}),e=>e instanceof SourceError&&e.kind==='unsupported');assert.equal(n,1);
    globalThis.fetch=async()=>reply(200,{fine:true});
    assert.deepEqual(await request('https://example.test/missing',{attempts:4,backoff:1}),{fine:true});}
  finally {globalThis.fetch=realFetch;}
});
test('an error payload with HTTP 200 is a malformed response, not data',async()=>{
  clearCache();globalThis.fetch=async()=>reply(200,{error:{message:'Invalid query'}});
  try {await assert.rejects(request('https://example.test/arcgis',{attempts:2,backoff:1}),e=>e.kind==='malformed');}
  finally {globalThis.fetch=realFetch;}
});
test('series published in thousands are scaled by their unit of measure',async()=>{
  clearCache();globalThis.fetch=async()=>reply(200,{object:{uom:[{memberUomCode:428,memberUomEn:'Persons in thousands'},{memberUomCode:239,memberUomEn:'Percent'}]}});
  try {assert.deepEqual(await units([{memberUomCode:null},{memberUomCode:428}]),{unit:'Persons in thousands',scale:1000});
    assert.equal((await units([{memberUomCode:239}])).scale,1);assert.equal((await units([{}])).scale,1);}
  finally {globalThis.fetch=realFetch;}
});
