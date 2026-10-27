// Helpers shared by the tools: independent async slots, Census pairs and level-aware annual series.
import {census,censusMany,annual,history,oecdHistory,oecdExplorer,table,memoRequest,SourceError} from '../api.js';
import {trend,combine} from '../trend-model.js';
import {CANADA,PT,provinceOf,matchesProvince} from '../model.js';
import {MEASURE_IDS} from '../regional-model.js';
import {loading,failure,h} from '../ui.js';

// A generation counter per tool: work started for an older selection never draws.
export function lifetime(el) {
  let gen=0;
  return {next(){const g=++gen;return ()=>g===gen&&el.isConnected;}};
}
// Run fn(el) into its own element with loading and retry states; one slot failing never blocks another.
export function slot(el,fn,{text,context,alive=()=>true}={}) {
  // Unpublished combinations are a normal state, shown plainly; other failures get the error state and Retry.
  const run=async()=>{loading(el,text);try{await fn(el);}catch(e){if(!alive()||!el.isConnected)return;
    if(e?.kind==='unsupported')el.replaceChildren(h('section',{class:'card unpublished'},h('h4',{},context??'Not published'),h('p',{class:'card-sub'},e.message)));
    else {console.warn(context??'slot',e);failure(el,e,run,context);}}};
  run();return el;
}
// Selected area's and benchmark's profiles. The benchmark may fail without hiding the selected values.
export async function pair(place,bench) {
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
export const tableId=pid=>String(pid).replace(/(\d{2})(\d{2})(\d{4})/,'$1-$2-$3');
export const tableMeta=(d,{title,universe,notes,period}={})=>({source:`Statistics Canada, table ${tableId(d.pid)}: ${d.metadata.cubeTitleEn}`,url:table(d.pid),
  geo:d.geoName,period:period??(f=>f.length?`${f[0].year} to ${f.at(-1).year}`:'')(d.values.filter(v=>v.value!=null)),universe,notes});
export const provinceName=code=>PT.find(p=>p[0]===code)?.[2]??'';

// The cohort an area is ranked among: the province's census subdivisions with at least 1,000 residents (smaller
// counts are dominated by Census random rounding) or its census divisions; all metropolitan areas and
// agglomerations (whole areas, not provincial parts), economic regions or population centres; the thirteen
// provinces and territories for a province, territory or Canada. The selected area joins its cohort when outside it.
// cohortAreas returns {label, areas}; cohort adds P, P[i] the measure profile of areas[i] or null.
const cohorts=new Map();
export const clearCohorts=()=>cohorts.clear();
export async function cohortAreas(g,placeList) {
  const pr=provinceOf(g),local=['CSD','CD'].includes(g.type),where=provinceName(pr);
  if(g.id===CANADA.id||g.type==='PR')return {label:'provinces and territories',areas:PT.map(([c,,name])=>({id:`2021A0002${c}`,type:'PR',name,province:c}))};
  const areas=(await placeList(g.type)).filter(a=>local?matchesProvince(a,pr)&&(g.type!=='CSD'||(a.population??0)>=1000):g.type!=='CMACA'||/^2021S050[34]/.test(a.id));
  if(!areas.some(a=>a.id===g.id))areas.push({...g});
  return {areas,label:{CSD:`${where} municipalities with 1,000+ residents`,CD:`census divisions in ${where}`,CMACA:'metropolitan areas and agglomerations',
    ER:'economic regions',POPCNTR:'population centres'}[g.type]};
}
export function cohort(g,placeList) {
  const national=g.id===CANADA.id||g.type==='PR',key=national?'PR':['CSD','CD'].includes(g.type)?`${g.type}:${provinceOf(g)}`:g.type;
  return memoRequest(cohorts,`${key}:${g.id}`,async()=>{
    const {label,areas}=await cohortAreas(g,placeList),P=await censusMany(national?'PR':g.type,areas.map(a=>a.id),MEASURE_IDS);
    return {label,areas,P:areas.map(a=>P.get(a.id)?.rows.length?P.get(a.id):null)};
  });
}
