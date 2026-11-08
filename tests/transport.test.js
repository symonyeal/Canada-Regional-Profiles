import test from 'node:test';
import assert from 'node:assert/strict';
import {points} from '../site/js/api.js';
import {memoRequest,request,clearCache,SourceError,journal} from '../site/js/transport.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('semantic rejection is evicted and decoder contracts are isolated',async()=>{
  const real=globalThis.fetch;clearCache();let calls=0;
  globalThis.fetch=async()=>new Response(JSON.stringify(++calls===1?{}:{value:7}));
  const options={contract:'value-v1',decode:d=>{if(!Number.isFinite(d.value))throw new SourceError('malformed','Missing value');return d.value;}};
  try {
    await assert.rejects(request('https://example.test/admit',options),{kind:'malformed'});
    assert.equal(await request('https://example.test/admit',options),7);
    assert.deepEqual(await request('https://example.test/admit'),{value:7});
    assert.equal(calls,3);
  } finally {globalThis.fetch=real;clearCache();}
});

test('one cancelled consumer preserves a shared read; the last consumer cancels it',async()=>{
  const real=globalThis.fetch;clearCache();let calls=0,aborts=0,finish;
  globalThis.fetch=(_,options)=>{calls++;return new Promise((resolve,reject)=>{
    finish=()=>resolve(new Response('{"value":7}'));
    options.signal.addEventListener('abort',()=>{aborts++;reject(new DOMException('cancel','AbortError'));},{once:true});
  });};
  try {
    const a=new AbortController(),b=new AbortController();
    const first=request('https://example.test/shared',{signal:a.signal}),second=request('https://example.test/shared',{signal:b.signal});
    await tick();a.abort();await assert.rejects(first,{name:'AbortError'});
    assert.equal(calls,1);assert.equal(aborts,0);finish();assert.deepEqual(await second,{value:7});
    const c=new AbortController(),last=request('https://example.test/last',{signal:c.signal});
    await tick();c.abort();await assert.rejects(last,{name:'AbortError'});await tick();assert.equal(aborts,1);
  } finally {globalThis.fetch=real;clearCache();}
});

test('all physical OECD reads share two permits, including hedges and queued cancellation',async()=>{
  const real=globalThis.fetch;clearCache();let active=0,peak=0,calls=0;
  const finish=[];
  globalThis.fetch=(_,options)=>new Promise((resolve,reject)=>{
    active++;calls++;peak=Math.max(peak,active);let done=false;
    const complete=(fn,value)=>{if(done)return;done=true;active--;fn(value);};
    finish.push(()=>complete(resolve,new Response('{}')));
    options.signal.addEventListener('abort',()=>complete(reject,new DOMException('cancel','AbortError')),{once:true});
  });
  try {
    const stop=new AbortController();
    const reads=Array.from({length:4},(_,i)=>request(`https://sdmx.oecd.org/${i}`,{hedge:1,signal:stop.signal}));
    const outcome=Promise.allSettled(reads);
    await new Promise(resolve=>setTimeout(resolve,15));assert.equal(calls,2);assert.equal(peak,2);
    stop.abort();assert.ok((await outcome).every(r=>r.status==='rejected'&&r.reason.name==='AbortError'));
    await tick();assert.equal(active,0);assert.equal(calls,2);
    const next=request('https://sdmx.oecd.org/new',{hedge:0});await tick();finish.at(-1)();await next;
    assert.equal(peak,2);
  } finally {globalThis.fetch=real;clearCache();}
});

test('fulfilled cache and request journal are bounded',async()=>{
  const real=globalThis.fetch;clearCache();let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('{}');};
  try {
    for(let i=0;i<300;i++)await request(`https://example.test/bounded/${i}`);
    assert.ok(journal.length<=256);
    await request('https://example.test/bounded/299');assert.equal(calls,300);
    await request('https://example.test/bounded/0');assert.equal(calls,301);
  } finally {globalThis.fetch=real;clearCache();}
});

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
    [null,'','..','x',0,2].map((value,i)=>({refPer:String(2020+i),value,scalarFactorCode:3}))}}]));
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
