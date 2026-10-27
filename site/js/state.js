// Shared-URL state. Every parameter has one validator and one default; defaults are omitted from URLs.
import {CANADA,geographyType,validGeographyId} from './model.js';
import {MEASURES} from './regional-model.js';
import {TRENDS} from './trend-model.js';

const DETAIL=['resident','workforce','household','dwelling','livability'];

const one=(...values)=>({ok:v=>values.includes(v),fallback:values[0]});
const text=(re,fallback='')=>({ok:v=>re.test(v),fallback});
// Keys marked geo describe a facility or area inside the current geography and reset when it changes.
export const KEYS={
  bench:one('CA','PT'),
  dv:one(...DETAIL),
  iv:one('specialized','largest','change'), is:one('all','traded','local'),
  cm:one('employment',...MEASURES.map(m=>m.id).filter(id=>id!=='employment'&&id!=='population')),
  pm:one('similar','near','chosen'),
  // Annual measure and year range "2001-2025"; the range snaps to the years published for the areas shown.
  tm:one(...TRENDS.map(m=>m.id)), yr:text(/^(19|20)\d\d-(19|20)\d\d$/), py:text(/^(19|20)\d\d-(19|20)\d\d$/),
  peers:{ok:v=>v.split(',').length<=3&&v.split(',').every(x=>validGeographyId(x)&&geographyType(x)),fallback:'',geo:true},
  map:one('','market','explorer'),
  exq:text(/^[^<>]{1,60}$/), ext:text(/^[^<>]{1,60}$/), exs:{...text(/^2021[AS]\d{6,15}$/),geo:true},
  mk:one('consumers','dwellings','businesses'), mkm:text(/^[a-z]{2,16}$/), mkr:text(/^[\d.-]{1,120}$/), mku:one('p','n'),
  ins:text(/^\d{2,6}$/), inst:one('trends','benchmarks','location'),
};
export const SECTIONS=['overview','industries','compare','detail'];

// Earlier sections and their view keys (cp, pv, hv; li, fg) route to the consolidated view that holds them.
export function parse(search,hash='') {
  const q=new URLSearchParams(search),id=q.get('geo')??CANADA.id;
  const geo=validGeographyId(id)&&geographyType(id)?{id,type:geographyType(id)}:{id:CANADA.id,type:'PR'};
  const t={};
  for(const [k,spec] of Object.entries(KEYS)){const v=q.get(k);t[k]=v!=null&&spec.ok(v)?v:spec.fallback;}
  const old=hash.replace('#',''),view=[q.get('cp'),q.get('pv'),q.get('hv'),old==='workforce'?'workforce':null].find(v=>DETAIL.includes(v));
  const aliases={profile:view?'detail':'overview',people:'detail',housing:'detail',workforce:'detail',
    largest:'industries',growing:'industries',insights:'industries',market:'overview',explorer:'overview',logistics:'overview',talent:'overview'};
  const section=SECTIONS.includes(old)?old:aliases[old]??'';
  if(section==='detail'&&!q.get('dv')&&view)t.dv=view;
  if(old==='growing')t.iv='change';
  if(old==='largest')t.iv='largest';
  if(['largest','growing'].includes(old)){const v=q.get(old==='largest'?'li':'fg');if(KEYS.is.ok(v))t.is=v;}
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
