// Runtime public sources. Completed and in-flight requests share an in-memory cache; failures are evicted.
import {numeric,Profile,CANADA,reconcileCounts,estimate} from './model.js';
import {PROFILE_IDS} from './census.js';

export const CENSUS='https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest';
export const WDS='https://www150.statcan.gc.ca/t1/wds/rest';
export const table=pid=>`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${String(pid).slice(0,8)}01`;
const SDMX='application/vnd.sdmx.data+json;version=1.0';

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
export function memoRequest(store,key,fn) {
  if(!store.has(key)) store.set(key,Promise.resolve().then(fn).catch(e=>{store.delete(key);throw e;}));
  return store.get(key);
}
export function clearCache() {cache.clear();}

// At most `limit` requests run per host; the rest queue in arrival order.
const lanes=new Map();
async function lane(url,fn,limit) {
  const host=new URL(url,globalThis.location?.href??'http://localhost/').host;
  limit??=host.includes('overpass')||host.includes('valhalla')?1:host.includes('wikidata')?2:6;
  const s=lanes.get(host)??lanes.set(host,{active:0,queue:[]}).get(host);
  if(s.active>=limit) await new Promise(r=>s.queue.push(r));
  s.active++;
  try {return await fn();} finally {s.active--;s.queue.shift()?.();}
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));

// One HTTP exchange, classified. Resolves with parsed data or throws a SourceError.
async function exchange(url,{body,accept,timeout,parse,attempt,signal}) {
  const form=body instanceof URLSearchParams,start=performance.now();
  let r;
  try {
    r=await fetch(url,{method:body?'POST':'GET',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),
      headers:{Accept:accept,...(body&&!form?{'Content-Type':'application/json'}:{})},body:form?body:body?JSON.stringify(body):undefined});
  } catch(e) {
    const err=e?.name==='TimeoutError'?new SourceError('timeout',MESSAGES.timeout,url):e?.name==='AbortError'?new SourceError('network','Superseded by a parallel attempt.',url):new SourceError('network',MESSAGES.network,url);
    if(e?.name!=='AbortError')journal.push({url,status:err.kind,ms:Math.round(performance.now()-start),at:new Date().toISOString(),attempt});
    throw err;
  }
  journal.push({url,status:r.status,ms:Math.round(performance.now()-start),at:new Date().toISOString(),attempt});
  if(r.status===404||r.status===400) throw new SourceError('unsupported',MESSAGES.unsupported,url);
  if(r.status===429) {const e=new SourceError('rate',MESSAGES.rate,url);e.wait=Math.min(8000,1000*(Number(r.headers.get('Retry-After'))||attempt*2));throw e;}
  if(r.status>=500) throw new SourceError('server',MESSAGES.server,url);
  if(!r.ok) throw new SourceError('unsupported',`${MESSAGES.unsupported} (HTTP ${r.status})`,url);
  const text=await r.text();
  if(parse==='text') return text;
  let data;try {data=JSON.parse(text);} catch {throw new SourceError('malformed',MESSAGES.malformed,url);}
  if(data?.error) throw new SourceError('malformed',data.error.message??MESSAGES.malformed,url);
  return data;
}

// A request with bounded retries; transient failures only. body: JSON (POST JSON) or URLSearchParams (POST form).
// race > 1 sends that many parallel copies on each retry and keeps the first answer: for a server whose
// connections fail independently, new connections are what a retry needs.
export function request(url,{body,accept='application/json',attempts=3,timeout=45000,parse='json',backoff=350,race=1,limit}={}) {
  const form=body instanceof URLSearchParams,key=`${url}|${form?body.toString():JSON.stringify(body??null)}|${accept}`;
  return memoRequest(cache,key,async()=>{
    let error;
    for(let attempt=1;attempt<=attempts;attempt++) {
      const n=attempt>1?race:1;
      try {
        if(n===1) return await lane(url,()=>exchange(url,{body,accept,timeout,parse,attempt}),limit);
        const stop=new AbortController();
        const result=await Promise.any(Array.from({length:n},()=>lane(url,()=>exchange(url,{body,accept,timeout,parse,attempt,signal:stop.signal}),limit==null?undefined:limit+n)));
        stop.abort();return result;
      } catch(e) {
        error=e instanceof AggregateError?e.errors.find(x=>x.kind!=='network')??e.errors[0]:e;
        if(!(error instanceof SourceError))error=new SourceError('network',MESSAGES.network,url);
        if(!error.transient) break;
        if(attempt<attempts) await pause(error.wait??backoff*attempt+Math.random()*backoff);
      }
    }
    throw error;
  });
}

// ---------- Census Profile SDMX ----------

function attributes(definitions,indices=[]) {
  return Object.fromEntries((definitions??[]).map((a,i)=>[a.id,a.values?.[indices[i]]]));
}
export function decodeSDMX(message) {
  const d=message?.data??message,s=d?.structure;
  if(!s?.dimensions||!d.dataSets?.length) throw new SourceError('malformed','Invalid SDMX response from the public source.');
  const dim=s.dimensions.series??[],obs=s.dimensions.observation??[],out=[];
  for(const dataset of d.dataSets) for(const [key,series] of Object.entries(dataset.series??{})) {
    const parts=key.split(':').map(Number),v=Object.fromEntries(dim.map((x,i)=>[x.id,x.values[parts[i]]]));
    const attr=attributes(s.attributes?.series,series.attributes);
    for(const [k,o] of Object.entries(series.observations??{})) {
      const oi=k.split(':').map(Number),od=Object.fromEntries(obs.map((x,i)=>[x.id,x.values[oi[i]]]));
      const oa=attributes(s.attributes?.observation,o.slice(1));
      out.push({area:v.REF_AREA,gender:v.GENDER,characteristic:v.CHARACTERISTIC,statistic:v.STATISTIC,
        value:numeric(o[0]),time:od.TIME_PERIOD?.id,topic:attr.TOPIC?.name,notes:attr.NOTE?.name,
        province:attr.PROV_TERR?.id,status:oa.OBS_STATUS?.name??oa.CONF_STATUS?.name??'',attributes:attr});
    }
  }
  if(!out.length) throw new SourceError('empty','No observations published for this selection.');
  return out;
}
const flow=type=>`DF_${type}`;
// The characteristics exhibits read (about 100 KB); full=true requests the whole published profile (about 1.2 MB).
export async function census(geo=CANADA,{full=false}={}) {
  const url=`${CENSUS}/data/${flow(geo.type)}/A5.${geo.id}.1.${full?'':PROFILE_IDS.join('+')}.1`;
  const p=new Profile(decodeSDMX(await request(url,{accept:SDMX})));p.url=url;return p;
}
// Selected characteristics for many areas of one type, 40 areas per request.
export async function censusMany(type,ids,chars) {
  const chunks=[];for(let i=0;i<ids.length;i+=40)chunks.push(ids.slice(i,i+40));
  const out=new Map(ids.map(id=>[id,[]]));
  await Promise.all(chunks.map(async c=>{
    let rows;
    try {rows=decodeSDMX(await request(`${CENSUS}/data/${flow(type)}/A5.${c.join('+')}.1.${chars.join('+')}.1`,{accept:SDMX}));}
    catch(e) {if(e.kind==='empty')return;throw e;}
    for(const r of rows)out.get(r.area.id)?.push(r);
  }));
  return new Map([...out].map(([id,rows])=>[id,new Profile(rows)]));
}
export async function geographies(type='CSD') {
  const rows=decodeSDMX(await request(`${CENSUS}/data/${flow(type)}/A5..1.1.1`,{accept:SDMX}));
  return rows.map(r=>({...r.area,type,population:r.value,province:r.province,
    municipalType:r.attributes.GEO_DESC?.name?.match(/, ([^,\[\]]+) \[Census subdivision\]/)?.[1]??'',
    description:r.attributes.GEO_DESC?.name??r.area.name}));
}

// ---------- Statistics Canada Web Data Service ----------

export async function metadata(pid) {
  const data=await request(`${WDS}/getCubeMetadata`,{body:[{productId:String(pid)}]});
  if(data?.[0]?.status!=='SUCCESS') throw new SourceError('unsupported','Table metadata is unavailable.');
  return data[0].object;
}
export const catalog=()=>request(`${WDS}/getAllCubesListLite`);
export function tablePair(tables,local=false) {
  const candidates=tables.filter(t=>/^Canadian Business Counts, with employees, /.test(t.cubeTitleEn)
    &&/census metropolitan areas and census subdivisions/.test(t.cubeTitleEn)===local
    &&/(?:June|December) \d{4}$/.test(t.cubeTitleEn)).sort((a,b)=>b.releaseTime.localeCompare(a.releaseTime));
  const current=candidates[0];if(!current) throw new SourceError('empty','No Business Counts tables found in the live catalogue.');
  const [,month,year]=current.cubeTitleEn.match(/(June|December) (\d{4})$/);
  const previous=candidates.find(t=>t.cubeTitleEn.endsWith(`${month} ${Number(year)-5}`))??null;
  return {current,previous};
}
// Classification codes, never names, join geographies. Canada is 11124 in most tables and 1124 in some.
export function geoMember(dimension,geo) {
  const code=geo.id===CANADA.id?['11124','1124']:[geo.id.slice(9)];
  return dimension.member.find(m=>code.includes(String(m.classificationCode)))??null;
}
export const coord=values=>values.concat(Array(Math.max(0,10-values.length)).fill(0)).join('.');
export async function points(pid,coordinates,latestN=1) {
  const chunks=[];for(let i=0;i<coordinates.length;i+=250)chunks.push(coordinates.slice(i,i+250));
  const results=await Promise.all(chunks.map(c=>request(`${WDS}/getDataFromCubePidCoordAndLatestNPeriods`,
    {body:c.map(coordinate=>({productId:String(pid),coordinate,latestN}))})));
  return new Map(results.flat().filter(r=>r.status==='SUCCESS'&&r.object).map(r=>{
    const o=r.object;return [o.coordinate,(o.vectorDataPoint??[]).map(p=>({...p,value:p.value==null?null:numeric(p.value)*10**(p.scalarFactorCode??0)}))];
  }));
}
// One annual series. selector: {dimension name: RegExp for the member}; other dimensions take their root member.
export async function annual(pid,geo,selector={},n=15) {
  const m=await metadata(pid),g=geoMember(m.dimension[0],geo);
  if(!g) throw new SourceError('unsupported','This table does not publish the selected geography.');
  const chosen=m.dimension.map((d,i)=>{if(i===0)return g;const re=selector[d.dimensionNameEn];
    const s=re?d.member.find(x=>re.test(x.memberNameEn)):d.member.find(x=>x.parentMemberId==null)??d.member[0];
    if(!s) throw new SourceError('unsupported',`The table does not publish the requested ${d.dimensionNameEn} category.`);return s;});
  const key=coord(chosen.map(x=>x.memberId)),[data,{scale,unit}]=await Promise.all([points(pid,[key],n),units(chosen)]);
  const values=(data.get(key)??[]).map(p=>({year:Number(p.refPer.slice(0,4)),refPer:p.refPer,value:p.value==null?null:p.value*scale}));
  return {metadata:m,geoName:g.memberNameEn,values,pid,unit};
}
// Data points report scalarFactorCode 0 for series published "in thousands"; the member's unit of measure says so.
const codeSets=()=>request(`${WDS}/getCodeSets`);
export async function units(members) {
  const code=members.map(m=>m.memberUomCode).filter(c=>c!=null).at(-1);if(code==null)return {scale:1,unit:''};
  const unit=(await codeSets()).object?.uom?.find(u=>u.memberUomCode===code)?.memberUomEn??'';
  return {unit,scale:/in thousands$|^Thousands of/i.test(unit)?1e3:/in millions$|^Millions of/i.test(unit)?1e6:1};
}

export async function seph(geo,level='4') {
  const m=await metadata('14100202'),[gd,ed,nd]=m.dimension,g=geoMember(gd,geo),ca=geoMember(gd,CANADA);
  if(!g) throw new SourceError('unsupported','SEPH industry employment is published for Canada, provinces and territories only.');
  const employee=ed.member.find(x=>x.memberNameEn==='All employees'),aggregate=nd.member.find(x=>x.classificationCode==='00-91N');
  const re=level==='2'?/^\d{2}(?:-\d{2})?$/:new RegExp(`^\\d{${level}}$`);
  const industries=nd.member.filter(x=>re.test(x.classificationCode??''));
  const year=Number(m.cubeEndDate.slice(0,4)),all=[aggregate,...industries];
  const keys=[...new Set([g.memberId,ca.memberId])].flatMap(gi=>all.map(n=>coord([gi,employee.memberId,n.memberId])));
  const data=await points(m.productId,keys,6);
  const get=(gi,n,y)=>data.get(coord([gi,employee.memberId,n.memberId]))?.find(p=>p.refPer.startsWith(String(y)))?.value??null;
  return {metadata:m,year,total:get(g.memberId,aggregate,year),nationalTotal:get(ca.memberId,aggregate,year),rows:industries.map(n=>({
    code:n.classificationCode,name:n.memberNameEn.replace(/ \[[\d-]+\]$/,''),memberId:n.memberId,
    value:get(g.memberId,n,year),previous:get(g.memberId,n,year-5),national:get(ca.memberId,n,year)}))};
}

export async function businessSlice(t,geo,level='4') {
  const m=await metadata(t.productId),[gd,sd,nd]=m.dimension,g=geoMember(gd,geo);
  if(!g) throw new SourceError('unsupported','Business Counts does not publish this geography in the selected release.');
  const re=level==='2'?/^\d{2}(?:-\d{2})?$/:new RegExp(`^\\d{${level}}$`);
  const industries=nd.member.filter(x=>re.test(x.classificationCode??'')),sizes=sd.member.filter(x=>x.parentMemberId!=null);
  const coords=industries.flatMap(n=>[coord([g.memberId,1,n.memberId]),...sizes.map(s=>coord([g.memberId,s.memberId,n.memberId]))]);
  const subtotal=nd.member.find(n=>n.classificationCode==='3');
  if(subtotal)coords.push(...sizes.map(s=>coord([g.memberId,s.memberId,subtotal.memberId])));
  const data=await points(t.productId,coords);
  const at=k=>data.get(k)?.at(-1)?.value??null;
  const rows=industries.map(n=>({code:n.classificationCode,name:n.memberNameEn.replace(/ \[[\d-]+\]$/,''),
    N:sizes.map(s=>at(coord([g.memberId,s.memberId,n.memberId]))),total:at(coord([g.memberId,1,n.memberId]))}));
  const subN=sizes.map(s=>subtotal?at(coord([g.memberId,s.memberId,subtotal.memberId])):null);
  return {rows:reconcileCounts(rows,subN),metadata:m,table:t,totalEstimate:estimate(subN),sizes:sizes.map(s=>s.memberNameEn)};
}

// Employer locations with employees, all industries, from each June national release (Canada and provinces only).
// Canada and provinces use the national tables; metropolitan areas and census subdivisions the CMA/CSD tables.
export async function establishments(geo) {
  const local=['CSD','CMACA'].includes(geo.type);
  if(!local&&geo.type!=='PR') throw new SourceError('unsupported','Business Counts are published for Canada, provinces, territories, metropolitan areas and census subdivisions, not for this geography level.');
  const family=local?/^Canadian Business Counts, with employees, census metropolitan areas and census subdivisions, June \d{4}$/:/^Canadian Business Counts, with employees, June \d{4}$/;
  const tables=(await catalog()).filter(t=>family.test(t.cubeTitleEn))
    .map(t=>({...t,year:Number(t.cubeTitleEn.slice(-4))})).sort((a,b)=>a.year-b.year);
  const latest=tables.at(-1);if(!latest) throw new SourceError('empty','No Business Counts releases are listed.');
  const m=await metadata(latest.productId),g=geoMember(m.dimension[0],geo);
  if(!g) throw new SourceError('unsupported','Business Counts do not publish this geography in the latest release.');
  const key=coord([g.memberId,1,1]),recent=tables.slice(-9);
  const [info,data]=await Promise.all([
    request(`${WDS}/getSeriesInfoFromCubePidCoord`,{body:recent.map(t=>({productId:String(t.productId),coordinate:key}))}),
    request(`${WDS}/getDataFromCubePidCoordAndLatestNPeriods`,{body:recent.map(t=>({productId:String(t.productId),coordinate:key,latestN:1}))})]);
  // Member IDs are reused across releases; keep a release only when its series title names the same geography.
  const values=recent.map((t,i)=>{const title=info[i]?.object?.SeriesTitleEn??'',p=data[i]?.object?.vectorDataPoint?.[0];
    return {year:t.year,value:title.startsWith(g.memberNameEn)&&p?numeric(p.value):null,title:t.cubeTitleEn,pid:t.productId};});
  return {values,geoName:g.memberNameEn,latest};
}

export async function psis(geo,{institution='',kind=1,status=1,registration=1,gender=1,periods=6}={}) {
  const m=await metadata('37100277'),gd=m.dimension[0];
  const province=geo.id===CANADA.id?'11124':String(geo.province||geo.id.slice(9,11)).split('_')[0];
  const region=gd.member.find(x=>String(x.classificationCode)===province);
  if(!region) throw new SourceError('unsupported','No PSIS region is published for this selection.');
  const institutions=gd.member.filter(x=>(geo.id===CANADA.id?x.parentMemberId!=null:x.parentMemberId===region.memberId)&&x.classificationCode==null);
  const g=institution?institutions.find(x=>String(x.memberId)===String(institution)):region;
  if(!g) throw new SourceError('unsupported','The institution does not belong to this province or territory.');
  const fields=m.dimension[1].member.filter(x=>/^\d{2}\.$|^30\.\d{2}$/.test(x.classificationCode??''));
  const keys=fields.map(f=>coord([g.memberId,f.memberId,1,1,kind,registration,status,gender]));
  const totalKey=coord([g.memberId,1,1,1,kind,registration,status,gender]);
  const data=await points(m.productId,[...keys,totalKey],periods);
  return {fields:fields.map((f,i)=>({id:f.memberId,code:f.classificationCode,name:f.memberNameEn,series:data.get(keys[i])??[]})),
    totalSeries:data.get(totalKey)??[],institutions,region:region.memberNameEn,regionId:region.memberId,geoName:g.memberNameEn,metadata:m};
}
// Enrolments by CIP primary grouping as published (37-10-0011): Canada, provinces, and the three territories combined.
// kind: institution type member (1 all, 2 university, 3 college); registration: 1 all, 2 full-time, 3 part-time.
export async function psisGroups(province,{kind=1,registration=1,periods=8}={}) {
  const m=await metadata('37100011'),[gd,kd,pd,cd,fd,rd,sd]=m.dimension;
  const name=!province?'Canada':Number(province)>=60?'Territories':PT_NAMES[province];
  const g=gd.member.find(x=>x.memberNameEn===name);if(!g) throw new SourceError('unsupported','No enrolment grouping is published for this province or territory.');
  const fields=fd.member.filter(x=>x.memberId!==1),key=f=>coord([g.memberId,kind,1,1,f,registration,1]);
  const data=await points(m.productId,[key(1),...fields.map(f=>key(f.memberId))],periods);
  return {geoName:g.memberNameEn,metadata:m,total:data.get(key(1))??[],groups:fields.map(f=>({id:String(f.memberId),name:f.memberNameEn,series:data.get(key(f.memberId))??[]}))};
}
const PT_NAMES={'10':'Newfoundland and Labrador','11':'Prince Edward Island','12':'Nova Scotia','13':'New Brunswick','24':'Quebec','35':'Ontario','46':'Manitoba','47':'Saskatchewan','48':'Alberta','59':'British Columbia'};
// Whole-institution totals for each institution of a region, one field set at a time.
export async function psisInstitutions(meta,institutions,fieldIds,{kind=1,status=1,registration=1,gender=1}={},refPer) {
  const key=(i,f)=>coord([i.memberId,f,1,1,kind,registration,status,gender]);
  const data=await points(meta.productId,institutions.flatMap(i=>fieldIds.map(f=>key(i,f))),2);
  return new Map(institutions.map(i=>{const v=fieldIds.map(f=>data.get(key(i,f))?.find(p=>p.refPer===refPer)?.value??null);
    return [i.memberId,v.every(x=>x!=null)?v.reduce((s,x)=>s+x,0):null];}));
}

// Air passenger traffic: airports of a province (or all), with sector values in the latest complete year.
export async function airTraffic(province) {
  const m=await metadata('23100253'),[gd,sd]=m.dimension;
  const region=province?gd.member.find(x=>String(x.classificationCode)===province):null;
  const airports=gd.member.filter(x=>x.classificationCode==null&&(!region||x.parentMemberId===region.memberId));
  const sectors=sd.member;
  const keys=airports.flatMap(a=>sectors.map(s=>coord([a.memberId,s.memberId])));
  const data=await points(m.productId,keys,3);
  return {metadata:m,sectors,airports:airports.map(a=>{
    const series=Object.fromEntries(sectors.map(s=>[s.memberNameEn,data.get(coord([a.memberId,s.memberId]))??[]]));
    const total=series[sectors[0].memberNameEn].filter(p=>p.value!=null).at(-1);
    const at=name=>series[name]?.find(p=>p.refPer===total?.refPer)?.value??null;
    return {id:a.memberId,name:a.memberNameEn,year:total?Number(total.refPer.slice(0,4)):null,total:total?.value??null,at,series};
  })};
}
