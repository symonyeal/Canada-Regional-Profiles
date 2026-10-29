// Runtime public sources. Completed and in-flight requests share an in-memory cache; failures are evicted.
import {numeric,Profile,CANADA,PT,SECTORS,sectorOf,reconcileCounts,estimate,rankIndustries,isTraded,completeSum,locationQuotient,provinceOf,provinceGeo,provinceName,parentProvince,matchesProvince} from './model.js';
import {EXHIBIT_IDS,FILTERS} from './census.js';
import {trend,combine} from './trend-model.js';
import {MEASURE_IDS} from './regional-model.js';
import {request,SourceError} from './transport.js';

const CENSUS='https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest';
const WDS='https://www150.statcan.gc.ca/t1/wds/rest';
export const table=pid=>`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${String(pid).slice(0,8)}01`;
const SDMX='application/vnd.sdmx.data+json;version=1.0';
// Every characteristic an exhibit or measure reads: one request per area instead of the 2,600-characteristic profile.
export const PROFILE_IDS=[...new Set([...EXHIBIT_IDS,...MEASURE_IDS])].sort((a,b)=>a-b);

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

async function metadata(pid) {
  const data=await request(`${WDS}/getCubeMetadata`,{body:[{productId:String(pid)}]});
  if(data?.[0]?.status!=='SUCCESS') throw new SourceError('unsupported','Table metadata is unavailable.');
  return data[0].object;
}
const catalog=()=>request(`${WDS}/getAllCubesListLite`);
// A member's English name without its classification code: "Retail trade [44-45]" is "Retail trade".
const label=m=>m.memberNameEn.replace(/ \[[^\]]+\]$/,'');
// The release a Business Counts table describes, from its title: "June 2026".
const release=t=>t.cubeTitleEn.match(/(June|December) \d{4}$/)?.[0]??'';
// NAICS members of one level: '2' gives sectors, including ranges such as 31-33; otherwise codes of that many digits.
const naics=(dimension,level)=>{const re=level==='2'?/^\d{2}(?:-\d{2})?$/:new RegExp(`^\\d{${level}}$`);
  return dimension.member.filter(x=>re.test(x.classificationCode??''));};
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
const periods=m=>Number(m.cubeEndDate.slice(0,4))-Number(m.cubeStartDate.slice(0,4))+1;
// Members other than geography for a selector {dimension name or names "A|B": RegExp for the member}; a dimension
// without an entry takes its root member.
function members(m,selector) {
  return m.dimension.slice(1).map(d=>{const k=Object.keys(selector).find(k=>k.split('|').includes(d.dimensionNameEn)),re=selector[k];
    const s=re?d.member.find(x=>re.test(x.memberNameEn)):d.member.find(x=>x.parentMemberId==null)??d.member[0];
    if(!s) throw new SourceError('unsupported',`The table does not publish the requested ${d.dimensionNameEn} category.`);return s;});
}
// One annual series over every published period.
async function annual(pid,geo,selector={}) {
  const d=(await history(pid,[geo],selector)).get(geo.id);
  if(!d) throw new SourceError('unsupported','This table does not publish the selected geography.');
  return {metadata:d.metadata,geoName:d.name,values:d.values,pid:String(pid),unit:d.unit};
}
// The same annual series for many areas from one table, every published period, 250 areas per request.
// Returns Map geo.id → {name, values: [{year, refPer, value}], unit, metadata} for the areas the table publishes.
async function history(pid,geos,selector={}) {
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

const OECD='https://sdmx.oecd.org/public/rest/data/OECD.CFE.EDS';
const oecdExplorer=flow=>`https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=${encodeURIComponent(flow)}&df[ag]=OECD.CFE.EDS`;
// OECD region code: Canada CAN; a province or territory (TL2) or census division (TL3) CA + its Census code.
const oecdArea=g=>g.id===CANADA.id?'CAN':['PR','CD'].includes(g.type)?`CA${g.id.slice(9)}`:null;
// The Northwest Territories and Nunavut on current boundaries exist from 1999; the OECD fills earlier years with 0
// marked as normal values (checked 2026-10-26 in income and homicides), so those years are not observations.
const BORN={CA61:1999,CA62:1999};
// Quoted CSV fields may hold commas; the OECD's CSV has no embedded newlines.
const fields=line=>{const v=[];let cur='',q=false;for(const c of line){if(c==='"')q=!q;else if(c===','&&!q){v.push(cur);cur='';}else cur+=c;}v.push(cur);return v;};
// One OECD regional series for many areas, every published year: key gives the dimensions after
// TERRITORIAL_TYPE. Values are scaled by UNIT_MULT. One request; the API answers bursts with HTTP 429, so at most
// two run at a time. Returns Map geo.id → {name, values: [{year, value}], base} (base: price reference year).
async function oecdHistory(flow,key,geos) {
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

// SEPH, table 14-10-0202: payroll employment by industry, annual. Every payroll read takes all employees; key(g, n)
// is the coordinate of geography member g and industry member n. Canada, provinces and territories only.
const SEPH='14100202';
async function sephFrame(geo) {
  const m=await metadata(SEPH),[gd,ed,nd]=m.dimension,g=geoMember(gd,geo),ca=geoMember(gd,CANADA);
  if(!g) throw new SourceError('unsupported','SEPH industry employment is published for Canada, provinces and territories only.');
  const employee=ed.member.find(x=>x.memberNameEn==='All employees');
  return {m,g,ca,nd,key:(gi,n)=>coord([gi,employee.memberId,n.memberId])};
}
// Four-digit industries in the latest year and five years before, here and in Canada, with the aggregate [00-91N].
async function seph(geo) {
  const {m,g,ca,nd,key}=await sephFrame(geo),aggregate=nd.member.find(x=>x.classificationCode==='00-91N'),industries=naics(nd,'4');
  const year=Number(m.cubeEndDate.slice(0,4)),all=[aggregate,...industries];
  const data=await points(m.productId,[...new Set([g.memberId,ca.memberId])].flatMap(gi=>all.map(n=>key(gi,n))),6);
  const get=(gi,n,y)=>data.get(key(gi,n))?.find(p=>p.refPer.startsWith(String(y)))?.value??null;
  return {metadata:m,year,total:get(g.memberId,aggregate,year),nationalTotal:get(ca.memberId,aggregate,year),rows:industries.map(n=>({
    code:n.classificationCode,name:label(n),memberId:n.memberId,
    value:get(g.memberId,n,year),previous:get(g.memberId,n,year-5),national:get(ca.memberId,n,year)}))};
}

// Payroll jobs by NAICS sector for geo and Canada, every published year: e and E map year → jobs here and in
// Canada. The 20 sectors partition the industrial aggregate excluding unclassified businesses [11-91N]; SEPH covers
// forestry and logging [11N], not agriculture. Suppressed cells stay null.
export async function sephSectors(geo) {
  const {m,g,ca,nd,key}=await sephFrame(geo),aggregate=nd.member.find(x=>x.classificationCode==='11-91N');
  const code=x=>(x.classificationCode??'').split(',')[0].replace(/N$/,'');
  const sectors=nd.member.filter(x=>x!==aggregate&&SECTORS[code(x)]);
  const data=await points(m.productId,[...new Set([g.memberId,ca.memberId])].flatMap(gi=>[aggregate,...sectors].map(n=>key(gi,n))),periods(m));
  const S=(gi,n)=>new Map((data.get(key(gi,n))??[]).map(p=>[Number(p.refPer.slice(0,4)),p.value]));
  const pair=n=>({e:S(g.memberId,n),E:S(ca.memberId,n)});
  return {metadata:m,geoName:g.memberNameEn,agg:pair(aggregate),rows:sectors.map(n=>({code:code(n),name:label(n),...pair(n)}))};
}
// The values shift-share reads, e0, e1, E0, E1, for base year `from` and end year `to`.
export function sephAt(d,from,to) {
  const four=({e,E})=>({e0:e.get(from)??null,e1:e.get(to)??null,E0:E.get(from)??null,E1:E.get(to)??null});
  return {from,year:to,agg:four(d.agg),rows:d.rows.map(r=>({code:r.code,name:r.name,...four(r)}))};
}

async function businessSlice(t,geo,level) {
  const m=await metadata(t.productId),[gd,sd,nd]=m.dimension,g=geoMember(gd,geo);
  if(!g) throw new SourceError('unsupported','Business Counts does not publish this geography in the selected release.');
  const industries=naics(nd,level),sizes=sd.member.filter(x=>x.parentMemberId!=null);
  const coords=industries.flatMap(n=>[coord([g.memberId,1,n.memberId]),...sizes.map(s=>coord([g.memberId,s.memberId,n.memberId]))]);
  const subtotal=nd.member.find(n=>n.classificationCode==='3');
  if(subtotal)coords.push(...sizes.map(s=>coord([g.memberId,s.memberId,subtotal.memberId])));
  const data=await points(t.productId,coords);
  const at=k=>data.get(k)?.at(-1)?.value??null;
  const rows=industries.map(n=>({code:n.classificationCode,name:label(n),
    N:sizes.map(s=>at(coord([g.memberId,s.memberId,n.memberId]))),total:at(coord([g.memberId,1,n.memberId]))}));
  const subN=sizes.map(s=>subtotal?at(coord([g.memberId,s.memberId,subtotal.memberId])):null);
  return {rows:reconcileCounts(rows,subN),metadata:m,table:t,totalEstimate:estimate(subN),sizes:sizes.map(s=>s.memberNameEn)};
}

// Selected area's and benchmark's profiles. The benchmark may fail without hiding the selected values.
async function pair(place,bench) {
  const [p,b]=await Promise.allSettled([census(place),census(bench)]);
  if(p.status==='rejected') throw p.reason;
  return {p:p.value,b:b.status==='fulfilled'&&bench.id!==place.id?b.value:null,bench};
}
// The same pair shared by several cards: awaiting it starts one request; a failure is forgotten so a card's Retry asks again.
export function sharedPair(place,bench) {
  let p=null;const get=()=>p??=pair(place,bench).catch(e=>{p=null;throw e;});
  return {then:(ok,fail)=>get().then(ok,fail)};
}
export const censusMeta=(place,{universe,notes}={})=>({source:'Statistics Canada, Census Profile 2021',url:'https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm',
  geo:place.name,period:'Census 2021 (May 2021); income refers to 2020',universe,notes});

export const levelOf=place=>place.id===CANADA.id?'PR':place.type;
// Population estimates, every published year, from the first population source of the area's level.
export async function populationSeries(place) {
  const s=trend('population').source[levelOf(place)];if(!s) throw new SourceError('unsupported','Annual population estimates are not published for population centres.');
  return annual(s[0].x[0],place,s[0].x[1]);
}
// Tax-filer income series (11-10-0008 individuals, 11-10-0009 census families): Canada, provinces, CMAs and CAs.
export async function incomeSeries(place,kind) {
  if(!['PR','CMACA'].includes(levelOf(place))) throw new SourceError('unsupported','Annual tax-filer income is published for Canada, provinces, territories, metropolitan areas and agglomerations.');
  return kind==='family'?annual('11100009',place,{'Family characteristics':/^Median total income, all families$/})
    :annual('11100008',place,{'Sex':/^Both sexes$/,'Age group':/^All age groups$/,'Persons with income':/^Median total income$/});
}
// Series of annual measure m for areas G. Each area takes the first source of its level that publishes a value for
// it; a source whose categories a table lacks is skipped. A term is [table, selector] (Statistics Canada) or
// {oecd: dataflow, key} (OECD). Returns Map id → {name, source, url, values: [{year, value}]}; areas no source
// publishes are absent.
export async function trendSeries(m,G) {
  const out=new Map(),levels=new Map();for(const g of G)levels.set(levelOf(g),[...levels.get(levelOf(g))??[],g]);
  const read=(t,A)=>(t.oecd?oecdHistory(t.oecd,t.key,A):history(t[0],A,t[1])).catch(e=>{if(e.kind==='unsupported')return null;throw e;});
  const cite=(t,x)=>t.oecd?{source:`OECD Regional Statistics, ${t.title}${x.base&&x.base!=='_Z'?`, ${x.base} prices`:''}`,url:oecdExplorer(t.oecd)}
    :{source:`Statistics Canada, table ${tableId(t[0])}: ${x.metadata.cubeTitleEn}`,url:table(t[0])};
  await Promise.all([...levels].map(async([l,A])=>{
    for(const s of m.source[l]??[]){
      const rest=A.filter(g=>!out.has(g.id));if(!rest.length)break;
      const [X,N]=await Promise.all([read(s.x,rest),s.n?read(s.n,rest):undefined]);if(!X||N===null)continue;
      for(const g of rest){const x=X.get(g.id);if(!x)continue;
        const n=N&&new Map((N.get(g.id)?.values??[]).map(v=>[v.year,v.value]));
        const values=x.values.map(v=>({year:v.year,value:combine(m,v.value,n?n.get(v.year)??null:undefined)}));
        if(values.some(v=>v.value!=null))out.set(g.id,{name:x.name,...cite(s.x,x),values});}
    }
  }));
  return out;
}
const tableId=pid=>String(pid).replace(/(\d{2})(\d{2})(\d{4})/,'$1-$2-$3');
export const tableMeta=(d,{title,universe,notes,period}={})=>({source:`Statistics Canada, table ${tableId(d.pid)}: ${d.metadata.cubeTitleEn}`,url:table(d.pid),
  geo:d.geoName,period:period??(f=>f.length?`${f[0].year} to ${f.at(-1).year}`:'')(d.values.filter(v=>v.value!=null)),universe,notes});

// The cohort an area is ranked among: the province's census subdivisions with at least 1,000 residents (smaller
// counts are dominated by Census random rounding) or its census divisions; all metropolitan areas and
// agglomerations (whole areas, not provincial parts), economic regions or population centres; the thirteen
// provinces and territories for a province, territory or Canada. The selected area joins its cohort when outside it.
// cohortAreas returns {label, areas}; cohort adds P, P[i] the measure profile of areas[i] or null.
export async function cohortAreas(g,placeList) {
  const pr=provinceOf(g),local=['CSD','CD'].includes(g.type),where=provinceName(pr);
  if(g.id===CANADA.id||g.type==='PR')return {label:'provinces and territories',areas:PT.map(([c])=>provinceGeo(c))};
  const areas=(await placeList(g.type)).filter(a=>local?matchesProvince(a,pr)&&(g.type!=='CSD'||(a.population??0)>=1000):g.type!=='CMACA'||/^2021S050[34]/.test(a.id));
  if(!areas.some(a=>a.id===g.id))areas.push({...g});
  return {areas,label:{CSD:`${where} municipalities with 1,000+ residents`,CD:`census divisions in ${where}`,CMACA:'metropolitan areas and agglomerations',
    ER:'economic regions',POPCNTR:'population centres'}[g.type]};
}
export async function cohort(g,placeList) {
  const {label,areas}=await cohortAreas(g,placeList),P=await censusMany(levelOf(g),areas.map(a=>a.id),MEASURE_IDS);
  return {label,areas,P:areas.map(a=>P.get(a.id)?.rows.length?P.get(a.id):null)};
}

// Detailed industry employment: SEPH payroll employment for Canada and provinces; Business Register employee
// estimates for metropolitan areas and census subdivisions, labelled as estimates.

export async function industryData(place) {
  const c=await request('classification.json');
  if(place.type==='PR'){
    const d=await seph(place),y=d.year;
    const all=d.rows.map(r=>({...r,traded:isTraded(r.code,c.codes,c.traded)}));
    const ranked=rankIndustries(all,'value',{total:d.total,nationalTotal:d.nationalTotal});
    return {rows:ranked,suppressed:all.filter(r=>r.value==null).length,count:all.length,year:y,prior:y-5,measure:'jobs',
      source:{source:'Statistics Canada, table 14-10-0202: Employment by industry, annual (SEPH)',url:table('14100202'),
        universe:'All employees on payrolls, annual average, by establishment industry (NAICS 4-digit)',period:`${y}; growth compares ${y-5} and ${y}`,
        notes:`Location quotient: the area's share of its industrial aggregate [00-91N] divided by Canada's share. Traded/local follows a mapped US cluster classification and is approximate. ${all.filter(r=>r.value==null).length} of ${all.length} industries are suppressed or not published for ${place.name}.`}};
  }
  if(!['CSD','CMACA'].includes(place.type)) throw new SourceError('unsupported',`Industry employment is published for Canada, provinces and territories (SEPH) and as Business Register estimates for metropolitan areas and municipalities. It is not published for ${place.type==='CD'?'census divisions':place.type==='ER'?'economic regions':'population centres'}.`);
  const cat=await catalog(),local=tablePair(cat,true),nat=tablePair(cat,false);
  const [cur,prev,canada]=await Promise.all([businessSlice(local.current,place,'4'),local.previous?businessSlice(local.previous,place,'4').catch(()=>null):null,businessSlice(nat.current,CANADA,'4')]);
  const before=new Map(prev?.rows.map(r=>[r.code,estimate(r.N).value])??[]),ca=new Map(canada.rows.map(r=>[r.code,estimate(r.N).value]));
  const all=cur.rows.map(r=>({code:r.code,name:r.name,value:estimate(r.N).value,previous:before.get(r.code)??null,national:ca.get(r.code)??null,traded:isTraded(r.code,c.codes,c.traded)}));
  const ranked=rankIndustries(all,'value',{total:cur.totalEstimate.value,nationalTotal:canada.totalEstimate.value});
  const y=Number(local.current.cubeTitleEn.slice(-4));
  return {rows:ranked,suppressed:all.filter(r=>r.value==null).length,count:all.length,year:y,prior:local.previous?y-5:null,measure:'estimated employees',estimate:true,
    source:{source:`Statistics Canada, ${local.current.cubeTitleEn}${local.previous?` and ${release(local.previous)}`:''}`,url:table(local.current.productId),
      universe:'Employer business locations by employment-size class, converted to employees at class midpoints (500 for 500+)',period:release(local.current),
      notes:'These are estimates from size classes, not payroll counts. Industries recoded between releases have no growth value. Traded/local is approximate.'}};
}

// Business-count adapters shared by industry summaries and maps. Missing cells need evidence before becoming zero.

// Business Counts row for the industry: national table for Canada and provinces, local table for CMAs and CSDs.
export async function businessIndustry(place,code) {
  const local=['CSD','CMACA'].includes(place.type),geo=local||place.type==='PR'?place:parentProvince(place),cat=await catalog(),pair=tablePair(cat,local),nat=tablePair(cat,false);
  const level=String(code.length);
  const [cur,prev,ca]=await Promise.all([businessSlice(pair.current,geo,level),pair.previous?businessSlice(pair.previous,geo,level).catch(()=>null):null,businessSlice(nat.current,CANADA,level)]);
  const row=cur.rows.find(r=>r.code===code),before=prev?.rows.find(r=>r.code===code),natRow=ca.rows.find(r=>r.code===code);
  const tot=completeSum(cur.rows.map(r=>r.locations)),natTot=completeSum(ca.rows.map(r=>r.locations));
  return {geoName:local||place.type==='PR'?place.name:geo.name,table:pair.current,period:release(pair.current),prior:pair.previous?release(pair.previous):null,
    current:row?.locations??null,previous:before?.locations??null,N:row?.N??[],sizes:cur.sizes,lq:locationQuotient(row?.locations??null,tot,natRow?.locations??null,natTot)};
}

// One industry's locations per area. matched: [{g, member}] maps official geography to its table member; points
// are keyed by WDS coordinate. An omitted series is zero only when the area's classified total is zero.
export function businessMatrix(matched,points,industry,subtotal) {
  const at=(member,code)=>points.get(coord([member,1,code]))?.at(-1)?.value??null;
  return new Map(matched.map(({g,member})=>{
    const total=at(member.memberId,subtotal),n=at(member.memberId,industry);
    return [g.id,{name:g.name,total,values:[n??(total===0?0:null)]}];
  }));
}
// Locations in industry code by census subdivision of province scope, from the local Business Counts table.
export async function industryMap(scope,code) {
  const [{metadata:m,subtotal,table:t},{list}]=await Promise.all([businessBins(true),areas(scope)]);
  const it=m.dimension[2].member.find(x=>x.classificationCode===code);
  if(!it) throw new SourceError('unsupported','The local Business Counts table does not publish this industry.');
  const matched=list.map(g=>({g,member:geoMember(m.dimension[0],g)})).filter(x=>x.member);
  const data=await points(t.productId,matched.flatMap(({member})=>[coord([member.memberId,1,it.memberId]),coord([member.memberId,1,subtotal.memberId])]));
  return {table:t,matrix:businessMatrix(matched,data,it.memberId,subtotal.memberId),bins:[{id:it.memberId}]};
}

// ---------- Distribution-map sources ----------

// Areas of the map scope: provinces and territories for Canada, census subdivisions for a province.
export async function areas(scope) {
  const type=scope?'CSD':'PR',list=(await geographies(type)).filter(g=>g.id!==CANADA.id&&matchesProvince(g,scope));
  return {type,list};
}

async function censusMatrix(scope,spec) {
  const {type,list}=await areas(scope);
  const profiles=await censusMany(type,list.map(g=>g.id),[spec.total,...spec.bins.map(b=>b.id)]);
  return new Map(list.map(g=>{const p=profiles.get(g.id);return [g.id,{name:g.name,total:p?.value(spec.total)??null,values:spec.bins.map(b=>p?.value(b.id)??null)}];}));
}
// Business Counts by sector: the national table for Canada and provinces, the local table for CSDs and CMAs.
async function businessBins(local) {
  const pair=tablePair(await catalog(),local),m=await metadata(pair.current.productId);
  const naics=m.dimension[2].member,subtotal=naics.find(x=>x.classificationCode==='3');
  return {table:pair.current,metadata:m,subtotal,bins:naics.filter(x=>/^\d{2}(?:-\d{2})?$/.test(x.classificationCode??''))
    .map(s=>({id:String(s.memberId),name:label(s),code:s.classificationCode}))};
}
async function businessRows(geos,local) {
  const {metadata:m,bins,subtotal,table:t}=await businessBins(local);
  const matched=geos.map(g=>({g,member:geoMember(m.dimension[0],g)})).filter(x=>x.member);
  const keys=matched.flatMap(({member})=>[coord([member.memberId,1,subtotal.memberId]),...bins.map(b=>coord([member.memberId,1,Number(b.id)]))]);
  const data=await points(t.productId,keys),at=k=>data.get(k)?.at(-1)?.value??null;
  return new Map(matched.map(({g,member})=>{
    let values=bins.map(b=>at(coord([member.memberId,1,Number(b.id)])));const total=at(coord([member.memberId,1,subtotal.memberId]));
    // Omitted sector series are zero only when the published classified subtotal reconciles the row.
    if(total!=null&&values.reduce((s,v)=>s+(v??0),0)===total)values=values.map(v=>v??0);
    return [g.id,{name:g.name,total,values}];}));
}
export async function filterData(place,group,mapKey) {
  const spec=FILTERS[group].maps[mapKey],scope=provinceOf(place);
  if(spec.source==='business'){
    const {bins,table:t}=await businessBins(!!scope),{list}=await areas(scope);
    const national=place.type==='PR',local=['CSD','CMACA'].includes(place.type);
    const [matrix,own]=await Promise.all([businessRows(list,!!scope),
      national?businessRows([place],false):local?businessRows([place],true):Promise.resolve(new Map())]);
    return {spec:{...spec,bins},scope,matrix,own:own.get(place.id)??null,names:bins.map(b=>b.name),
      source:{source:`Statistics Canada, ${t.cubeTitleEn}`,url:table(t.productId),universe:spec.universe,period:release(t)}};
  }
  const [matrix,p]=await Promise.all([censusMatrix(scope,spec),census(place)]);
  return {spec,scope,matrix,own:{name:place.name,total:p.value(spec.total),values:spec.bins.map(b=>p.value(b.id))},
    names:spec.bins.map(b=>b.name??p.label(b.id)??b.id),
    source:{source:'Statistics Canada, Census Profile 2021',url:'https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm',universe:spec.universe,period:'Census 2021'}};
}

// Industries: SEPH 4-digit NAICS members (the industries ranked elsewhere on the page).
export async function industryList() {
  const m=await metadata(SEPH);
  return naics(m.dimension[2],'4').map(x=>({code:x.classificationCode,name:label(x),memberId:x.memberId})).sort((a,b)=>a.name.localeCompare(b.name));
}
// The most detailed published member for a NAICS code: the code itself, then 3-digit, then the sector.
function memberFor(dim,code) {
  const by=c=>dim.member.find(x=>(x.classificationCode??'').split('-')[0]===c||(x.classificationCode??'')===c);
  return by(code)??by(code.slice(0,3))??by(sectorOf(code))??dim.member.find(x=>{const [a,b]=(x.classificationCode??'').split('-');return b&&code.slice(0,2)>=a&&code.slice(0,2)<=b;});
}
export async function sephSeries(geo,code,n=25) {
  const {m,g,nd,key}=await sephFrame(geo),ind=nd.member.find(x=>x.classificationCode===code);
  if(!ind) throw new SourceError('unsupported','SEPH does not publish this industry.');
  const k=key(g.memberId,ind),d=await points(m.productId,[k],n);
  return {geoName:g.memberNameEn,values:(d.get(k)??[]).map(p=>({year:Number(p.refPer.slice(0,4)),value:p.value}))};
}
// Payroll jobs in industry code and its LQ in each province and territory against Canada, in SEPH's latest year.
export async function industryShares(code) {
  const {m,ca,nd,key}=await sephFrame(CANADA),agg=nd.member.find(x=>x.classificationCode==='00-91N'),it=nd.member.find(x=>x.classificationCode===code);
  if(!it) throw new SourceError('unsupported','SEPH does not publish this industry.');
  const G=PT.map(([c])=>provinceGeo(c)).map(g=>({g,x:geoMember(m.dimension[0],g)})).filter(({x})=>x);
  const d=await points(m.productId,[ca,...G.map(({x})=>x)].flatMap(x=>[key(x.memberId,agg),key(x.memberId,it)]),1);
  const v=(x,n)=>d.get(key(x.memberId,n))?.at(-1)?.value??null,E=v(ca,it),T=v(ca,agg);
  return {year:d.get(key(ca.memberId,agg))?.at(-1)?.refPer.slice(0,4),
    rows:G.map(({g,x})=>({name:g.name,jobs:v(x,it),lq:locationQuotient(v(x,it),v(x,agg),E,T)}))};
}
export async function industrySeries(pid,geo,code,select,n=12) {
  const m=await metadata(pid),dims=m.dimension,g=geoMember(dims[0],geo);if(!g) throw new SourceError('unsupported','This table does not publish the selected area.');
  const ind=memberFor(dims.at(-1),code);if(!ind) throw new SourceError('unsupported','This table does not publish a matching industry.');
  const chosen=[g,...dims.slice(1,-1).map(d=>d.member.find(x=>select.test(x.memberNameEn))??d.member[0]),ind];
  const k=coord(chosen.map(x=>x.memberId)),[d,u]=await Promise.all([points(m.productId,[k],n),units(chosen)]);
  return {geoName:g.memberNameEn,industry:label(ind),unit:u.unit,metadata:m,
    values:(d.get(k)??[]).map(p=>({year:Number(p.refPer.slice(0,4)),value:p.value==null?null:p.value*u.scale}))};
}
