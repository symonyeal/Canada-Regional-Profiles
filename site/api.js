// Runtime public APIs only. Completed and in-flight requests live in memory; failed requests are evicted.
import {numeric,Profile,CANADA,reconcileCounts,estimate} from './model.js';
export const CENSUS='https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest';
export const WDS='https://www150.statcan.gc.ca/t1/wds/rest';
const cache=new Map();
export const journal=[];
export function memoRequest(store,key,fn) {
  if(!store.has(key)) store.set(key,Promise.resolve().then(fn).catch(e=>{store.delete(key);throw e;}));
  return store.get(key);
}
export function clearCache() {cache.clear();}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function request(url,body,accept='application/json') {
  return memoRequest(cache,`${url}/${JSON.stringify(body)}/${accept}`,async()=>{
    let error;
    for(let attempt=0;attempt<3;attempt++) {
      const start=Date.now();
      try {
        const r=await fetch(url,{method:body?'POST':'GET',headers:{Accept:accept,...(body?{'Content-Type':'application/json'}:{})},
          ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000),cache:'no-store'});
        journal.push({url,status:r.status,retrieved:new Date().toISOString(),ms:Date.now()-start});
        if(!r.ok) {if(r.status===404) throw Error('This geography or series is not published by this source (404).');
          throw Error(`Source returned HTTP ${r.status}.`);}
        const data=await r.json(); if(data.error) throw Error(data.error.message||'Source reported an error.');
        return data;
      } catch(e) {
        error=e; if(e.message?.includes('(404)')) break;
        if(attempt<2) await delay(700*(attempt+1));
      }
    }
    throw Error(`${error.message||'Public source could not be reached'} Please retry.`);
  });
}
function attributes(definitions,indices=[]) {
  return Object.fromEntries((definitions??[]).map((a,i)=>[a.id,a.values?.[indices[i]]]));
}
export function decodeSDMX(message) {
  const d=message.data??message, s=d.structure;
  if(!s?.dimensions || !d.dataSets?.length) throw Error('Invalid SDMX response from the public source.');
  const dim=s.dimensions.series??[],obs=s.dimensions.observation??[];
  const out=[];
  for(const dataset of d.dataSets) for(const [key,series] of Object.entries(dataset.series??{})) {
    const parts=key.split(':').map(Number), v=Object.fromEntries(dim.map((x,i)=>[x.id,x.values[parts[i]]]));
    const attr=attributes(s.attributes?.series,series.attributes);
    for(const [k,o] of Object.entries(series.observations??{})) {
      const oi=k.split(':').map(Number), od=Object.fromEntries(obs.map((x,i)=>[x.id,x.values[oi[i]]]));
      const oa=attributes(s.attributes?.observation,o.slice(1));
      out.push({area:v.REF_AREA,gender:v.GENDER,characteristic:v.CHARACTERISTIC,statistic:v.STATISTIC,
        value:numeric(o[0]),time:od.TIME_PERIOD?.id,topic:attr.TOPIC?.name,notes:attr.NOTE?.name,
        province:attr.PROV_TERR?.id,status:oa.OBS_STATUS?.name??oa.CONF_STATUS?.name??'',attributes:attr});
    }
  }
  if(!out.length) throw Error('No observations published for this selection.');
  return out;
}
export async function census(geo=CANADA) {
  const url=`${CENSUS}/data/DF_${geo.type}/A5.${geo.id}...`;
  const rows=decodeSDMX(await request(url,undefined,'application/vnd.sdmx.data+json;version=1.0'));
  const profile=new Profile(rows); profile.url=url; return profile;
}
export async function geographies(type='CSD') {
  const rows=decodeSDMX(await request(`${CENSUS}/data/DF_${type}/A5..1.1.1`,undefined,'application/vnd.sdmx.data+json;version=1.0'));
  return rows.map(r=>({...r.area,type,population:r.value,province:r.province,
    municipalType:r.attributes.GEO_DESC?.name?.match(/, ([^,\[\]]+) \[Census subdivision\]/)?.[1]??'',
    description:r.attributes.GEO_DESC?.name??r.area.name}));
}
export async function metadata(pid) {
  const data=await request(`${WDS}/getCubeMetadata`,[{productId:String(pid)}]);
  if(data[0]?.status!=='SUCCESS') throw Error('Table metadata is unavailable.');
  return data[0].object;
}
export const catalog=()=>request(`${WDS}/getAllCubesListLite`);
export function tablePair(tables,local=false) {
  const candidates=tables.filter(t=>/^Canadian Business Counts, with employees, /.test(t.cubeTitleEn)
    && /census metropolitan areas and census subdivisions/.test(t.cubeTitleEn)===local
    && /(?:June|December) \d{4}$/.test(t.cubeTitleEn)).sort((a,b)=>b.releaseTime.localeCompare(a.releaseTime));
  const current=candidates[0]; if(!current) throw Error('No Business Counts tables found in the live catalogue.');
  const [,month,year]=current.cubeTitleEn.match(/(June|December) (\d{4})$/);
  const previous=candidates.find(t=>t.cubeTitleEn.endsWith(`${month} ${Number(year)-5}`))??null;
  return {current,previous};
}
export function geoMember(dimension,geo) {
  const code=geo.id===CANADA.id?'11124':geo.type==='CMACA'?geo.id.slice(9):geo.id.slice(9);
  return dimension.member.find(m=>String(m.classificationCode)===code)??null;
}
export const coord=values=>values.concat(Array(Math.max(0,10-values.length)).fill(0)).join('.');
export async function points(pid,coordinates,latestN=1) {
  // WDS accepts at most 300 series per request. Four workers bound simultaneous upstream load.
  const chunks=[]; for(let i=0;i<coordinates.length;i+=250) chunks.push(coordinates.slice(i,i+250));
  const results=new Array(chunks.length); let next=0;
  await Promise.all(Array.from({length:Math.min(4,chunks.length)},async()=>{
    for(;;) {const i=next++; if(i>=chunks.length) break;
      results[i]=await request(`${WDS}/getDataFromCubePidCoordAndLatestNPeriods`,
        chunks[i].map(coordinate=>({productId:String(pid),coordinate,latestN})));
    }
  }));
  return new Map(results.flat().filter(r=>r.status==='SUCCESS'&&r.object).map(r=>{
    const o=r.object; return [o.coordinate,(o.vectorDataPoint??[]).map(p=>({...p,value:numeric(p.value)}))];
  }));
}
export async function businessSlice(table,geo,level='4') {
  const m=await metadata(table.productId),[gd,sd,nd]=m.dimension, g=geoMember(gd,geo);
  if(!g) throw Error('Business Counts does not publish this geography in the selected release.');
  const industries=nd.member.filter(x=>{const c=x.classificationCode??'';
    return level==='2'?/^\d{2}(?:-\d{2})?$/.test(c):new RegExp(`^\\d{${level}}$`).test(c);});
  const sizes=sd.member.filter(x=>x.parentMemberId!=null);
  const coords=industries.flatMap(n=>[coord([g.memberId,1,n.memberId]),...sizes.map(s=>coord([g.memberId,s.memberId,n.memberId]))]);
  const subtotal=nd.member.find(n=>n.classificationCode==='3');
  if(subtotal)coords.push(...sizes.map(s=>coord([g.memberId,s.memberId,subtotal.memberId])));
  const data=await points(table.productId,coords);
  const rows=industries.map(n=>{
    const N=sizes.map(s=>data.get(coord([g.memberId,s.memberId,n.memberId]))?.at(-1)?.value??null);
    return {code:n.classificationCode,name:n.memberNameEn.replace(/ \[[\d-]+\]$/,''),N,
      total:data.get(coord([g.memberId,1,n.memberId]))?.at(-1)?.value??null};
  });
  const subN=sizes.map(s=>subtotal?data.get(coord([g.memberId,s.memberId,subtotal.memberId]))?.at(-1)?.value??null:null);
  return {rows:reconcileCounts(rows,subN),metadata:m,table,totalEstimate:estimate(subN)};
}
export async function populationSeries(geo) {
  const m=await metadata('17100009'),g=geoMember(m.dimension[0],geo);
  if(!g) throw Error('Quarterly population estimates are published here for Canada and provinces/territories.');
  const data=await points('17100009',[coord([g.memberId])],28);
  return data.get(coord([g.memberId]))??[];
}
export async function labourRates(geo,gender='1',age='1',seasonal) {
  const territory=Number(geo.province||geo.id.slice(9,11))>=60,pid=territory?'14100292':'14100287';
  const m=await metadata(pid),g=geoMember(m.dimension[0],geo);
  if(!g)throw Error('This Labour Force Survey table does not publish the selected local geography.');
  const adjusted=seasonal??(territory?'2':'1');
  const indicators=m.dimension[1].member.filter(x=>/^(Participation rate|Employment rate|Unemployment rate)$/.test(x.memberNameEn));
  const keys=indicators.map(i=>coord([g.memberId,i.memberId,Number(gender),Number(age),1,Number(adjusted)]));
  const data=await points(pid,keys,24);
  return {pid,metadata:m,territory,adjusted,ages:m.dimension[3].member,
    series:indicators.map((i,j)=>({name:i.memberNameEn,points:data.get(keys[j])??[]}))};
}
export async function seph(geo,level='4') {
  const m=await metadata('14100202'),[gd,ed,nd]=m.dimension,g=geoMember(gd,geo),ca=geoMember(gd,CANADA);
  if(!g)throw Error('SEPH industry employment is not published at this local geography. Choose Business Register estimates.');
  const employee=ed.member.find(x=>x.memberNameEn==='All employees'),aggregate=nd.member.find(x=>x.classificationCode==='00-91N');
  const industries=nd.member.filter(x=>level==='2'?/^\d{2}(?:-\d{2})?$/.test(x.classificationCode??''):new RegExp(`^\\d{${level}}$`).test(x.classificationCode??''));
  const year=Number(m.cubeEndDate.slice(0,4)),all=[aggregate,...industries],keys=[...new Set([g.memberId,ca.memberId])].flatMap(gi=>all.map(n=>coord([gi,employee.memberId,n.memberId])));
  const data=await points(m.productId,keys,6),get=(gi,n,y)=>data.get(coord([gi,employee.memberId,n.memberId]))?.find(p=>p.refPer.startsWith(String(y)))?.value??null;
  return {metadata:m,year,total:get(g.memberId,aggregate,year),nationalTotal:get(ca.memberId,aggregate,year),rows:industries.map(n=>({
    code:n.classificationCode,name:n.memberNameEn.replace(/ \[[\d-]+\]$/,''),value:get(g.memberId,n,year),previous:get(g.memberId,n,year-5),national:get(ca.memberId,n,year)}))};
}
export async function annualSeries(geo,pid,selector={}) {
  const m=await metadata(pid),gd=m.dimension[0],g=geoMember(gd,geo);if(!g)throw Error('This annual series is not published for the selected geography.');
  const chosen=m.dimension.map((d,i)=>{if(i===0)return g;const pattern=selector[d.dimensionNameEn];
    const selected=pattern?d.member.find(x=>pattern.test(x.memberNameEn)):d.member.find(x=>x.parentMemberId==null)??d.member[0];
    if(!selected)throw Error(`The source does not publish the requested ${d.dimensionNameEn} category.`);return selected;});
  const key=coord(chosen.map(x=>x.memberId)),data=await points(pid,[key],12);
  return {metadata:m,values:(data.get(key)??[]).map(p=>({...p,value:p.value==null?null:p.value*10**(p.scalarFactorCode??0)}))};
}
export async function psis(geo,{institution='',kind=1,status=1,registration=1,gender=1,periods=5}={}) {
  const m=await metadata('37100277'),gd=m.dimension[0];
  const province=geo.id===CANADA.id?'11124':String(geo.province||geo.id.slice(9,11)).split('_')[0];
  const region=gd.member.find(x=>String(x.classificationCode)===province);
  if(!region) throw Error('No PSIS region is published for this selection.');
  const institutions=gd.member.filter(x=>(geo.id===CANADA.id?x.parentMemberId!=null:x.parentMemberId===region.memberId) && x.classificationCode==null);
  const g=institution?institutions.find(x=>String(x.memberId)===String(institution)):region;
  if(!g) throw Error('The institution does not belong to this province or territory.');
  const fields=m.dimension[1].member.filter(x=>/^\d{2}\.$|^30\.\d{2}$/.test(x.classificationCode??''));
  const keys=fields.map(f=>coord([g.memberId,f.memberId,1,1,kind,registration,status,gender]));
  const totalKey=coord([g.memberId,1,1,1,kind,registration,status,gender]);
  const data=await points(m.productId,[...keys,totalKey],periods);
  return {fields:fields.map((f,i)=>({id:f.memberId,code:f.classificationCode,name:f.memberNameEn,series:data.get(keys[i])??[]})),totalSeries:data.get(totalKey)??[],
    institutions,region:region.memberNameEn,geoName:g.memberNameEn,metadata:m};
}
