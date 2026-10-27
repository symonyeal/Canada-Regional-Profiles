// Regional comparisons. Legend: p,b = selected/benchmark Census profiles; m = measure;
// v,w = their observations; r = industry row. Missing observations stay missing.
import {int,pct,fmt,geographyType,CANADA} from './model.js';

export const MEASURES=[
  {id:'population',label:'Population',char:'1',unit:'people',period:'2021',format:int},
  {id:'growth',label:'Population change',char:'3',unit:'%',period:'2016–2021',format:pct},
  {id:'employment',label:'Employment rate, age 15+',char:'2229',unit:'%',period:'2021',format:pct},
  {id:'participation',label:'Participation rate, age 15+',char:'2228',unit:'%',period:'2021',format:pct},
  {id:'unemployment',label:'Unemployment rate, labour force 15+',char:'2230',unit:'%',period:'2021',format:pct},
  {id:'income',label:'Median household income',char:'229',unit:'$',period:'2020 income',format:v=>`$${int(v)}`},
  {id:'rent',label:'Median monthly tenant shelter costs',char:'1480',unit:'$/month',period:'2021',format:v=>`$${int(v)}`},
  {id:'age',label:'Median age',char:'40',unit:'years',period:'2021',format:v=>fmt(v)},
];
export const show=(m,v)=>v==null?'Not published':m.format(v);
export function difference(m,v,w) {
  if(v==null||w==null)return 'Not available';
  const d=v-w,s=d>0?'+':d<0?'−':'';
  if(m.unit==='%')return `${s}${Math.abs(d).toFixed(1)} pp`;
  if(m.unit.startsWith('$'))return `${s}$${int(Math.abs(d))}${m.unit.includes('month')?' /month':''}`;
  return `${s}${fmt(Math.abs(d))}${m.unit==='years'?' years':''}`;
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
