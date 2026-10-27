// Regional findings: pure calculation on Census profiles and payroll series. Missing observations stay missing.
//
// Legend
//   p, b      selected and benchmark Census profiles; P the cohort: profiles of same-level areas
//   m         measure; x = m(p), w = m(b), X = m over P
//   q         mid-distribution function of x in X: share of X below x plus half the ties, in [0, 1]
//   s, S      sector shares of resident workers here and in the benchmark; LQ = s/S
//   e, E      payroll jobs here and in Canada; 0 base year, 1 latest year; G national growth rate
import {int,pct,fmt,geographyType,CANADA} from './model.js';

const v=id=>p=>p.value(id);
const share=(a,t)=>p=>{const x=p.value(a),n=p.value(t);return x==null||n==null||n<=0?null:100*x/n;};
const dollars=x=>`$${int(x)}`;

// Census 2021 characteristics behind each measure; rates and medians are published, shares divide two counts.
// theme groups measures for the headline: one finding per theme.
export const MEASURES=[
  {id:'population',label:'Population',unit:'people',period:'2021',of:v('1'),ids:['1'],format:int},
  {id:'growth',label:'Population growth',theme:'Population',unit:'%',period:'2016–2021',of:v('3'),ids:['3'],format:pct},
  {id:'age',label:'Median age',theme:'Population',unit:'years',period:'2021',of:v('40'),ids:['40'],format:x=>fmt(x)},
  {id:'seniors',label:'Residents aged 65 and over',theme:'Population',unit:'%',period:'2021',of:v('37'),ids:['37'],format:pct},
  {id:'employment',label:'Employment rate, age 15+',theme:'Work',unit:'%',period:'2021',of:v('2229'),ids:['2229'],format:pct},
  {id:'unemployment',label:'Unemployment rate',theme:'Work',unit:'%',period:'2021',of:v('2230'),ids:['2230'],format:pct},
  {id:'degree',label:'Bachelor’s degree or higher, age 25–64',theme:'Work',unit:'%',period:'2021',of:share('2024','2014'),ids:['2024','2014'],format:pct},
  {id:'income',label:'Median household income',theme:'Income',unit:'$',period:'2020 income',of:v('229'),ids:['229'],format:dollars},
  {id:'lowincome',label:'Residents in low income (LIM-AT)',theme:'Income',unit:'%',period:'2020 income',of:v('331'),ids:['331'],format:pct},
  {id:'burden',label:'Tenants spending 30%+ of income on shelter',theme:'Housing',unit:'%',period:'2021',of:v('1478'),ids:['1478'],format:pct},
  {id:'coreneed',label:'Households in core housing need',theme:'Housing',unit:'%',period:'2021',of:share('1466','1465'),ids:['1466','1465'],format:pct},
  {id:'value',label:'Median dwelling value, owners',theme:'Housing',unit:'$',period:'2021',of:v('1474'),ids:['1474'],format:dollars},
  {id:'rent',label:'Median monthly tenant shelter costs',theme:'Housing',unit:'$/month',period:'2021',of:v('1480'),ids:['1480'],format:dollars},
  {id:'renters',label:'Renter households',theme:'Housing',unit:'%',period:'2021',of:share('1402','1400'),ids:['1402','1400'],format:pct},
  {id:'newbuild',label:'Dwellings built 2016–2021',theme:'Housing',unit:'%',period:'2021',of:share('1434','1426'),ids:['1434','1426'],format:pct},
  {id:'repairs',label:'Dwellings needing major repairs',theme:'Housing',unit:'%',period:'2021',of:share('1437','1435'),ids:['1437','1435'],format:pct},
  {id:'immigrants',label:'Immigrants',theme:'People',unit:'%',period:'2021',of:share('1515','1513'),ids:['1515','1513'],format:pct},
  {id:'recent',label:'Immigrants arrived 2016–2021',theme:'People',unit:'%',period:'2021',of:share('1522','1513'),ids:['1522','1513'],format:pct},
  {id:'indigenous',label:'Indigenous identity',theme:'People',unit:'%',period:'2021',of:share('1389','1388'),ids:['1389','1388'],format:pct},
  {id:'commuters',label:'Commuters working in another municipality',theme:'Commuting',unit:'%',period:'2021',
    of:p=>{const x=share('2599','2598')(p);return x==null?null:100-x;},ids:['2599','2598'],format:pct},
  {id:'transit',label:'Commuters using public transit',theme:'Commuting',unit:'%',period:'2021',of:share('2607','2603'),ids:['2607','2603'],format:pct},
];
export const MEASURE_IDS=[...new Set(MEASURES.flatMap(m=>m.ids))];
export const measure=id=>MEASURES.find(m=>m.id===id);
export const show=(m,x)=>x==null?'Not published':m.format(x);
export function difference(m,x,w) {
  if(x==null||w==null)return 'Not available';
  const d=x-w,s=d>0?'+':d<0?'−':'';
  if(m.unit==='%')return `${s}${Math.abs(d).toFixed(1)} pp`;
  if(m.unit.startsWith('$'))return `${s}$${int(Math.abs(d))}${m.unit.includes('month')?' /month':''}`;
  return `${s}${fmt(Math.abs(d))}${m.unit==='years'?' years':''}`;
}

// Standing of x in X: q, rank from the highest (ties share the better rank) and n, over published values only.
export function standing(x,X) {
  const Y=X.filter(Number.isFinite);if(x==null||!Y.length)return null;
  let below=0,tie=0;for(const y of Y){if(y<x)below++;else if(y===x)tie++;}
  return {q:(below+tie/2)/Y.length,high:Y.length-below-tie+1,low:below+1,n:Y.length};
}
const ordinal=k=>`${k}${k%100>=11&&k%100<=13?'th':['th','st','nd','rd'][k%10]??'th'}`;
// "3rd highest of 148", "highest of 148"; null without a standing.
export function rankText(s) {
  if(!s)return null;
  const [k,side]=s.q>=.5?[s.high,'highest']:[s.low,'lowest'];
  return `${k===1?'':`${ordinal(k)} `}${side} of ${s.n}`;
}

// Findings for p against benchmark b and cohort P. Each measure gets x, w, its standing and a distinctiveness d:
// |q − ½| for an area within its cohort; for Canada (national), the cohort's coefficient of variation, so the
// headline names the measures on which provinces differ most. The headline keeps the most distinctive measure of
// each theme, ordered by d; without a cohort d is null and the order is that of MEASURES.
export function findings(p,b,P,{national=false}={}) {
  const rows=MEASURES.filter(m=>m.theme).map(m=>{
    const x=m.of(p),w=b?m.of(b):null,X=P?P.map(q=>q?m.of(q):null):null,s=X&&!national?standing(x,X):null;
    const Y=X?.filter(Number.isFinite)??[],mu=Y.reduce((a,y)=>a+y,0)/Y.length,sd=Math.sqrt(Y.reduce((a,y)=>a+(y-mu)**2,0)/Y.length);
    const d=national?(Y.length>1&&mu!==0?sd/Math.abs(mu):null):s?Math.abs(s.q-.5):null;
    return {m,x,w,X,standing:s,d};
  }).filter(r=>r.x!=null);
  const by=(a,c)=>(c.d??-1)-(a.d??-1);
  const best=new Map();for(const r of rows.slice().sort(by))if(!best.has(r.m.theme))best.set(r.m.theme,r);
  return {rows,headline:[...best.values()].sort(by)};
}

// The k areas nearest to P[i] on the features below, standardised within the cohort (z-scores; population and
// income on a log scale). Distance is root mean square over the features both areas publish; an area publishing
// fewer than two thirds of them is not compared. Cost O(n·f) for n areas and f features.
export const SIMILAR=['population','growth','age','employment','income','renters','degree','immigrants','indigenous'];
export function similar(P,i,k=5) {
  const f=SIMILAR.map(measure),log=new Set(['population','income']);
  const raw=P.map(p=>f.map(m=>{const x=p?m.of(p):null;return x==null||log.has(m.id)&&x<=0?null:log.has(m.id)?Math.log(x):x;}));
  const z=f.map((_,j)=>{const Y=raw.map(r=>r[j]).filter(x=>x!=null),mu=Y.reduce((a,y)=>a+y,0)/Y.length,
    sd=Math.sqrt(Y.reduce((a,y)=>a+(y-mu)**2,0)/Y.length)||1;return x=>x==null?null:(x-mu)/sd;});
  const Z=raw.map(r=>r.map((x,j)=>z[j](x))),need=Math.ceil(2*f.length/3);
  const out=[];
  for(let j=0;j<Z.length;j++){if(j===i)continue;let s=0,c=0;
    for(let t=0;t<f.length;t++)if(Z[i][t]!=null&&Z[j][t]!=null){s+=(Z[i][t]-Z[j][t])**2;c++;}
    if(c>=need)out.push({j,distance:Math.sqrt(s/c)});}
  return out.sort((a,c)=>a.distance-c.distance).slice(0,k);
}

// Economic base from the Census labour force by industry sector (NAICS 2017, 20 sectors under total 2261):
// shares s and S, LQ = s/S, and the workers beyond the benchmark's share, e − t·S. D = ½ Σ|s − S| is the share of
// workers who would have to change sector for the mix to match the benchmark (Krugman 1991); null if any sector is
// unpublished.
export const SECTOR_IDS=Array.from({length:20},(_,i)=>String(2262+i));
export function sectorBase(p,b) {
  const t=p.value('2261'),T=b?.value('2261');
  const rows=SECTOR_IDS.map(id=>{const e=p.value(id),E=b?.value(id),s=e!=null&&t>0?e/t:null,S=E!=null&&T>0?E/T:null;
    return {id,name:(p.name(id)??id).replace(/^\d+(-\d+)? /,''),e,s,S,lq:s!=null&&S>0?s/S:null,excess:s!=null&&S!=null?e-t*S:null};});
  const D=rows.every(r=>r.s!=null&&r.S!=null)?rows.reduce((a,r)=>a+Math.abs(r.s-r.S),0)/2:null;
  return {rows,t,D};
}

// Shift-share decomposition of payroll job change (Dunn 1960). For a sector with e0, e1, E0, E1 published:
//   national share NS = e0·G,  industry mix IM = e0·(G_i − G),  regional shift RS = e0·(g_i − G_i),
// so NS + IM + RS = e1 − e0. Totals: NS on the area's aggregate, IM and RS summed over published sectors; the
// remainder of the aggregate's change, "unattributed", is the change of unpublished sectors beyond NS.
export function shiftShare(rows,agg) {
  const G=agg.E0>0&&agg.E1!=null?agg.E1/agg.E0-1:null;
  const out=rows.map(r=>{
    if(G==null||[r.e0,r.e1,r.E0,r.E1].some(x=>x==null)||r.e0<=0||r.E0<=0)return {...r,change:null,NS:null,IM:null,RS:null};
    const Gi=r.E1/r.E0-1,g=r.e1/r.e0-1;
    return {...r,change:r.e1-r.e0,NS:r.e0*G,IM:r.e0*(Gi-G),RS:r.e0*(g-Gi)};
  });
  const sum=k=>out.reduce((a,r)=>a+(r[k]??0),0),change=agg.e0==null||agg.e1==null?null:agg.e1-agg.e0;
  const NS=G==null||agg.e0==null?null:agg.e0*G,IM=sum('IM'),RS=sum('RS');
  return {rows:out,G,change,NS,IM,RS,unattributed:change==null||NS==null?null:change-NS-IM-RS,published:out.filter(r=>r.change!=null).length};
}

// A peer must have the selected geography level; Canada is a benchmark, not a provincial peer.
export function peerIds(text,geo) {
  return [...new Set(String(text).split(','))].filter(id=>id!==geo.id&&id!==CANADA.id&&geographyType(id)===geo.type).slice(0,3);
}
export function industryRows(rows,view,set='all') {
  const a=rows.filter(r=>set==='all'||(set==='traded'?r.traded===true:r.traded===false));
  const order=k=>(x,y)=>y[k]-x[k]||x.code.localeCompare(y.code);
  if(view==='change'){
    const known=a.filter(r=>r.absolute!=null);
    const gains=known.filter(r=>r.absolute>=0).sort(order('absolute')).slice(0,10);
    const losses=known.filter(r=>r.absolute<0).sort((x,y)=>x.absolute-y.absolute||x.code.localeCompare(y.code)).slice(0,10);
    return [...gains,...losses];
  }
  const k=view==='specialized'?'lq':'value';
  return a.filter(r=>r[k]!=null).sort(order(k)).slice(0,20);
}
