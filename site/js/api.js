// Runtime public sources. Completed and in-flight requests share an in-memory cache; failures are evicted.
import {numeric,Profile,CANADA,SECTORS,reconcileCounts,estimate} from './model.js';
import {PROFILE_IDS} from './census.js';

export const CENSUS='https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest';
export const WDS='https://www150.statcan.gc.ca/t1/wds/rest';
export const table=pid=>`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${String(pid).slice(0,8)}01`;
const SDMX='application/vnd.sdmx.data+json;version=1.0';

import {request,SourceError} from './transport.js';
export {request,SourceError,MESSAGES,memoRequest,clearCache,journal} from './transport.js';

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
// Selected characteristics for many areas of one type, 120 areas per request: a request costs about 2 s plus 6 ms
// per area (measured 2026-10-24: 40 areas 2.3 s, 120 areas 2.5 s, 240 areas 3.8 s), and URLs stay near 2 kB.
export async function censusMany(type,ids,chars) {
  const chunks=[];for(let i=0;i<ids.length;i+=120)chunks.push(ids.slice(i,i+120));
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
    const o=r.object;return [o.coordinate,(o.vectorDataPoint??[]).map(p=>{
      const x=numeric(p.value);return {...p,value:x==null?null:x*10**(p.scalarFactorCode??0)};
    })];
  }));
}
// Reference periods an annual table publishes, from its metadata: every year from the first to the last.
export const periods=m=>Number(m.cubeEndDate.slice(0,4))-Number(m.cubeStartDate.slice(0,4))+1;
// Members other than geography for a selector {dimension name or names "A|B": RegExp for the member}; a dimension
// without an entry takes its root member.
function members(m,selector) {
  return m.dimension.slice(1).map(d=>{const k=Object.keys(selector).find(k=>k.split('|').includes(d.dimensionNameEn)),re=selector[k];
    const s=re?d.member.find(x=>re.test(x.memberNameEn)):d.member.find(x=>x.parentMemberId==null)??d.member[0];
    if(!s) throw new SourceError('unsupported',`The table does not publish the requested ${d.dimensionNameEn} category.`);return s;});
}
// One annual series over every published period.
export async function annual(pid,geo,selector={}) {
  const d=(await history(pid,[geo],selector)).get(geo.id);
  if(!d) throw new SourceError('unsupported','This table does not publish the selected geography.');
  return {metadata:d.metadata,geoName:d.name,values:d.values,pid:String(pid),unit:d.unit};
}
// The same annual series for many areas from one table, every published period, 250 areas per request.
// Returns Map geo.id → {name, values: [{year, refPer, value}], unit, metadata} for the areas the table publishes.
export async function history(pid,geos,selector={}) {
  const m=await metadata(pid),c=members(m,selector),G=geos.map(g=>[g,geoMember(m.dimension[0],g)]).filter(([,x])=>x);
  if(!G.length)return new Map();
  const key=x=>coord([x.memberId,...c.map(y=>y.memberId)]);
  const [data,{scale,unit}]=await Promise.all([points(pid,G.map(([,x])=>key(x)),periods(m)),units([G[0][1],...c])]);
  return new Map(G.map(([g,x])=>[g.id,{name:x.memberNameEn,unit,metadata:m,
    values:(data.get(key(x))??[]).map(p=>({year:Number(p.refPer.slice(0,4)),refPer:p.refPer,value:p.value==null?null:p.value*scale}))}]));
}
// Data points report scalarFactorCode 0 for series published "in thousands"; the member's unit of measure says so.
const codeSets=()=>request(`${WDS}/getCodeSets`);
export async function units(members) {
  const code=members.map(m=>m.memberUomCode).filter(c=>c!=null).at(-1);if(code==null)return {scale:1,unit:''};
  const unit=(await codeSets()).object?.uom?.find(u=>u.memberUomCode===code)?.memberUomEn??'';
  return {unit,scale:/in thousands$|^Thousands of/i.test(unit)?1e3:/in millions$|^Millions of/i.test(unit)?1e6:1};
}

// ---------- OECD Regional Statistics ----------

export const OECD='https://sdmx.oecd.org/public/rest/data/OECD.CFE.EDS';
export const oecdExplorer=flow=>`https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=${encodeURIComponent(flow)}&df[ag]=OECD.CFE.EDS`;
// OECD region code: Canada CAN; a province or territory (TL2) or census division (TL3) CA + its Census code.
export const oecdArea=g=>g.id===CANADA.id?'CAN':['PR','CD'].includes(g.type)?`CA${g.id.slice(9)}`:null;
// The Northwest Territories and Nunavut on current boundaries exist from 1999; the OECD fills earlier years with 0
// marked as normal values (checked 2026-10-26 in income and homicides), so those years are not observations.
const BORN={CA61:1999,CA62:1999};
// Quoted CSV fields may hold commas; the OECD's CSV has no embedded newlines.
const fields=line=>{const v=[];let cur='',q=false;for(const c of line){if(c==='"')q=!q;else if(c===','&&!q){v.push(cur);cur='';}else cur+=c;}v.push(cur);return v;};
// One OECD regional series for many areas, every published year: key gives the dimensions after
// TERRITORIAL_TYPE. Values are scaled by UNIT_MULT. One request; the API answers bursts with HTTP 429, so at most
// two run at a time. Returns Map geo.id → {name, values: [{year, value}], base} (base: price reference year).
export async function oecdHistory(flow,key,geos) {
  const G=geos.map(g=>[g,oecdArea(g)]).filter(([,c])=>c);if(!G.length)return new Map();
  const codes=[...new Set(G.map(([,c])=>c))].sort();
  const [head,...lines]=(await request(`${OECD},${flow},/A..${codes.join('+')}..${key}?dimensionAtObservation=AllDimensions&format=csvfile`,
    {accept:'text/csv',parse:'text',limit:1})).trim().split(/\r?\n/);
  const H=fields(head),at=k=>H.indexOf(k),by=new Map();
  for(const l of lines){const v=fields(l),x=numeric(v[at('OBS_VALUE')]),y=Number(v[at('TIME_PERIOD')].slice(0,4));
    if(x==null||(BORN[v[at('REF_AREA')]]??0)>y)continue;
    const s=by.get(v[at('REF_AREA')])??by.set(v[at('REF_AREA')],{values:[],base:v[at('REF_YEAR_PRICE')]??''}).get(v[at('REF_AREA')]);
    s.values.push({year:y,value:x*10**(numeric(v[at('UNIT_MULT')])??0)});}
  return new Map(G.filter(([,c])=>by.has(c)).map(([g,c])=>[g.id,{name:g.name,...by.get(c),values:by.get(c).values.sort((p,q)=>p.year-q.year)}]));
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

// Payroll jobs by NAICS sector (SEPH 14-10-0202) for geo and Canada, every published year: e and E map year →
// jobs here and in Canada. The 20 sectors partition the industrial aggregate excluding unclassified businesses
// [11-91N]; SEPH covers forestry and logging [11N], not agriculture. Suppressed cells stay null.
export async function sephSectors(geo) {
  const m=await metadata('14100202'),[gd,ed,nd]=m.dimension,g=geoMember(gd,geo),ca=geoMember(gd,CANADA);
  if(!g) throw new SourceError('unsupported','SEPH industry employment is published for Canada, provinces and territories only.');
  const employee=ed.member.find(x=>x.memberNameEn==='All employees'),aggregate=nd.member.find(x=>x.classificationCode==='11-91N');
  const code=x=>(x.classificationCode??'').split(',')[0].replace(/N$/,'');
  const sectors=nd.member.filter(x=>x!==aggregate&&SECTORS[code(x)]);
  const key=(gi,n)=>coord([gi,employee.memberId,n.memberId]);
  const data=await points(m.productId,[g.memberId,ca.memberId].flatMap(gi=>[aggregate,...sectors].map(n=>key(gi,n))),periods(m));
  const S=(gi,n)=>new Map((data.get(key(gi,n))??[]).map(p=>[Number(p.refPer.slice(0,4)),p.value]));
  const pair=n=>({e:S(g.memberId,n),E:S(ca.memberId,n)});
  return {metadata:m,geoName:g.memberNameEn,agg:pair(aggregate),rows:sectors.map(n=>({code:code(n),name:n.memberNameEn.replace(/ \[[^\]]+\]$/,''),...pair(n)}))};
}
// The values shift-share reads, e0, e1, E0, E1, for base year `from` and end year `to`.
export function sephAt(d,from,to) {
  const four=({e,E})=>({e0:e.get(from)??null,e1:e.get(to)??null,E0:E.get(from)??null,E1:E.get(to)??null});
  return {from,year:to,agg:four(d.agg),rows:d.rows.map(r=>({code:r.code,name:r.name,...four(r)}))};
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
  // Batch responses are not guaranteed to follow request order; join them by product.
  const by=list=>new Map((list??[]).map(r=>[String(r?.object?.productId),r]));const infoBy=by(info),dataBy=by(data);
  const values=recent.map(t=>{const title=infoBy.get(String(t.productId))?.object?.SeriesTitleEn??'',p=dataBy.get(String(t.productId))?.object?.vectorDataPoint?.[0];
    return {year:t.year,value:title.startsWith(g.memberNameEn)&&p?numeric(p.value):null,title:t.cubeTitleEn,pid:t.productId};});
  return {values,geoName:g.memberNameEn,latest};
}
