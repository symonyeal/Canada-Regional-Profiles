// Shared-URL state. Every parameter has one validator and one default; defaults are omitted from URLs.
import {CANADA,geographyType,validGeographyId} from './model.js';

const one=(...values)=>({ok:v=>values.includes(v),fallback:values[0]});
const text=(re,fallback='')=>({ok:v=>re.test(v),fallback});
// Keys marked geo describe a facility or area inside the current geography and reset when it changes.
export const KEYS={
  bench:one('CA','PT'),
  pv:one('resident','workforce'), hv:one('household','dwelling','livability'),
  iv:one('largest','change','specialized'), is:one('all','traded','local'),
  cm:one('employment','population','participation','unemployment','income','rent','age'),
  peers:{ok:v=>v.split(',').length<=3&&v.split(',').every(x=>validGeographyId(x)&&geographyType(x)),fallback:'',geo:true},
  map:one('','market','explorer'),
  lg:one('air','road','port','rail','bb'), lgf:{...text(/^[\w.:-]{1,48}$/),geo:true}, lgd:one('60','30','0'),
  cp:one('economic','resident','household','dwelling','workforce','livability'), cpr:text(/^\d{1,2}-\d{1,2}$/), cph:text(/^\d{1,2}-\d{1,2}$/),
  stn:{...text(/^\d{1,7}$/),geo:true},
  exq:text(/^[^<>]{1,60}$/), ext:text(/^[^<>]{1,60}$/), exs:{...text(/^2021[AS]\d{6,15}$/),geo:true},
  mk:one('consumers','dwellings','businesses'), mkm:text(/^[a-z]{2,16}$/), mkr:text(/^[\d.-]{1,120}$/), mku:one('p','n'),
  wf:one('indicators','catchment'), wfm:text(/^[a-z]{2,16}$/), wfr:text(/^[\d.-]{1,120}$/), wfu:one('p','n'),
  ins:text(/^\d{2,6}$/), inst:one('trends','benchmarks','location'),
  fg:one('all','traded','local'), fgv:one('chart','list'),
  li:one('all','traded','local'), liv:one('bars','treemap','list'),
  tp:text(/^[\w.]{1,12}$/), tpk:one('1','2','3'), tpr:one('1','2','3'), tpi:{...text(/^\d{1,9}$/),geo:true},
};
export const SECTIONS=['overview','people','housing','industries','compare'];

export function parse(search,hash='') {
  const q=new URLSearchParams(search),id=q.get('geo')??CANADA.id;
  const geo=validGeographyId(id)&&geographyType(id)?{id,type:geographyType(id)}:{id:CANADA.id,type:'PR'};
  const t={};
  for(const [k,spec] of Object.entries(KEYS)){const v=q.get(k);t[k]=v!=null&&spec.ok(v)?v:spec.fallback;}
  const old=hash.replace('#','');
  const aliases={profile:['household','dwelling','livability'].includes(t.cp)?'housing':['resident','workforce'].includes(t.cp)?'people':'overview',
    workforce:'people',largest:'industries',growing:'industries',insights:'industries',market:'overview',explorer:'overview',logistics:'overview',talent:'people'};
  const section=SECTIONS.includes(old)?old:aliases[old]??'';
  if(old==='profile'&&section==='housing')t.hv=t.cp;
  if(old==='workforce'||old==='profile'&&t.cp==='workforce')t.pv='workforce';
  if(old==='growing')t.iv='change';
  if(old==='largest')t.is=t.li;
  if(old==='growing')t.is=t.fg;
  if(['market','explorer'].includes(old))t.map=old;
  return {geo,t,section};
}
export function serialize(state) {
  const q=new URLSearchParams();
  if(state.geo.id!==CANADA.id)q.set('geo',state.geo.id);
  for(const [k,spec] of Object.entries(KEYS))if(state.t[k]!=null&&state.t[k]!==spec.fallback)q.set(k,state.t[k]);
  const s=q.toString();return (s?`?${s}`:'')+(state.section?`#${state.section}`:'');
}
// A new geography keeps view choices but drops facility and area selections that belonged to the old one.
export function withGeography(state,geo) {
  const t={...state.t};for(const [k,spec] of Object.entries(KEYS))if(spec.geo)t[k]=spec.fallback;
  return {...state,geo:{id:geo.id,type:geo.type},t};
}
