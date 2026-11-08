// Shared request policy: caching, concurrency, retries and hedged reads. No source-specific decoding.
// kind: unsupported | empty | malformed | rate | network | timeout | server. Only the last four are retried.
export class SourceError extends Error {
  constructor(kind,message,url) {super(message);this.kind=kind;this.url=url;}
  get transient() {return ['rate','network','timeout','server'].includes(this.kind);}
}
export const MESSAGES={
  unsupported:'This source does not publish the selected geography or series.',
  empty:'The source returned no observations for this selection.',
  malformed:'The source returned a response that could not be read.',
  rate:'The source is limiting requests. Try again shortly.',
  network:'The source could not be reached. A network block or cross-origin refusal ends the same way in a browser.',
  timeout:'The source did not answer in time.',
  server:'The source reported an internal error.',
};

const cache=new Map();
export const journal=[];
const CACHE_LIMIT=128,CACHE_AGE=5*60*1000,JOURNAL_LIMIT=256;
function record(entry) {journal.push(entry);if(journal.length>JOURNAL_LIMIT)journal.splice(0,journal.length-JOURNAL_LIMIT);}
export function memoRequest(store,key,fn) {
  if(!store.has(key)) {
    const p=Promise.resolve().then(fn).catch(e=>{if(store.get(key)===p)store.delete(key);throw e;});
    store.set(key,p);
  }
  return store.get(key);
}
export function clearCache() {cache.clear();}

// Physical exchanges, including every hedge and race copy, share one host budget.
const lanes=new Map();
const budget=host=>host==='sdmx.oecd.org'?2:6;
const aborted=()=>new DOMException('Request consumer cancelled.','AbortError');
function check(signal) {if(signal?.aborted)throw aborted();}
async function lane(url,fn,signal) {
  const host=new URL(url,globalThis.location?.href??'http://localhost/').host;
  const s=lanes.get(host)??lanes.set(host,{active:0,queue:[]}).get(host);
  check(signal);
  await new Promise((resolve,reject)=>{
    const item={grant:()=>{signal?.removeEventListener('abort',cancel);s.active++;resolve();}};
    const cancel=()=>{const i=s.queue.indexOf(item);if(i>=0)s.queue.splice(i,1);reject(aborted());};
    if(s.active<budget(host)&&!s.queue.length)item.grant();
    else {s.queue.push(item);signal?.addEventListener('abort',cancel,{once:true});}
  });
  try {check(signal);return await fn();} finally {
    s.active--;s.queue.shift()?.grant();
    if(!s.active&&!s.queue.length)lanes.delete(host);
  }
}
const pause=(ms,signal)=>new Promise((resolve,reject)=>{
  check(signal);
  const cancel=()=>{clearTimeout(timer);reject(aborted());};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},ms);
  signal?.addEventListener('abort',cancel,{once:true});
});

// One HTTP exchange, classified. Resolves with parsed data or throws a SourceError.
async function exchange(url,{body,accept,timeout,parse,attempt,signal,cache='no-store'}) {
  const form=body instanceof URLSearchParams,start=performance.now();
  let r;
  try {
    r=await fetch(url,{method:body?'POST':'GET',cache,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),
      headers:{Accept:accept,...(body&&!form?{'Content-Type':'application/json'}:{})},body:form?body:body?JSON.stringify(body):undefined});
  } catch(e) {
    if(signal?.aborted)throw aborted();
    const err=e?.name==='TimeoutError'?new SourceError('timeout',MESSAGES.timeout,url):new SourceError('network',MESSAGES.network,url);
    record({url,status:err.kind,ms:Math.round(performance.now()-start),at:new Date().toISOString(),attempt});
    throw err;
  }
  record({url,status:r.status,ms:Math.round(performance.now()-start),at:new Date().toISOString(),attempt});
  if(r.status===404) throw new SourceError('unsupported',MESSAGES.unsupported,url);
  if(r.status===400) throw new SourceError('malformed','The source rejected the request.',url);
  if(r.status===429) {const e=new SourceError('rate',MESSAGES.rate,url);e.wait=Math.min(8000,1000*(Number(r.headers.get('Retry-After'))||attempt*2));throw e;}
  if(r.status>=500) throw new SourceError('server',MESSAGES.server,url);
  if(!r.ok) throw new SourceError('unsupported',`${MESSAGES.unsupported} (HTTP ${r.status})`,url);
  const text=await r.text();
  if(parse==='text') return text;
  let data;try {data=JSON.parse(text);} catch {throw new SourceError('malformed',MESSAGES.malformed,url);}
  if(data?.error) throw new SourceError('malformed',data.error.message??MESSAGES.malformed,url);
  return data;
}

// Hedged exchange (Dean and Barroso 2013, "The tail at scale"): when the first copy has not answered after
// `hedge` ms, a second copy is sent and the first answer kept. Statistics Canada's services answer most reads
// in about a second but leave some connections hanging for 20 to 35 s. The exchange fails when every copy sent
// has failed; a first copy failing before the delay is not hedged (the retry loop handles it).
function hedged(run,hedge) {
  if(!hedge) return run();
  const stop=new AbortController();
  return new Promise((resolve,reject)=>{
    let live=0,failure=null,t=null;
    const go=()=>{live++;run(stop.signal).then(v=>{clearTimeout(t);stop.abort();resolve(v);},
      e=>{failure??=e;if(--live===0){clearTimeout(t);reject(failure);}});};
    go();t=setTimeout(()=>{if(live>0)go();},hedge);
  });
}
const STATCAN=/statcan\.gc\.ca\//;
const HEDGE=url=>STATCAN.test(url)?6000:0;
// Statistics Canada's WDS has refused every connection for about 15 s after heavy use (2026-10-25); seven attempts
// wait 20 to 28 s in all before failing. Other hosts keep four attempts.
const ATTEMPTS=url=>STATCAN.test(url)?7:4;

// A request with bounded retries; transient failures only. body: JSON (POST JSON) or URLSearchParams (POST form).
// Waits between attempts double from `backoff` with full jitter, each at most 8 s, to ride out bursts of refused connections.
// race > 1 sends that many parallel copies on each retry and keeps the first answer: for a server whose
// connections fail independently, new connections are what a retry needs.
export function request(url,{body,accept='application/json',attempts=ATTEMPTS(url),timeout=45000,parse='json',backoff=400,race=1,cache:mode,hedge=HEDGE(url),decode,contract='raw-v1',signal}={}) {
  if(decode&&contract==='raw-v1')throw Error('A semantic decoder needs an explicit cache contract.');
  if(signal?.aborted)return Promise.reject(aborted());
  const form=body instanceof URLSearchParams,key=JSON.stringify([url,form?'form':'json',form?body.toString():body??null,accept,parse,contract]);
  const now=Date.now();
  for(const [k,e] of cache)if(e.settled&&now-e.at>CACHE_AGE)cache.delete(k);
  let entry=cache.get(key);
  if(!entry){
    entry={stop:new AbortController(),consumers:0,settled:false,at:now};
    const owner=entry;
    entry.promise=Promise.resolve().then(async()=>{
    let error;
    for(let attempt=1;attempt<=attempts;attempt++) {
      check(owner.stop.signal);
      const n=attempt>1?race:1,opts={body,accept,timeout,parse,attempt,cache:mode};
      try {
        let result;
        if(n===1)result=await hedged(copy=>{
          const signal=copy?AbortSignal.any([owner.stop.signal,copy]):owner.stop.signal;
          return lane(url,()=>exchange(url,{...opts,signal}),signal);
        },hedge);
        else {
          const stop=new AbortController(),signal=AbortSignal.any([owner.stop.signal,stop.signal]);
          try {result=await Promise.any(Array.from({length:n},()=>lane(url,()=>exchange(url,{...opts,signal}),signal)));}
          finally {stop.abort();}
        }
        check(owner.stop.signal);
        // Admission is part of the shared promise: rejected HTTP-200 data is never cached.
        try {return decode?await decode(result):result;}
        catch(e){throw e instanceof SourceError?e:new SourceError('malformed',e.message??MESSAGES.malformed,url);}
      } catch(e) {
        check(owner.stop.signal);
        error=e instanceof AggregateError?e.errors.find(x=>x.kind!=='network')??e.errors[0]:e;
        if(!(error instanceof SourceError))error=new SourceError('network',MESSAGES.network,url);
        if(!error.transient) break;
        if(attempt<attempts) await pause(error.wait??Math.min(8000,backoff*2**(attempt-1)*(1+Math.random())),owner.stop.signal);
      }
    }
    throw error;
    });
    cache.set(key,entry);
    entry.promise.then(()=>{
      owner.settled=true;owner.at=Date.now();
      for(const [k,e] of cache){if(cache.size<=CACHE_LIMIT)break;if(e.settled)cache.delete(k);}
    },()=>{owner.settled=true;if(cache.get(key)===owner)cache.delete(key);});
  } else {cache.delete(key);cache.set(key,entry);}
  // Each caller owns a lease. One cancellation cannot abort another caller's read.
  const owner=entry;owner.consumers++;
  return new Promise((resolve,reject)=>{
    let done=false;
    const release=()=>{
      if(done)return false;done=true;signal?.removeEventListener('abort',cancel);
      if(--owner.consumers===0&&!owner.settled){
        if(cache.get(key)===owner)cache.delete(key);
        owner.stop.abort();
      }
      return true;
    };
    const cancel=()=>{if(release())reject(aborted());};
    signal?.addEventListener('abort',cancel,{once:true});
    owner.promise.then(v=>{if(release())resolve(v);},e=>{if(release())reject(e);});
  });
}
