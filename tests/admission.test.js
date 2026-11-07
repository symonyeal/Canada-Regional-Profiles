import test from 'node:test';
import assert from 'node:assert/strict';
import {census,censusMany,decodeSDMX,trendSeries} from '../site/js/api.js';
import {CANADA,Profile} from '../site/js/model.js';
import {clearCache,SourceError} from '../site/js/transport.js';
import {sourceRows} from '../site/js/ui.js';

const MB={id:'2021A000246',type:'PR',name:'Manitoba'};
const fixture=(areas=[CANADA],times=['2021'])=>({data:{structure:{dimensions:{series:[
  {id:'REF_AREA',values:areas},{id:'CHARACTERISTIC',values:[{id:'1',name:'Population'}]},
  {id:'GENDER',values:[{id:'1'}]},{id:'STATISTIC',values:[{id:'1'}]}
],observation:[{id:'TIME_PERIOD',values:times.map(id=>({id}))}]}},dataSets:[{series:{'0:0:0:0':{observations:{0:[123]}}}}]}});
const malformed=e=>e instanceof SourceError&&e.kind==='malformed';

test('SDMX rejects malformed coordinates at the source boundary',()=>{
  for(const key of ['0:0:0','0:99:0:0','0:-1:0:0','0:0.5:0:0','0::0:0']){
    const m=fixture();m.data.dataSets[0].series={[key]:{observations:{0:[123]}}};
    assert.throws(()=>decodeSDMX(m),malformed,key);
  }
  const m=fixture();m.data.dataSets[0].series['0:0:0:0'].observations[0]=null;
  assert.throws(()=>decodeSDMX(m),malformed);
});

test('SDMX rejects repeated complete observation keys and preserves suppression',()=>{
  const m=fixture();m.data.dataSets.push(structuredClone(m.data.dataSets[0]));
  assert.throws(()=>decodeSDMX(m),malformed);
  const x=fixture();x.data.dataSets[0].series['0:0:0:0'].observations[0]=['x'];
  assert.equal(decodeSDMX(x)[0].value,null);
});

test('malformed SDMX containers and attributes retain their source error classification',()=>{
  for(const mutate of [m=>{m.data.dataSets=[null];},m=>{m.data.dataSets[0].series=[];},
    m=>{m.data.structure.attributes={series:{}};},m=>{m.data.dataSets[0].series['0:0:0:0'].observations=[];}]){
    const m=fixture();mutate(m);assert.throws(()=>decodeSDMX(m),malformed);
  }
});

test('a Profile owns one geography, one period and unique observation keys',()=>{
  const row=decodeSDMX(fixture())[0];
  assert.throws(()=>new Profile([row,{...row,time:'2020'}]),/period/i);
  assert.throws(()=>new Profile([row,{...row,area:MB}]),/geograph/i);
  assert.throws(()=>new Profile([row,{...row}]),/duplicate/i);
  assert.equal(new Profile([]).rows.length,0);
  const p=new Profile([row]);row.value=999;
  assert.equal(p.rows[0].value,123);
  assert.equal(p.value('1'),123);
});

test('Census admission rejects another requested geography and retry fetches again',async()=>{
  const real=globalThis.fetch;clearCache();let calls=0;
  globalThis.fetch=async()=>new Response(JSON.stringify(fixture(++calls===1?[MB]:[CANADA])));
  try {
    await assert.rejects(census(CANADA),malformed);
    assert.equal((await census(CANADA)).area.id,CANADA.id);
    assert.equal(calls,2);
  } finally {globalThis.fetch=real;clearCache();}
});

test('a successful HTTP response with invalid SDMX is not a reusable cache entry',async()=>{
  const real=globalThis.fetch;clearCache();let calls=0;
  globalThis.fetch=async()=>new Response(JSON.stringify(++calls===1?{}:fixture()));
  try {
    await assert.rejects(census(CANADA),malformed);
    assert.equal((await census(CANADA)).value('1'),123);
    assert.equal(calls,2);
  } finally {globalThis.fetch=real;clearCache();}
});

test('Census admission rejects an unexpected period',async()=>{
  const real=globalThis.fetch;clearCache();
  globalThis.fetch=async()=>new Response(JSON.stringify(fixture([CANADA],['2020'])));
  try {await assert.rejects(census(CANADA),malformed);}
  finally {globalThis.fetch=real;clearCache();}
});

test('multi-area Census admits missing areas but rejects unsolicited areas',async()=>{
  const real=globalThis.fetch;clearCache();
  globalThis.fetch=async()=>new Response(JSON.stringify(fixture([CANADA])));
  try {
    const p=await censusMany('PR',[CANADA.id,MB.id,CANADA.id],['1',1]);
    assert.equal(p.size,2);assert.equal(p.get(MB.id).rows.length,0);
    clearCache();globalThis.fetch=async()=>new Response(JSON.stringify(fixture([MB])));
    await assert.rejects(censusMany('PR',[CANADA.id],['1']),malformed);
  } finally {globalThis.fetch=real;clearCache();}
});

test('derived annual series retain both operands, their quality and transformation',async()=>{
  const real=globalThis.fetch;clearCache();
  globalThis.fetch=async(url,opts)=>{
    let data;
    if(url.endsWith('getCubeMetadata')){
      const pid=JSON.parse(opts.body)[0].productId;
      data=[{status:'SUCCESS',object:{productId:pid,cubeTitleEn:pid==='1'?'Numerator':'Denominator',
        cubeStartDate:'2020-01-01',cubeEndDate:'2021-01-01',dimension:[{dimensionNameEn:'Geography',member:[{memberId:1,classificationCode:'46',memberNameEn:MB.name}]}]}}];
    } else data=JSON.parse(opts.body).map(x=>({status:'SUCCESS',object:{coordinate:x.coordinate,vectorDataPoint:[
      {refPer:'2020',value:x.productId==='1'?10:100,statusCode:1},
      {refPer:'2021',value:x.productId==='1'?20:0,statusCode:2}
    ]}}));
    return new Response(JSON.stringify(data));
  };
  try {
    const m={id:'share',unit:'%',source:{PR:[{x:['1',{}],n:['2',{}]}]}};
    const s=(await trendSeries(m,[MB])).get(MB.id);
    assert.deepEqual(s.values.map(x=>x.value),[10,null]);
    assert.deepEqual(s.sources.map(x=>x.role),['numerator','denominator']);
    assert.ok(s.sources[0].source.includes('Numerator'));assert.ok(s.sources[1].source.includes('Denominator'));
    assert.equal(s.sources[0].geography,MB.id);assert.equal(s.sources[1].geography,MB.id);
    assert.equal(s.transformation.formula,'100*x/n');
    assert.equal(s.values[0].operands.numerator.statusCode,1);
    assert.equal(s.values[1].operands.denominator.value,0);
    const receipt=sourceRows({...s,geo:MB.name,period:'2020–2021'});
    assert.deepEqual(receipt.filter(r=>['Numerator','Denominator'].includes(r[0])).map(r=>r[0]),['Numerator','Denominator']);
    assert.ok(receipt.some(([k,v])=>k==='Calculation'&&v==='100*x/n'));
  } finally {globalThis.fetch=real;clearCache();}
});
