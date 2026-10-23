// Pure calculations: no DOM, no network. Missing observations are null and stay null.
//
// Legend
//   N        employer locations by employment-size class, 8 classes (1-4 … 500+)
//   e, E     industry employment in the selected area and in Canada
//   t, T     the complete same-level totals that e and E belong to
//   LQ       location quotient (e/t)/(E/T)

export const PT=[
  ['60','YT','Yukon'],['61','NT','Northwest Territories'],['62','NU','Nunavut'],
  ['59','BC','British Columbia'],['48','AB','Alberta'],['47','SK','Saskatchewan'],['46','MB','Manitoba'],
  ['35','ON','Ontario'],['24','QC','Quebec'],['13','NB','New Brunswick'],['12','NS','Nova Scotia'],
  ['11','PE','Prince Edward Island'],['10','NL','Newfoundland and Labrador'],
];
export const CANADA={id:'2021A000011124',name:'Canada',type:'PR',province:''};

// Census 2021 DGUID schemas (vintage 2021, type A administrative / S statistical, schema code).
const SCHEMAS={A0000:'PR',A0002:'PR',A0003:'CD',A0005:'CSD',S0503:'CMACA',S0504:'CMACA',S0505:'CMACA',S0506:'CMACA',S0500:'ER',S0510:'POPCNTR'};
export const TYPES={PR:'Province or territory',CD:'Census division',CSD:'Census subdivision',CMACA:'Metropolitan area or agglomeration',
  ER:'Economic region',POPCNTR:'Population centre'};
export const validGeographyId=id=>/^2021[AS]\d{6,15}$/.test(id);
export const geographyType=id=>validGeographyId(id)?SCHEMAS[id.slice(4,9)]??null:null;
export const provinceOf=g=>g.id===CANADA.id?'':String(g.province||(['PR','CD','CSD'].includes(g.type)?g.id.slice(9,11):'')).split('_')[0];

export const numeric=x=>x===''||x==null||!Number.isFinite(Number(x))?null:Number(x);
export const completeSum=values=>values.length&&values.every(Number.isFinite)?values.reduce((a,v)=>a+v,0):null;

// Business Register size classes: lower and upper bounds; the open 500+ class is counted at 500.
export const LOWER=[1,5,10,20,50,100,200,500],UPPER=[4,9,19,49,99,199,499,Infinity];
export const MID=LOWER.map((x,i)=>i===7?x:(x+UPPER[i])/2);
export function estimate(N) {
  if(N.length!==8||N.some(v=>v==null||!Number.isFinite(v))) return {value:null,lower:null,upper:null};
  const dot=a=>N.reduce((s,n,i)=>s+n*a[i],0);
  return {value:dot(MID),lower:dot(LOWER),upper:N[7]>0?null:dot(UPPER.slice(0,7).concat(0))};
}
// WDS omits zero series. A missing class is zero only when a published total reconciles the row or column.
export function reconcileCounts(input,subtotals=[]) {
  const rows=input.map(r=>({...r,N:r.N.slice()}));
  for(const r of rows)if(r.total!=null&&r.N.reduce((s,v)=>s+(v??0),0)===r.total)r.N=r.N.map(v=>v??0);
  for(let j=0;j<8;j++)if(subtotals[j]!=null&&rows.reduce((s,r)=>s+(r.N[j]??0),0)===subtotals[j])
    for(const r of rows)if(r.N[j]==null)r.N[j]=0;
  return rows.map(r=>({...r,locations:r.total??(r.N.every(v=>v!=null)?r.N.reduce((s,v)=>s+v,0):null)}));
}
export function locationQuotient(e,t,E,T) {
  return [e,t,E,T].some(v=>v==null)||t<=0||E<=0||T<=0?null:(e/t)/(E/T);
}
export function change(current,previous) {
  return {absolute:current==null||previous==null?null:current-previous,
    relative:current==null||previous==null||previous===0?null:current/previous-1};
}
// Rank rows by a metric; t and T default to the complete partition when no published aggregate is given.
export function rankIndustries(rows,metric='value',totals={}) {
  const complete=rows.every(r=>r.value!=null&&r.national!=null);
  const t=totals.total??(complete?rows.reduce((s,r)=>s+r.value,0):null),T=totals.nationalTotal??(complete?rows.reduce((s,r)=>s+r.national,0):null);
  return rows.map(r=>({...r,lq:locationQuotient(r.value,t,r.national,T),...change(r.value,r.previous)}))
    .filter(r=>r[metric]!=null).sort((a,b)=>b[metric]-a[metric]||a.code.localeCompare(b.code));
}
export function matchesProvince(g,province) {
  if(!province) return true;
  return String(g.province??'').split('_').includes(province)||['PR','CD','CSD'].includes(g.type)&&g.id.slice(9,11)===province;
}

// Census Profile for one area: values keyed by characteristic, gender and statistic.
export class Profile {
  constructor(rows) {
    this.rows=rows;this.chars=new Map();this.values=new Map();
    for(const r of rows) {
      this.chars.set(r.characteristic.id,{...r.characteristic,topic:r.topic,notes:r.notes});
      this.values.set(`${r.characteristic.id}/${r.gender.id}/${r.statistic.id}`,r.value);
    }
    this.area=rows[0]?.area;this.time=rows[0]?.time;
  }
  value(id,gender='1',stat='1') {return this.values.get(`${id}/${gender}/${stat}`)??null;}
  share(id,total,gender='1') {const a=this.value(id,gender),b=this.value(total,gender);return a==null||b==null||b<=0?null:100*a/b;}
  sum(ids,gender='1') {return completeSum(ids.map(id=>this.value(id,gender)));}
  children(id) {return [...this.chars.values()].filter(c=>c.parent===String(id)).sort((a,b)=>a.order-b.order);}
  name(id) {return this.chars.get(String(id))?.name??null;}
}

export function csv(rows) {
  return '﻿'+rows.map(row=>row.map(v=>{
    let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}

// Traded/local: share of a code's US 2017 six-digit descendants in Delgado-Porter-Stern traded clusters.
export function tradedShare(code,US,traded) {
  const T=new Set(traded),sector=({'41':'42','91':'92'})[code.slice(0,2)]??code.slice(0,2);
  for(const prefix of [code.slice(0,5),code.slice(0,4),code.slice(0,3),sector]) {
    const matched=US.filter(c=>c.startsWith(prefix));if(matched.length)return matched.filter(c=>T.has(c)).length/matched.length;
  }return null;
}
export function classifyTrade(code,national,US,traded) {
  const [a,b]=code.split('-');
  const rows=national.filter(r=>b?r.code.slice(0,2)>=a&&r.code.slice(0,2)<=b:r.code.startsWith(code));
  if(!rows.length||rows.some(r=>r.value==null))return null;
  const values=rows.map(r=>tradedShare(r.code,US,traded));if(values.some(v=>v==null))return null;
  const total=rows.reduce((s,r)=>s+r.value,0),weights=rows.map(r=>total?r.value:1),w=weights.reduce((s,v)=>s+v,0);
  return values.reduce((s,v,i)=>s+v*weights[i],0)/w>=.5;
}

// Selected bins of one marginal distribution: total and target need every component.
export function binCounts(values,on) {
  const total=values.some(v=>v==null)?null:values.reduce((s,v)=>s+v,0),selected=values.filter((_,i)=>on[i]);
  return {total,target:selected.some(v=>v==null)?null:selected.reduce((s,v)=>s+v,0)};
}
// Jenks natural breaks (Fisher 1958 dynamic programme). Returns k+1 class limits, k capped by distinct values.
export function jenks(values,k=6) {
  const x=values.filter(v=>v!=null&&Number.isFinite(v)).sort((a,b)=>a-b),n=x.length;
  if(!n)return [];k=Math.min(k,new Set(x).size);if(k<2)return [x[0],x.at(-1)];
  const L=Array.from({length:n+1},()=>Array(k+1).fill(0)),V=Array.from({length:n+1},()=>Array(k+1).fill(Infinity));
  for(let j=1;j<=k;j++){L[1][j]=1;V[1][j]=0;}
  for(let l=2;l<=n;l++){let s1=0,s2=0,w=0,v=0;
    for(let m=1;m<=l;m++){const i=l-m+1,value=x[i-1];s2+=value*value;s1+=value;w++;v=s2-s1*s1/w;
      if(i!==1)for(let j=2;j<=k;j++)if(V[l][j]>=v+V[i-1][j-1]){L[l][j]=i;V[l][j]=v+V[i-1][j-1];}}
    L[l][1]=1;V[l][1]=v;
  }
  const b=Array(k+1);b[k]=x.at(-1);b[0]=x[0];
  for(let j=k,c=n;j>=2;j--){b[j-1]=x[L[c][j]-2];c=L[c][j]-1;}return b;
}

// Squarified treemap (Bruls, Huizing and van Wijk 2000). Values must be positive and sorted descending.
// Returns one rectangle per value, in input order, tiling (x,y,w,h) with areas proportional to the values.
export function squarify(values,x,y,w,h) {
  const total=values.reduce((s,v)=>s+v,0),out=[];
  if(!values.length||total<=0||w<=0||h<=0) return values.map(()=>({x,y,w:0,h:0}));
  const a=values.map(v=>v*w*h/total);
  const worst=(row,s)=>{const r=row.reduce((p,v)=>p+v,0),mx=Math.max(...row),mn=Math.min(...row);return Math.max(s*s*mx/(r*r),r*r/(s*s*mn));};
  let i=0;
  while(i<a.length) {
    const s=Math.min(w,h),row=[a[i]];let j=i+1;
    while(j<a.length&&worst([...row,a[j]],s)<=worst(row,s))row.push(a[j++]);
    const r=row.reduce((p,v)=>p+v,0),thick=r/s;let offset=0;
    for(const v of row) {
      const len=v/thick;
      out.push(w>=h?{x,y:y+offset,w:thick,h:len}:{x:x+offset,y,w:len,h:thick});offset+=len;
    }
    if(w>=h){x+=thick;w-=thick;}else{y+=thick;h-=thick;}
    i=j;
  }
  return out;
}

// Heckbert's nice numbers: tick step 1, 2 or 5 × 10^k covering [lo, hi] in about n intervals.
export function niceTicks(lo,hi,n=5) {
  if(!(hi>lo)){hi=lo+1;}
  const nice=(x,round)=>{const e=10**Math.floor(Math.log10(x)),f=x/e;
    return e*(round?(f<1.5?1:f<3?2:f<7?5:10):(f<=1?1:f<=2?2:f<=5?5:10));};
  const step=nice(nice(hi-lo,false)/n,true),start=Math.floor(lo/step)*step,ticks=[];
  for(let v=start;v<=hi+step*1e-9;v+=step)ticks.push(Math.round(v/step)*step);
  if(ticks.at(-1)<hi)ticks.push(ticks.at(-1)+step);
  return ticks;
}

// Number formats. fmt keeps published precision; compact follows the reference's "0.0a".
const nf=(d=0)=>new Intl.NumberFormat('en-CA',{maximumFractionDigits:d,minimumFractionDigits:0});
export const fmt=(v,unit='')=>v==null?'Not available':
  (unit==='$'?'$':'')+nf(unit==='%'||unit==='years'?1:unit==='ratio'?2:unit==='$'?0:6).format(v)
  +(unit==='%'?'%':unit==='years'?' years':'');
export const int=v=>v==null?'–':nf(0).format(Math.round(v));
export const pct=(v,d=1)=>v==null?'–':`${v.toFixed(d)}%`;
export function compact(v,prefix='') {
  if(v==null)return '–';
  const a=Math.abs(v),sign=v<0?'-':'';
  for(const [k,u] of [[1e9,'B'],[1e6,'M'],[1e3,'K']])if(a>=k)return `${sign}${prefix}${(a/k).toFixed(1)}${u}`;
  return `${sign}${prefix}${nf(0).format(a)}`;
}
export const signed=v=>v==null?'–':(v>0?'+':'')+nf(0).format(Math.round(v));

// Linear sRGB interpolation between hex colours; ramp(n) returns n evenly spaced colours.
const hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
export function mix(a,b,t) {const p=hex(a),q=hex(b);return '#'+p.map((v,i)=>Math.round(v+(q[i]-v)*t).toString(16).padStart(2,'0')).join('');}
export function ramp(stops,n) {
  if(n<=1)return [stops[0]];
  return Array.from({length:n},(_,i)=>{const t=i/(n-1)*(stops.length-1),k=Math.min(stops.length-2,Math.floor(t));return mix(stops[k],stops[k+1],t-k);});
}
// Relative luminance (WCAG 2.x) decides label ink on filled marks.
export function luminance(c) {
  return hex(c).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
}

// NAICS sectors: 31-33, 44-45 and 48-49 are single sectors.
export const sectorOf=code=>({'31':'31-33','32':'31-33','33':'31-33','44':'44-45','45':'44-45','48':'48-49','49':'48-49'})[code.slice(0,2)]??code.slice(0,2);
export const SECTORS={'11':'Agriculture, forestry, fishing and hunting','21':'Mining, quarrying, and oil and gas extraction','22':'Utilities',
  '23':'Construction','31-33':'Manufacturing','41':'Wholesale trade','44-45':'Retail trade','48-49':'Transportation and warehousing',
  '51':'Information and cultural industries','52':'Finance and insurance','53':'Real estate and rental and leasing',
  '54':'Professional, scientific and technical services','55':'Management of companies and enterprises',
  '56':'Administrative and support, waste management and remediation services','61':'Educational services',
  '62':'Health care and social assistance','71':'Arts, entertainment and recreation','72':'Accommodation and food services',
  '81':'Other services (except public administration)','91':'Public administration'};
