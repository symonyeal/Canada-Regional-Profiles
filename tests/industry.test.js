import test from 'node:test';
import assert from 'node:assert/strict';
import {clearCache,coord} from '../site/js/api.js';
import {industryCache} from '../site/js/tools/industries.js';
import {businessMatrix,businessIndustry,clearBusiness} from '../site/js/tools/business.js';

test('an omitted business series is zero only when its published classified total is zero',()=>{
  const matched=[1,2,3].map(i=>({g:{id:String(i),name:`Area ${i}`},mem:{memberId:i}}));
  const points=new Map([1,2,3].map((i,j)=>[coord([i,1,1]),[{value:[10,0,12][j]}]]));
  points.set(coord([3,1,2]),[{value:5}]);
  assert.deepEqual([...businessMatrix(matched,points,2,1).values()].map(r=>r.values[0]),[null,0,5]);
});

test('business-count specialization requires complete denominators',async()=>{
  const real=globalThis.fetch;clearCache();clearBusiness();
  const t={productId:1,cubeTitleEn:'Canadian Business Counts, with employees, June 2026',releaseTime:'2026-08-01'};
  const m={dimension:[
    {member:[{memberId:1,classificationCode:'46'},{memberId:2,classificationCode:'11124'}]},
    {member:[{memberId:1},...Array.from({length:8},(_,i)=>({memberId:i+2,parentMemberId:1,memberNameEn:String(i)}))]},
    {member:[{memberId:1,classificationCode:'3'},
      {memberId:2,classificationCode:'1111',memberNameEn:'Published'},
      {memberId:3,classificationCode:'2222',memberNameEn:'Suppressed'}]}
  ]};
  globalThis.fetch=async(url,opts)=>{
    let value;
    if(url.endsWith('getAllCubesListLite'))value=[t];
    else if(url.endsWith('getCubeMetadata'))value=[{status:'SUCCESS',object:m}];
    else value=JSON.parse(opts.body).map(x=>{
      const [g,s,i]=x.coordinate.split('.').map(Number);
      return {status:'SUCCESS',object:{coordinate:x.coordinate,vectorDataPoint:[
        {value:s!==1?null:g===1?(i===2?20:null):i===2?100:900}
      ]}};
    });
    return new Response(JSON.stringify(value));
  };
  try {
    const d=await businessIndustry({id:'2021A000246',type:'PR',name:'Manitoba'},'1111');
    assert.equal(d.current,20);assert.equal(d.lq,null);
  } finally {globalThis.fetch=real;clearCache();clearBusiness();}
});

test('suppressed industry rows cannot create a partial LQ denominator when the total is missing',async()=>{
  const real=globalThis.fetch;clearCache();industryCache.clear();
  const m={productId:'14100202',cubeEndDate:'2025-01-01',dimension:[
    {member:[{memberId:1,classificationCode:'46'},{memberId:2,classificationCode:'11124'}]},
    {member:[{memberId:1,memberNameEn:'All employees'}]},
    {member:[{memberId:1,classificationCode:'00-91N'},
      {memberId:2,classificationCode:'1111',memberNameEn:'Published'},
      {memberId:3,classificationCode:'2222',memberNameEn:'Suppressed'}]}
  ]};
  globalThis.fetch=async(url,opts)=>{
    let value;
    if(url==='classification.json')value={codes:[],traded:[]};
    else if(url.endsWith('getCubeMetadata'))value=[{status:'SUCCESS',object:m}];
    else value=JSON.parse(opts.body).map(x=>{
      const [g,,i]=x.coordinate.split('.').map(Number);
      return {status:'SUCCESS',object:{coordinate:x.coordinate,vectorDataPoint:[
        {refPer:'2025',value:g===1?(i===2?20:null):i===1?1000:100}
      ]}};
    });
    return new Response(JSON.stringify(value));
  };
  try {
    const d=await industryCache.data({id:'2021A000246',type:'PR'});
    assert.equal(d.rows.length,1);assert.equal(d.suppressed,1);
    assert.equal(d.rows[0].value,20);assert.equal(d.rows[0].lq,null);
  } finally {globalThis.fetch=real;clearCache();industryCache.clear();}
});
