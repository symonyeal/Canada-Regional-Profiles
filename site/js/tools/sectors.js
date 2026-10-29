// Resident labour-force exhibits share sector definitions and suppression rules. No requests or page state.
import {sectorBase} from '../regional-model.js';
import {int,pct,signed} from '../model.js';
import {h,chartCard,dataTable} from '../ui.js';
import {censusMeta} from './common.js';
const meta=(g,table,notes)=>({...censusMeta(g,{notes}),table});

// Resident workers' sectors against the benchmark: the three most over-represented and the mix difference D.
export function sectorHighlights(el,g,p,b,bench) {
  if(!b){el.replaceChildren();return;}
  const {rows,D}=sectorBase(p,b),top=rows.filter(r=>r.lq!=null&&r.s>=.02).sort((x,y)=>y.lq-x.lq).slice(0,3);
  if(!top.length){el.replaceChildren();return;}
  const t=()=>({headers:['Sector',`${g.name} workers`,`${g.name} share (%)`,`${bench.name} share (%)`,'LQ','Workers beyond benchmark share'],
    rows:rows.map(r=>[r.name,r.e,r.s==null?null:100*r.s,r.S==null?null:100*r.S,r.lq,r.excess]),numeric:new Set([1,2,3,4,5]),
    format:(v,i)=>i===0?v:i===2||i===3?pct(v):i===4?v.toFixed(2):int(v)});
  el.replaceChildren(chartCard({title:'What residents work in',
    subtitle:`Resident labour force by industry sector, Census 2021, against ${bench.name}.${D!=null?` ${pct(100*D,0)} of workers would have to change sector for the mix to match ${bench.name}.`:''}`,
    meta:meta(g,t,'LQ = sector share of the area’s labour force divided by the benchmark’s share. Workers beyond benchmark share = e − t·S. Mix difference D = ½ Σ |s − S| (Krugman 1991). Residents are counted where they live, not where they work.')},
    h('ol',{class:'base-list'},top.map(r=>h('li',{},h('strong',{},r.name),
      h('span',{},`${pct(100*r.s)} of resident workers, ${r.lq.toFixed(1)}× ${bench.name}’s share; ${int(r.excess)} more workers than that share implies.`))))));
}

export function residentSectors(el,g,p,b,bench) {
  const {rows,D}=sectorBase(p,b),list=rows.filter(r=>r.e!=null).sort((x,y)=>b?(y.lq??0)-(x.lq??0):y.e-x.e);
  const top=list.filter(r=>r.lq!=null).slice(0,3);
  const tbl=()=>({headers:['Sector','Workers','Share (%)',...(b?[`${bench.name} share (%)`,'LQ','Workers beyond benchmark share']:[])],
    rows:list.map(r=>[r.name,r.e,r.s==null?null:100*r.s,...(b?[r.S==null?null:100*r.S,r.lq,r.excess]:[])]),numeric:new Set([1,2,3,4,5]),
    format:(v,i)=>i===0?v:i===2||i===3?pct(v):i===4?v.toFixed(2):i===5?signed(v):int(v)});
  el.replaceChildren(chartCard({title:'Industry sectors of resident workers',subtitle:`Census 2021, by place of residence; ${b?`ranked by location quotient against ${bench.name}`:'ranked by workers'}.${D!=null?` Mix difference: ${pct(100*D,0)} of workers would have to change sector to match.`:''}`,
    meta:{...censusMeta(g,{universe:'Labour force aged 15+ with an industry (NAICS 2017 sectors)',notes:'LQ = the sector’s share here divided by its benchmark share. Mix difference D = ½ Σ |s − S| (Krugman 1991).'}),table:tbl}},
    top.length?h('p',{},h('strong',{},'Most over-represented:'),' ',top.map(r=>`${r.name} (${r.lq.toFixed(2)}×, ${signed(r.excess)} workers)`).join(', '),'.'):null,
    b&&list.some(r=>r.lq==null)?h('p',{class:'notice'},'Some sector comparisons are unavailable because a share is unpublished or the benchmark share is zero.'):null,
    h('details',{class:'remaining-sectors'},h('summary',{},`All ${list.length} sectors`),dataTable(tbl()))));
}
