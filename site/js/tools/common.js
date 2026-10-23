// Helpers shared by the tools: independent async slots, Census pairs and level-aware annual series.
import {census,annual,table,SourceError} from '../api.js';
import {CANADA,PT} from '../model.js';
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

// Annual tables by geography level. Each entry: table id, member selectors. Levels without a table return null.
const POPULATION={PR:['17100005',{'Gender':/^Total - gender$/,'Age group':/^All ages$/}],CSD:['17100155',{}],
  CMACA:['17100148',{'Gender':/^Total - gender$/,'Age group':/^All ages$/}],CD:['17100152',{'Gender':/^Total - gender$/,'Age group':/^All ages$/}],
  ER:['17100137',{'Sex':/^Both sexes$/,'Age group':/^All ages$/}]};
const LFS=['14100464'];
export const levelOf=place=>place.id===CANADA.id?'PR':place.type;
export async function populationSeries(place) {
  const spec=POPULATION[levelOf(place)];if(!spec) throw new SourceError('unsupported','Annual population estimates are not published for population centres.');
  return annual(spec[0],place,spec[1],16);
}
// Labour Force Survey annual averages: Canada, provinces and economic regions (14-10-0464).
export async function lfsSeries(place,indicator) {
  if(!['PR','ER'].includes(levelOf(place))) throw new SourceError('unsupported','Annual Labour Force Survey estimates are published for Canada, provinces, territories and economic regions.');
  return annual(LFS[0],place,{'Labour force characteristics':indicator},15);
}
// Tax-filer income series (11-10-0008 individuals, 11-10-0009 census families): Canada, provinces, CMAs and CAs.
export async function incomeSeries(place,kind) {
  if(!['PR','CMACA'].includes(levelOf(place))) throw new SourceError('unsupported','Annual tax-filer income is published for Canada, provinces, territories, metropolitan areas and agglomerations.');
  return kind==='family'?annual('11100009',place,{'Family characteristics':/^Median total income, all families$/},12)
    :annual('11100008',place,{'Sex':/^Both sexes$/,'Age group':/^All age groups$/,'Persons with income':/^Median total income$/},12);
}
export const tableMeta=(d,{title,universe,notes,period}={})=>({source:`Statistics Canada, table ${d.pid.replace(/(\d{2})(\d{2})(\d{4})/,'$1-$2-$3')}: ${d.metadata.cubeTitleEn}`,url:table(d.pid),
  geo:d.geoName,period:period??(d.values.length?`${d.values[0].year} to ${d.values.at(-1).year}`:''),universe,notes});
export const provinceName=code=>PT.find(p=>p[0]===code)?.[2]??'';
