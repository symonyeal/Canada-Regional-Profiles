// Annual series: common years and change over a chosen range. Pure calculation; missing observations stay missing.
//
// Legend
//   s         series: [{year, value}], value finite or null (suppressed, unpublished)
//   S         series of the areas compared; an area publishing no value at all is excluded, not intersected
//   Y         common years: years in which every included series has a finite value, ascending
//   [a, c]    chosen range, a ≤ c, both in Y
//   x0, x1    values at a and c
import {int,pct} from './model.js';

// Annual measures and their sources by geography level (PR also serves Canada). theme groups measures as in
// regional-model.js; period(y), when given, names year y's reference period. A source is {x, n}: each term
// is [table, selector] (Statistics Canada) or {oecd: dataflow, key, title} (OECD); the value is x, or x/n as a
// share (%) or rate (per 1,000). A level lists
// sources in order of preference and an area takes the first that publishes it. Census 2021 measures with the
// same concept but another source keep their own definitions; these are labelled by survey.
const pop=age=>({'Gender|Sex':/^Total - gender$|^Both sexes$/,'Age group':age});
const ALL=/^All ages$/,ESTIMATES={PR:'17100005',CMACA:'17100148',CD:'17100152',ER:'17100150'},LEVELS=Object.keys(ESTIMATES);
const estimates=age=>Object.fromEntries(LEVELS.map(l=>[l,[{x:[ESTIMATES[l],pop(age)]}]]));
const people=l=>[ESTIMATES[l],pop(ALL)];
const lfs=c=>({PR:[{x:['14100327',{'Labour force characteristics':c}]},{x:['14100464',{'Labour force characteristics':c}]}],
  ER:[{x:['14100464',{'Labour force characteristics':c}]}],CMACA:[{x:['14100461',{'Labour force characteristics':c}]}]});
const tax=(pid,selector)=>({PR:[{x:[pid,selector]}],CMACA:[{x:[pid,selector]}]});
const arrivals=l=>[{PR:'17100008',CMACA:'17100149',CD:'17100153',ER:'17100151'}[l],{'Components of population growth':/^Immigrants$/,'Gender|Sex':/^Total - gender$|^Both sexes$/,'Age group':ALL}];
export const TRENDS=[
  {id:'population',theme:'Population',label:'Population',unit:'people',survey:'Population estimates, July 1',
    source:{...estimates(ALL),CSD:[{x:['17100155',{}]}]}},
  {id:'age',theme:'Population',label:'Median age',unit:'years',survey:'Population estimates, July 1',source:estimates(/^Median age$/)},
  {id:'seniors',theme:'Population',label:'Residents aged 65 and over',unit:'%',survey:'Population estimates, July 1',
    source:Object.fromEntries(LEVELS.map(l=>[l,[{x:[people(l)[0],pop(/^65 years and older$/)],n:people(l)}]]))},
  {id:'immigration',theme:'People',label:'Immigrants admitted per 1,000 residents',unit:'per 1,000',survey:'Components of population change',period:y=>`${y}/${String(y+1).slice(2)}`,note:'Year y runs from July 1 of y to June 30 of y + 1; residents are counted on July 1 of y.',
    source:Object.fromEntries(LEVELS.map(l=>[l,[{x:arrivals(l),n:people(l)}]]))},
  {id:'employment',theme:'Work',label:'Employment rate, age 15+',unit:'%',survey:'Labour Force Survey, annual averages',note:'Not published annually for the territories or census agglomerations.',source:lfs(/^Employment rate$/)},
  {id:'unemployment',theme:'Work',label:'Unemployment rate',unit:'%',survey:'Labour Force Survey, annual averages',note:'Not published annually for the territories or census agglomerations.',source:lfs(/^Unemployment rate$/)},
  {id:'income',theme:'Income',label:'Median census family income',unit:'$',survey:'Tax filers, current dollars',
    source:tax('11100009',{'Family characteristics':/^Median total income, all families$/})},
  {id:'lowincome',theme:'Income',label:'Residents in low income (CFLIM-AT)',unit:'%',survey:'Tax filers',
    source:tax('11100018',{'Age group':/^All persons$/,'Statistics (CFLIM-AT; updated methodology)':/^Percentage of persons in low income$/})},
  {id:'rent',theme:'Housing',label:'Average rent, two-bedroom',unit:'$/month',survey:'CMHC Rental Market Survey, October',note:'Private row and apartment structures of three units and over; centres of 10,000 residents or more.',
    source:Object.fromEntries(['CMACA'].map(l=>[l,[{x:['34100133',{'Type of structure':/^Row and apartment structures of three units and over$/,'Type of unit':/^Two bedroom units$/}]}]]))},
  // OECD Regional Statistics. Canada's GDP, income, life expectancy and homicide figures are compiled from
  // Statistics Canada; air temperature is the ERA5 reanalysis (Copernicus) averaged over the region.
  {id:'gdp',theme:'Economy',label:'Real GDP per person',unit:'$',survey:'OECD regional accounts, constant prices',
    source:{PR:[{x:{oecd:'DSD_REG_ECO@DF_GDP',key:'GDP._T.Q.XDC_PS',title:'Gross domestic product, constant prices, per person'}}]}},
  {id:'disposable',theme:'Income',label:'Real household disposable income per person',unit:'$',survey:'OECD regional accounts, constant prices',
    source:{PR:[{x:{oecd:'DSD_REG_ECO@DF_INC',key:'B6N._T.Q.XDC_PS',title:'Household disposable income, net, constant prices, per person'}}]}},
  {id:'life',theme:'Health',label:'Life expectancy at birth',unit:'years',survey:'OECD regional demography',
    source:{PR:[{x:{oecd:'DSD_REG_DEMO@DF_LIFE_EXP',key:'LFEXP.Y0._T.Y',title:'Life expectancy at birth, total'}}]}},
  {id:'homicide',theme:'Safety',label:'Homicides per 100,000 residents',unit:'per 100,000',survey:'OECD regional well-being, safety',
    source:{PR:[{x:{oecd:'DSD_REG_SOC@DF_SAFETY',key:'HOMIC._T._T.CS_10P5PS',title:'Intentional homicides per 100,000 persons'}}]}},
  {id:'temperature',theme:'Climate',label:'Mean air temperature',unit:'°C',survey:'OECD regional climate, ERA5 reanalysis',fit:'slope',note:'Single years vary by a degree or more, so change is the least-squares trend over every year in the range, per decade.',
    source:Object.fromEntries(['PR','CD'].map(l=>[l,[{x:{oecd:'DSD_REG_CLIM@DF_AIR_TEMP',key:'AIR_TEMP2M._Z._Z._Z._Z.C',title:'Air temperature at 2 m, annual mean'}}]]))},
];
export const trend=id=>TRENDS.find(m=>m.id===id);
// Value of a source in one year from its terms' values; null unless every term is finite and n > 0.
export function combine(m,x,n) {
  if(!Number.isFinite(x))return null;if(n===undefined)return x;if(!Number.isFinite(n)||n<=0)return null;
  return (m.unit==='%'?100:1000)*x/n;
}

const finite=s=>new Map((s??[]).filter(p=>Number.isFinite(p.value)).map(p=>[p.year,p.value]));

// A calendar axis has one slot per year, including years the source omits entirely.
// Used by annual charts and their tables so missing periods cannot be compressed or bridged.
export function calendar(s,[a,c]) {
  const v=finite(s);
  return Array.from({length:c-a+1},(_,i)=>({year:a+i,value:v.get(a+i)??null}));
}

// Years in which every series that publishes anything has a finite value. Cost O(Σ|s|).
export function commonYears(S) {
  const F=S.map(finite).filter(m=>m.size);if(!F.length)return [];
  return [...F[0].keys()].filter(y=>F.every(m=>m.has(y))).sort((p,q)=>p-q);
}
// "2001-2025" → [2001, 2025]; anything else → null.
export function parseRange(text) {
  const m=/^(\d{4})-(\d{4})$/.exec(text??'');return m?[Number(m[1]),Number(m[2])]:null;
}
// The requested range snapped into Y: each end moves to the nearest common year, the ends are ordered, and a
// missing request takes all of Y. Null when Y is empty.
export function clampRange(Y,want) {
  if(!Y.length)return null;
  const near=t=>Y.reduce((b,y)=>Math.abs(y-t)<Math.abs(b-t)?y:b,Y[0]);
  if(!want)return [Y[0],Y.at(-1)];
  const [a,c]=want.map(near);return a<=c?[a,c]:[c,a];
}
export const rangeText=([a,c])=>a===c?String(a):`${a}–${c}`;

// Change of a series from a to c. Counts and money: percentage change and its compound annual rate;
// rates and shares: percentage points; ages: years.
// fit 'slope': d is the least-squares slope per decade over the finite years in [a, c] (at least three and both endpoints published), for
// series whose single years are dominated by noise.
export function change(s,[a,c],unit,fit) {
  const v=finite(s),x0=v.get(a)??null,x1=v.get(c)??null;
  if(fit==='slope'){
    const P=[...v].filter(([y])=>y>=a&&y<=c),n=P.length;if(n<3||x0==null||x1==null)return {x0,x1,d:null,rate:null};
    const ty=P.reduce((t,[y])=>t+y,0)/n,tx=P.reduce((t,[,x])=>t+x,0)/n;
    const sxy=P.reduce((t,[y,x])=>t+(y-ty)*(x-tx),0),syy=P.reduce((t,[y])=>t+(y-ty)**2,0);
    return {x0,x1,d:10*sxy/syy,rate:null,fit};
  }
  if(x0==null||x1==null)return {x0,x1,d:null,rate:null};
  const relative=unit==='people'||unit.startsWith('$'),n=c-a;
  const d=relative?(x0>0?100*(x1/x0-1):null):x1-x0;
  const rate=relative&&x0>0&&x1>0&&n>0?100*((x1/x0)**(1/n)-1):null;
  return {x0,x1,d,rate};
}
export function changeText(unit,{d,rate,fit}) {
  if(d==null)return 'Not available';
  const s=d>0?'+':d<0?'−':'',m=Math.abs(d);
  if(unit==='people'||unit.startsWith('$'))return `${s}${m.toFixed(1)}%${rate!=null?` (${rate>=0?'+':'−'}${Math.abs(rate).toFixed(1)}% a year)`:''}`;
  if(unit==='%')return `${s}${m.toFixed(1)} pp`;
  if(unit==='°C')return `${s}${m.toFixed(fit==='slope'?2:1)} °C${fit==='slope'?' per decade':''}`;
  return `${s}${m.toFixed(1)}${unit==='years'?' years':''}`;
}
// Latest standing: y is the last year s publishes; x, w and X are the values in y of s, the benchmark's series b
// and the cohort's series S (an entry null or missing y is null), so every comparison is same-period. The change
// runs from y0, the first year s publishes in [y − k, y), to y. Null when s publishes nothing.
export function latest(m,s,b,S,k=5) {
  const v=finite(s);if(!v.size)return null;
  const Y=[...v.keys()].sort((p,q)=>p-q),y=Y.at(-1),y0=Y.find(t=>t>=y-k&&t<y)??null,at=t=>t?finite(t).get(y)??null:null;
  return {y,y0,x:v.get(y),w:at(b),X:S?S.map(at):null,change:y0==null?null:change(s,[y0,y],m.unit,m.fit)};
}
export const valueText=(unit,x)=>x==null?'Not published':unit==='%'?pct(x):unit.startsWith('$')?`$${int(x)}`:unit==='years'?x.toFixed(1)
  :unit==='°C'?`${x.toFixed(1)} °C`:unit.startsWith('per ')?x.toFixed(1):int(x);
