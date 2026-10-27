// Industry workspace. Legend: d = source dataset; r = industry; v = view;
// x = displayed measure; z = bar scale. Payroll and size-class estimates stay distinct.
import {CANADA,int,pct,signed} from '../model.js';
import {industryRows} from '../regional-model.js';
import {h,segmented,exhibitMenu,loading,failure} from '../ui.js';
import {industryCache} from './industries.js';
import {insights} from './insights.js';
import {lifetime} from './common.js';

const VIEWS=[['largest','Largest'],['change','Job gains and losses'],['specialized','Specialization']];
export function industries(el,app) {
  const life=lifetime(el),root=h('div',{class:'industry-brief'}),detailHost=h('div');
  el.append(root,detailHost);const detail=insights(detailHost,app,{banner:false});
  async function render() {
    const a=life.next(),g=await app.resolved();if(!a())return;
    const v=app.state.t.iv,set=app.state.t.is;
    const filter=h('select',{'aria-label':'Industry set'},[['all','All industries'],['traded','Traded (approximate)'],['local','Local (approximate)']].map(([k,label])=>{const o=new Option(label,k);o.selected=k===set;return o;}));
    filter.onchange=()=>{app.set('is',filter.value);render();};
    const body=h('div'),tools=h('div',{class:'industry-toolbar'},segmented(VIEWS,v,k=>{app.set('iv',k);render();},'Industry view'),
      h('label',{class:'field'},h('span',{},'Industry set'),filter),h('button',{type:'button',class:'btn ghost',onclick:e=>detail.open('',e.currentTarget)},'Find an industry'));
    root.replaceChildren(tools,body);loading(body,'Querying industry employment…');
    let d;try {d=await industryCache.data(g);}catch(e){if(!a())return;failure(body,e,()=>{industryCache.clear();render();},'Industry employment unavailable');
      if(e.kind==='unsupported'&&g.province)body.append(h('button',{type:'button',class:'btn ghost',onclick:()=>app.choose({id:`2021A0002${String(g.province).split('_')[0]}`,type:'PR'},'industries')},'View provincial industries'));
      return;
    }
    if(!a())return;
    if(v==='specialized'&&g.id===CANADA.id){body.replaceChildren(h('div',{class:'national-specialization'},h('h3',{},'Compare an industry across provinces and territories'),
      h('p',{},'Specialization compares a region’s employment share with Canada’s share. Canada compared with itself is always 1. Choose an industry, then open Benchmarks to see regional differences.'),
      h('button',{class:'btn',type:'button',onclick:e=>detail.open('',e.currentTarget)},'Choose an industry')));return;}
    const rows=industryRows(d.rows,v,set),unit=d.estimate?'estimated employees':'payroll jobs';
    const headers=['Industry',`${d.year} ${unit}`,`${d.prior??'Earlier'} ${unit}`,'Job change','Change (%)',...(g.id!==CANADA.id?['Employment LQ']:[])];
    const data=()=>({headers,rows:rows.map(r=>[r.name,r.value,r.previous,r.absolute,r.relative==null?null:100*r.relative,...(g.id!==CANADA.id?[r.lq]:[])]),numeric:new Set([1,2,3,4,5]),format:(x,i)=>i===4?pct(x):i===5?x.toFixed(2):typeof x==='number'?int(x):x});
    const title=v==='largest'?'Industries with the most published employment':v==='change'?'Industries adding and losing the most jobs':'Industries more concentrated here than across Canada';
    const subtitle=d.estimate?`${g.name} · ${d.source.period}. Estimates from employer size classes; not payroll counts.`:`${g.name} · ${d.year} annual payroll employment; change since ${d.prior}.`;
    body.replaceChildren(h('div',{class:'industry-chart-head'},h('div',{},h('h3',{},title),h('p',{class:'card-sub'},subtitle)),exhibitMenu({title,...d.source,geo:g.name,table:data})));
    if(v==='change')body.append(h('p',{class:'period-note'},`Largest published gains and losses, ${d.prior}–${d.year}. Absolute gains favour larger industries; percentage change is shown alongside.${d.prior===2020?' The baseline is 2020; recovery from the pandemic can affect this comparison.':''}`));
    if(v==='specialized')body.append(h('p',{class:'period-note'},'Employment location quotient (LQ): 1.00 equals Canada’s industry share; 2.00 means twice that share. Concentration does not establish a competitive advantage.'));
    if(!rows.length){body.append(h('p',{class:'notice'},'No published industries support this view and filter.'));return;}
    const metric=r=>v==='change'?r.absolute:v==='specialized'?r.lq:r.value;
    const z=Math.max(1,...rows.map(r=>Math.abs(metric(r))));
    const table=h('table',{class:`industry-ranking ${v}`}),thead=h('thead',{},h('tr',{},h('th',{scope:'col'},'Industry'),h('th',{scope:'col',class:'num'},v==='change'?`Change ${d.prior}–${d.year}`:v==='specialized'?'Employment LQ':`${d.year} ${unit}`),
      h('th',{scope:'col',class:'num'},v==='change'?`${d.prior} base`:'Job change'),h('th',{scope:'col',class:'num'},'Change (%)')));
    const tbody=h('tbody');
    for(const r of rows){
      const x=metric(r),width=100*Math.abs(x)/z;
      const plot=h('span',{class:`rank-track${v==='change'?' diverging':''}`},h('span',{class:`rank-fill${x<0?' negative':''}`,style:{width:`${v==='change'?width/2:width}%`,...(v==='change'?{left:x<0?`${50-width/2}%`:'50%'}:{})}}));
      const value=v==='change'?signed(x):v==='specialized'?x.toFixed(2):int(x);
      tbody.append(h('tr',{},h('th',{scope:'row'},h('button',{type:'button',class:'industry-name',onclick:e=>detail.open(r.code,e.currentTarget)},r.name),h('small',{class:'naics'},`NAICS ${r.code}`)),
        h('td',{class:'num rank-value','data-label':v==='change'?`Change ${d.prior}–${d.year}`:v==='specialized'?'Employment LQ':`${d.year} ${unit}`},h('span',{},value),plot),
        h('td',{class:'num','data-label':v==='change'?`${d.prior} base`:'Job change'},v==='change'?(r.previous==null?'Not published':int(r.previous)):(r.absolute==null?'Not published':signed(r.absolute))),
        h('td',{class:'num','data-label':'Change (%)'},r.relative==null?'Not available':`${r.relative>0?'+':''}${pct(100*r.relative)}`)));
    }
    table.append(thead,tbody);body.append(h('div',{class:'table-wrap'},table),h('p',{class:'period-note'},`${d.suppressed} of ${d.count} industries are suppressed or not published. Rankings cover published values only. ${d.estimate?'Employee estimates use class midpoints and 500 for the open 500+ class; they have no finite upper bound when that class is present.':''}`));
  }
  return {update(c){if(c.has('refresh'))industryCache.clear();detail.update(c);if(['geo','refresh','iv','is','view'].some(k=>c.has(k)))render();},destroy:()=>detail.destroy()};
}
