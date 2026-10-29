import test from 'node:test';
import assert from 'node:assert/strict';
import {memoRequest,request,clearCache,points} from '../site/js/api.js';

test('a rejected request from before Refresh cannot evict its replacement',async()=>{
  const store=new Map();let reject;
  const old=memoRequest(store,'area',()=>new Promise((_,no)=>{reject=no;}));
  await Promise.resolve();store.clear();
  const current=memoRequest(store,'area',()=>42);
  reject(Error('old request failed'));await assert.rejects(old);
  assert.equal(store.get('area'),current);
  assert.equal(await memoRequest(store,'area',()=>99),42);
});

test('WDS empty and suppression markers remain missing after scaling',async()=>{
  const real=globalThis.fetch;clearCache();
  globalThis.fetch=async()=>new Response(JSON.stringify([{status:'SUCCESS',object:{coordinate:'1',vectorDataPoint:
    [null,'','..','x',0,2].map(value=>({value,scalarFactorCode:3}))}}]));
  try {
    assert.deepEqual((await points('14100202',['1'])).get('1').map(p=>p.value),[null,null,null,null,0,2000]);
  } finally {globalThis.fetch=real;clearCache();}
});

test('text and JSON decoding of the same endpoint have separate cache entries',async()=>{
  const real=globalThis.fetch;clearCache();let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('{"value":7}');};
  try {
    assert.equal(await request('https://example.test/data',{parse:'text'}),'{"value":7}');
    assert.deepEqual(await request('https://example.test/data'),{value:7});
    assert.equal(calls,2);
  } finally {globalThis.fetch=real;clearCache();}
});
