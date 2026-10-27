// Economy view. Legend: d = source dataset; r = industry or sector row; v = view; x = displayed measure;
// z = bar scale; F = shift-share result. Payroll and size-class estimates stay distinct.
import {sephSectors,sephAt,table,SourceError} from '../api.js';
import {commonYears,parseRange,clampRange,rangeText} from '../trend-model.js';
import {CANADA,int,pct,signed} from '../model.js';
import {industryRows,shiftShare,sectorBase} from '../regional-model.js';
import {h,segmented,exhibitMenu,loading,failure,chartCard,dataTable,rangeSlider} from '../ui.js';
import {industryCache} from './industries.js';
import {insights} from './insights.js';
import {lifetime,slot,sharedPair,censusMeta} from './common.js';

const BASE=2019;
const yearly=M=>[...M].map(([year,value])=>({year,value}));
// Payroll job change by sector over a chosen range, decomposed into national growth, industry mix and regional
// shift. The range runs over years with payroll totals here and in Canada; by default from 2019 to the latest year.
function payrollChange(el,g,app,alive) {
  slot(el,async t=>{
    const all=await sephSectors(g);if(!alive())return;
    const Y=commonYears([yearly(all.agg.e),yearly(all.agg.E)]);
    if(!Y.length) throw new SourceError('empty','SEPH publishes no year with payroll totals for both this area and Canada.');
    const card=h('div'),w=clampRange(Y,parseRange(app.state.t.py)??[BASE,Y.at(-1)]);
    const slider=Y.length>1?rangeSlider({n:Y.length,lo:Y.indexOf(w[0]),hi:Y.indexOf(w[1]),label:'Payroll years',ends:[String(Y[0]),String(Y.at(-1))],
      describe:(x,y)=>rangeText([Y[x],Y[y]]),onchange:(x,y)=>{app.set('py',`${Y[x]}-${Y[y]}`);draw([Y[x],Y[y]]);}}):null;
    t.replaceChildren(...[slider?h('div',{class:'trend-range'},h('span',{class:'field-label'},`Base and end year, ${rangeText([Y[0],Y.at(-1)])} published`),slider.el,slider.out):null,card].filter(Boolean));
    const draw=([from,to])=>{
      const d={...sephAt(all,from,to),geoName:all.geoName,metadata:all.metadata},F=shiftShare(d.rows,d.agg);
      const national=g.id===CANADA.id,rows=F.rows.filter(r=>r.change!=null).sort((x,y)=>national?y.change-x.change:y.RS-x.RS);
      const k=v=>`${signed(v)} jobs`,share=d.agg.e0?100*F.change/d.agg.e0:null;
      const title=F.change==null?`Payroll jobs, ${d.from}–${d.year}`:`${national?'Canada':g.name} ${F.change>=0?'added':'lost'} ${int(Math.abs(F.change))} payroll jobs from ${d.from} to ${d.year} (${share>=0?'+':''}${pct(share)})`;
      const lead=national||F.NS==null?`Sectors ranked by job change. ${F.published} of ${d.rows.length} sectors are published.`
        :`At Canada’s rate (${pct(100*F.G)}) it would have ${F.NS>=0?'added':'lost'} ${int(Math.abs(F.NS))}. Its sector mix accounts for ${k(F.IM)}; sectors growing faster or slower than the same sectors nationally account for ${k(F.RS)}${F.unattributed&&Math.abs(F.unattributed)>=1?`; suppressed sectors, ${k(F.unattributed)}`:''}.`;
      const named=(list,word)=>list.length?h('p',{},h('strong',{},word),' ',list.map(r=>`${r.name} (${signed(r.RS)})`).join(', '),'.'):null;
      const tbl=()=>({headers:['Sector',`${d.from} jobs`,`${d.year} jobs`,'Change','Change (%)',...(national?[]:['National growth','Sector mix','Regional shift'])],
        rows:[...rows,...F.rows.filter(r=>r.change==null)].map(r=>[r.name,r.e0,r.e1,r.change,r.change==null?null:100*r.change/r.e0,...(national?[]:[r.NS,r.IM,r.RS])]),numeric:new Set([1,2,3,4,5,6,7]),format:(v,i)=>i===0?v:i===4?pct(v):i>=3?signed(v):int(v)});
      card.replaceChildren(chartCard({title,subtitle:lead,meta:{source:'Statistics Canada, table 14-10-0202: Employment by industry, annual (SEPH)',url:table('14100202'),geo:d.geoName,
        period:`${d.from} and ${d.year} annual averages`,universe:'All employees on payrolls; 20 NAICS sectors of the industrial aggregate excluding unclassified businesses (forestry and logging, not agriculture)',
        notes:'Shift-share (Dunn 1960): national growth = jobs in the base year × Canada’s growth rate; sector mix = base jobs × (the sector’s national growth − Canada’s growth); regional shift = base jobs × (the sector’s growth here − its national growth). The default base year, 2019, precedes the pandemic; the range runs over every year SEPH publishes for this area and Canada.',table:tbl}},
        national?null:named(rows.filter(r=>r.RS>0).slice(0,3),'Ahead of the same sectors nationally:'),
        national?null:named(rows.filter(r=>r.RS<0).slice(-3).reverse(),'Behind:'),
        h('details',{class:'remaining-sectors'},h('summary',{},`All ${d.rows.length} sectors`),dataTable(tbl()))));
    };
    draw(w);
  },{alive,context:'Payroll job change'});
}
// Resident labour force by sector (Census 2021) against the benchmark, every geography level.
function residentSectors(el,g,bench,alive) {
  slot(el,async t=>{
    const {p,b}=await sharedPair(g,bench);if(!alive())return;
    const {rows,D}=sectorBase(p,b),list=rows.filter(r=>r.e!=null).sort((x,y)=>b?(y.lq??0)-(x.lq??0):y.e-x.e);
    const tbl=()=>({headers:['Sector','Workers','Share (%)',...(b?[`${bench.name} share (%)`,'LQ','Workers beyond benchmark share']:[])],
      rows:list.map(r=>[r.name,r.e,r.s==null?null:100*r.s,...(b?[r.S==null?null:100*r.S,r.lq,r.excess]:[])]),numeric:new Set([1,2,3,4,5]),
      format:(v,i)=>i===0?v:i===2||i===3?pct(v):i===4?v.toFixed(2):i===5?signed(v):int(v)});
    t.replaceChildren(chartCard({title:'Industry sectors of resident workers',subtitle:`Census 2021, by place of residence; ${b?`ranked by location quotient against ${bench.name}`:'ranked by workers'}.${D!=null?` Mix difference: ${pct(100*D,0)} of workers would have to change sector to match.`:''}`,
      meta:{...censusMeta(g,{universe:'Labour force aged 15+ with an industry (NAICS 2017 sectors)',notes:'LQ = the sector’s share here divided by its benchmark share. Mix difference D = ½ Σ |s − S| (Krugman 1991).'}),table:tbl}},
      b?h('p',{},h('strong',{},'Most over-represented:'),' ',list.slice(0,3).map(r=>`${r.name} (${r.lq.toFixed(2)}×, ${signed(r.excess)} workers)`).join(', '),'.'):null,
      h('details',{class:'remaining-sectors'},h('summary',{},`All ${list.length} sectors`),dataTable(tbl()))));
  },{alive,context:'Resident workers by sector'});
}

const VIEWS=[['largest','Largest'],['change','Job gains and losses'],['specialized','Specialization']];
export function industries(el,app) {
  const life=lifetime(el),top=h('div',{class:'economy-cards'}),root=h('div',{class:'industry-brief'}),detailHost=h('div');
  el.append(top,h('h3',{class:'subhead'},'Detailed industries'),root,detailHost);const detail=insights(detailHost,app,{banner:false});
  async function cards() {
    const a=life.next(),g=await app.resolved();if(!a())return;
    const pay=h('div'),res=h('div');top.replaceChildren(pay,res);
    if(g.type==='PR')payrollChange(pay,g,app,a);else pay.remove();
    residentSectors(res,g,app.bench,a);
  }
  const rank=lifetime(root);
  async function render() {
    const a=rank.next(),g=await app.resolved();if(!a())return;
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
  return {update(c){if(c.has('refresh'))industryCache.clear();detail.update(c);if(['geo','refresh','bench','py'].some(k=>c.has(k)))cards();if(['geo','refresh','iv','is','view'].some(k=>c.has(k)))render();},destroy:()=>detail.destroy()};
}
