// N: employer locations by size; e: midpoint estimate; E: national estimate. Missing stays null.
export const PT = [
  ['60','YT','Yukon'],['61','NT','Northwest Territories'],['62','NU','Nunavut'],
  ['59','BC','British Columbia'],['48','AB','Alberta'],['47','SK','Saskatchewan'],['46','MB','Manitoba'],
  ['35','ON','Ontario'],['24','QC','Quebec'],['13','NB','New Brunswick'],['12','NS','Nova Scotia'],
  ['11','PE','Prince Edward Island'],['10','NL','Newfoundland and Labrador'],
];
export const CANADA = {id:'2021A000011124',name:'Canada',type:'PR',province:''};
export const validGeographyId=id=>/^2021[AS]\d{6,15}$/.test(id);
export const LOWER=[1,5,10,20,50,100,200,500], UPPER=[4,9,19,49,99,199,499,Infinity];
export const MID=LOWER.map((x,i)=>i===7?x:(x+UPPER[i])/2);
export const numeric = x => x === '' || x == null || !Number.isFinite(Number(x)) ? null : Number(x);
export function estimate(N) {
  if(N.length!==8 || N.some(v=>v==null || !Number.isFinite(v))) return {value:null,lower:null,upper:null};
  const dot = a => N.reduce((s,n,i)=>s+n*a[i],0);
  return {value:dot(MID),lower:dot(LOWER),upper:N[7]>0?null:dot(UPPER.slice(0,7).concat(0))};
}
export function reconcileCounts(input,subtotals=[]) {
  const rows=input.map(r=>({...r,N:r.N.slice()}));
  for(const r of rows)if(r.total!=null&&r.N.reduce((s,v)=>s+(v??0),0)===r.total)r.N=r.N.map(v=>v??0);
  for(let j=0;j<8;j++)if(subtotals[j]!=null&&rows.reduce((s,r)=>s+(r.N[j]??0),0)===subtotals[j]) {
    for(const r of rows)if(r.N[j]==null)r.N[j]=0;
  }
  return rows.map(r=>({...r,locations:r.total??(r.N.every(v=>v!=null)?r.N.reduce((s,v)=>s+v,0):null)}));
}
export function locationQuotient(e,total,E,nationalTotal) {
  return [e,total,E,nationalTotal].some(v=>v==null) || total<=0 || E<=0 || nationalTotal<=0 ? null : (e/total)/(E/nationalTotal);
}
export function change(current,previous) {
  return {absolute:current==null||previous==null?null:current-previous,
    relative:current==null||previous==null||previous===0?null:current/previous-1};
}
export function rankIndustries(rows,metric='value') {
  const complete=rows.every(r=>r.value!=null && r.national!=null);
  const total=complete?rows.reduce((s,r)=>s+r.value,0):null, E=complete?rows.reduce((s,r)=>s+r.national,0):null;
  return rows.map(r=>({...r,lq:locationQuotient(r.value,total,r.national,E),...change(r.value,r.previous)}))
    .filter(r=>r[metric]!=null).sort((a,b)=>b[metric]-a[metric] || a.code.localeCompare(b.code));
}
export function matchesProvince(g,province) {
  if(!province) return true;
  return String(g.province??'').split('_').includes(province) || ['PR','CD','CSD'].includes(g.type) && g.id.slice(9,11)===province;
}
export class Profile {
  constructor(rows) {
    this.rows=rows; this.chars=new Map(); this.values=new Map();
    for(const r of rows) {
      this.chars.set(r.characteristic.id,{...r.characteristic,topic:r.topic,notes:r.notes});
      this.values.set(`${r.characteristic.id}/${r.gender.id}/${r.statistic.id}`,r.value);
    }
    this.area=rows[0]?.area; this.time=rows[0]?.time;
  }
  value(id,gender='1',stat='1') {return this.values.get(`${id}/${gender}/${stat}`)??null;}
  share(id,total,gender='1') {
    const a=this.value(id,gender),b=this.value(total,gender); return a==null||b==null||b<=0?null:100*a/b;
  }
  children(id) {return [...this.chars.values()].filter(c=>c.parent===String(id)).sort((a,b)=>a.order-b.order);}
  find(pattern) {return [...this.chars.values()].find(c=>pattern.test(c.name));}
}
export function csv(rows) {
  return '\ufeff'+rows.map(row=>row.map(v=>{
    let s=String(v??''); if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}
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
export const fmt=(v,unit='')=>v==null?'Not available':
  (unit==='$'?'$':'')+new Intl.NumberFormat('en-CA',{maximumFractionDigits:unit==='%'||unit==='years'?1:unit==='ratio'?2:unit==='$'?0:6}).format(v)
  +(unit==='%'?'%':unit==='years'?' years':'');
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
