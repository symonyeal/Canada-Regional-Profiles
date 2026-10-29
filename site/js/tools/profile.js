// Detail: resident, workforce, household, dwelling and livability dashboards. Each card loads on its own; a failed
// source affects only its card.
import {int,pct,compact,fmt,ramp,signed,PRIMARY,COMPARE,SEQUENTIAL} from '../model.js';
import {KPI,AGE10,HH_INCOME5,HH_TYPE,HH_SIZE,TENURE,CONSTRUCTION,DWELLING,COMMUTE_MODE,PLACE_OF_WORK,COMMUTE_TIME,EDUCATION,OCCUPATION,INDUSTRY} from '../census.js';
import {h,rail,kpiCard,chartCard,dataTable,lifetime,slot} from '../ui.js';
import {spark,barList,legend,columns,stacked,shareBars} from '../charts.js';
import {sharedPair,censusMeta,populationSeries,incomeSeries,tableMeta} from '../api.js';
import {sectorBase} from '../regional-model.js';

const DASHBOARDS=[['resident','Residents','resident'],['workforce','Work and education','workforce'],['household','Households','household'],
  ['dwelling','Housing stock','dwelling'],['livability','Costs and commuting','livability']];

export function profile(el,app) {
  const life=lifetime(el),frame=h('div',{class:'frame with-rail'});el.append(frame);
  function render() {
    const alive=life.next(),dash=DASHBOARDS.some(t=>t[0]===app.state.t.dv)?app.state.t.dv:DASHBOARDS[0][0];
    const body=h('div',{class:`dash ${dash}`});
    frame.replaceChildren(rail(DASHBOARDS.map(([key,label,icon])=>({key,label,icon})),dash,v=>{app.set('dv',v);render();},'Profile views'),body);
    app.resolved().then(place=>{if(!alive()||place.id!==app.state.geo.id)return;
      const ctx={place,bench:app.bench,alive};
      ctx.base=sharedPair(place,ctx.bench);
      DASH[dash](body,ctx);});
  }
  return {update(changed){if(changed.has('geo')||changed.has('bench')||changed.has('dv')||changed.has('refresh'))render();}};
}

// ---------- shared card builders ----------
const cell=(body,name)=>body.appendChild(h('div',{class:'cell',dataset:{area:name}}));
// Shares of a Census group for selected and benchmark profiles.
function shares(p,group) {
  const total=p?.value(group.total);
  return group.groups.map(([label,ids])=>{const v=p?.sum(ids);return {label:label??p?.label(ids[0])?.replace(/ occupations?$/,''),count:v,value:v!=null&&total>0?100*v/total:null};});
}
function shareCard(target,{title,subtitle,group,ctx,base,size='md'}) {
  slot(target,async t=>{const {p,b}=await base,rows=shares(p,group),bench=b?shares(b,group):null;
    t.replaceChildren(chartCard({title,subtitle,meta:{...censusMeta(ctx.place,{universe:subtitle}),table:()=>({headers:['Category',ctx.place.name,...(b?[ctx.bench.name]:[])],
      rows:rows.map((r,i)=>[r.label,r.value,...(b?[bench[i].value]:[])]),numeric:new Set([1,2]),format:v=>pct(v)})}},
      h('div',{class:'body'},barList(rows.map((r,i)=>({label:r.label,value:r.value,text:pct(r.value),bench:bench?.[i].value,benchText:bench?pct(bench[i].value):null})),{benchName:ctx.bench.name,size})),
      legend([[ctx.place.name,PRIMARY],...(b?[[ctx.bench.name,COMPARE,'tick']]:[])])));
  },{alive:ctx.alive,context:title});
}
function seriesKpi(target,{title,ctx,load,fallback,kind='area',format,universe}) {
  slot(target,async t=>{
    try {
      const d=await load();if(!ctx.alive())return;const last=d.values.filter(v=>v.value!=null).at(-1);
      if(!last) throw new Error('No observations published for this geography.');
      t.replaceChildren(kpiCard({title,value:format(last.value),sub:`${d.geoName} · ${last.year} · trend ${d.values.find(v=>v.value!=null).year}–${last.year}`,spark:spark(d.values,kind),
        meta:{...tableMeta(d,{universe}),table:()=>({headers:['Year',title],rows:d.values.map(v=>[String(v.year),v.value]),numeric:new Set([1]),format:(v,i)=>i?format(v):v})}}));
    } catch(e) {
      if(!fallback) throw e;
      const f=await fallback();if(!ctx.alive())return;
      t.replaceChildren(kpiCard({title:f.title??title,value:f.value==null?'Not available':format(f.value),sub:f.sub,
        meta:{...censusMeta(ctx.place,{universe:f.universe,notes:`${e.message} The Census 2021 value is shown instead.`}),table:()=>({headers:['Measure','Value'],rows:[[f.title??title,f.value]],numeric:new Set([1]),format:(v,i)=>i?format(v):v})}}));
    }
  },{alive:ctx.alive,context:title});
}
const censusKpi=(target,{title,id,ctx,base,format,sub})=>slot(target,async t=>{const {p}=await base,v=p.value(id);
  t.replaceChildren(kpiCard({title,value:v==null?'Not available':format(v),sub:sub??`${ctx.place.name} · Census 2021`,
    meta:{...censusMeta(ctx.place),table:()=>({headers:['Measure',ctx.place.name],rows:[[title,v]],numeric:new Set([1]),format:(x,i)=>i?format(x):x})}}));},{alive:ctx.alive,context:title});
const money=v=>compact(v,'$'),moneyFull=v=>`$${int(v)}`;

// ---------- dashboards ----------
const DASH={
  resident(body,ctx) {
    const {place,base}=ctx,[a,b,c,s]=['a','b','c','s'].map(n=>cell(body,n));
    seriesKpi(a,{title:'Population',ctx,load:()=>populationSeries(place),kind:'bars',format:v=>compact(v),universe:'Total population, July 1 estimates',
      fallback:async()=>({value:(await base).p.value(KPI.population),sub:`${place.name} · Census 2021`})});
    seriesKpi(b,{title:'Median individual income',ctx,load:()=>incomeSeries(place,'individual'),format:money,universe:'Tax filers and dependants with income',
      fallback:async()=>({value:(await base).p.value(KPI.medianIndividualIncome),sub:`${place.name} · 2020 income, Census 2021`,universe:'Income recipients aged 15+'})});
    censusKpi(c,{title:'Median age',id:KPI.medianAge,ctx,base,format:v=>fmt(v)});
    shareCard(s,{title:'Age distribution',subtitle:`Share of population by age band, ${place.name}${ctx.bench.id!==place.id?` vs ${ctx.bench.name}`:''}`,group:AGE10,ctx,base,size:'sm'});
  },
  household(body,ctx) {
    const {place,base}=ctx,[a,b,c,m,s,t]=['a','b','c','m','s','t'].map(n=>cell(body,n));
    seriesKpi(a,{title:'Median family income',ctx,load:()=>incomeSeries(place,'family'),format:money,universe:'Census families, median total income (tax data)',
      fallback:async()=>({title:'Median household income',value:(await base).p.value(KPI.medianHouseholdIncome),sub:`${place.name} · 2020 income, Census 2021`,universe:'Private households'})});
    censusKpi(b,{title:'Average household size',id:KPI.householdSize,ctx,base,format:v=>fmt(v,'ratio').replace(/(\.\d)\d$/,'$1')});
    censusKpi(c,{title:'Number of households',id:KPI.households,ctx,base,format:v=>compact(v)});
    slot(s,async el=>{const {p}=await base,rows=HH_TYPE.groups.map(([label,ids])=>({label,count:p.sum(ids)}));
      el.replaceChildren(chartCard({title:'Household type',subtitle:'Private households by family structure, Census 2021',
        meta:{...censusMeta(place,{universe:'Private households'}),table:()=>({headers:['Household type',place.name],rows:rows.map(r=>[r.label,r.count]),numeric:new Set([1]),format:v=>int(v)})}},
        h('div',{class:'body'},barList(rows.map(r=>({label:r.label,value:r.count,text:int(r.count)})),{size:'sm'}))));},{alive:ctx.alive,context:'Household type'});
    slot(t,async el=>{const {p,b}=await base,cats=HH_SIZE.groups.map(g=>g[0]),row=q=>({label:q.area?.name??'',values:HH_SIZE.groups.map(([,ids])=>q.sum(ids))});
      const colors=ramp(SEQUENTIAL,5);
      el.replaceChildren(chartCard({title:'Household size distribution',subtitle:'Share of households by number of persons',
        meta:{...censusMeta(place,{universe:'Private households'}),table:()=>({headers:['Size',place.name,...(b?[ctx.bench.name]:[])],rows:cats.map((c,i)=>[c,p.sum(HH_SIZE.groups[i][1]),...(b?[b.sum(HH_SIZE.groups[i][1])]:[])]),numeric:new Set([1,2]),format:v=>int(v)})}},
        h('div',{class:'body'},stacked([{...row(p),label:place.name},...(b?[{...row(b),label:ctx.bench.name}]:[])],cats,colors)),legend(cats.map((c,i)=>[c,colors[i]]))));},{alive:ctx.alive,context:'Household size'});
    shareCard(m,{title:'Household income distribution',subtitle:'Share of private households by 2020 total income',group:HH_INCOME5,ctx,base,size:'sm'});
  },
  dwelling(body,ctx) {
    const {place,base}=ctx,[a,b,s]=['a','b','s'].map(n=>cell(body,n));
    slot(a,async el=>{const {p,b}=await base,cats=TENURE.groups.map(g=>g[0]),row=(q,label)=>({label,values:TENURE.groups.map(([,ids])=>q.sum(ids))}),colors=[PRIMARY,COMPARE,'#bfd1bf'];
      el.replaceChildren(chartCard({title:'Home ownership',subtitle:'Owner and renter share of private households',
        meta:{...censusMeta(place,{universe:'Private households'}),table:()=>({headers:['Tenure',place.name,...(b?[ctx.bench.name]:[])],rows:cats.map((c,i)=>[c,p.sum(TENURE.groups[i][1]),...(b?[b.sum(TENURE.groups[i][1])]:[])]),numeric:new Set([1,2]),format:v=>int(v)})}},
        h('div',{class:'body'},stacked([row(p,place.name),...(b?[row(b,ctx.bench.name)]:[])],cats,colors)),legend(cats.map((c,i)=>[c,colors[i]]))));},{alive:ctx.alive,context:'Home ownership'});
    slot(b,async el=>{const {p,b:q}=await base,sel=shares(p,CONSTRUCTION),ben=q?shares(q,CONSTRUCTION):null;
      el.replaceChildren(chartCard({title:'Dwelling construction period',subtitle:'Share of occupied private dwellings by period built',
        meta:{...censusMeta(place,{universe:'Occupied private dwellings'}),table:()=>({headers:['Period',place.name,...(q?[ctx.bench.name]:[])],rows:sel.map((r,i)=>[r.label,r.value,...(q?[ben[i].value]:[])]),numeric:new Set([1,2]),format:v=>pct(v)})}},
        h('div',{class:'body'},columns({categories:sel.map(r=>r.label),series:[{name:place.name,values:sel.map(r=>r.value),color:PRIMARY},...(q?[{name:ctx.bench.name,values:ben.map(r=>r.value),color:COMPARE}]:[])],fmt:v=>pct(v),axisFmt:v=>`${v}%`,height:330,rotate:true})),
        legend([[place.name,PRIMARY],...(q?[[ctx.bench.name,COMPARE]]:[])])));},{alive:ctx.alive,context:'Construction period'});
    shareCard(s,{title:'Dwelling type',subtitle:`Share of occupied private dwellings, ${place.name}${ctx.bench.id!==place.id?` vs ${ctx.bench.name}`:''}`,group:DWELLING,ctx,base,size:'sm'});
  },
  workforce(body,ctx) {workforceCards(body,ctx);},
  livability(body,ctx) {
    const {place,base}=ctx,[a,b,c,s,t]=['a','b','c','s','t'].map(n=>cell(body,n));
    censusKpi(a,{title:'Median dwelling value',id:KPI.dwellingValue,ctx,base,format:v=>compact(v,'$'),sub:`${place.name} · owner households, Census 2021`});
    censusKpi(b,{title:'Median monthly tenant shelter costs',id:KPI.rent,ctx,base,format:moneyFull,sub:`${place.name} · tenant households, Census 2021`});
    slot(c,async el=>{const {p}=await base,v=p.sum(['2612','2613']),tot=p.value(COMMUTE_TIME.total),share=v!=null&&tot>0?100*v/tot:null;
      el.replaceChildren(kpiCard({title:'Commutes under 30 minutes',value:share==null?'Not available':pct(share),sub:`${place.name} · Census 2021`,
        meta:{...censusMeta(place,{universe:'Employed labour force with a usual place of work or no fixed address',notes:'The Census Profile publishes commuting duration in bands; it does not publish a mean commuting time.'}),
          table:()=>({headers:['Duration',place.name],rows:COMMUTE_TIME.groups.map(([l,ids])=>[l,p.sum(ids)]),numeric:new Set([1]),format:v=>int(v)})}}));},{alive:ctx.alive,context:'Commute duration'});
    shareCard(s,{title:'Mode of commuting',subtitle:`Commute to work, ${place.name}${ctx.bench.id!==place.id?` vs ${ctx.bench.name}`:''}`,group:COMMUTE_MODE,ctx,base,size:'sm'});
    shareCard(t,{title:'Place of work status',subtitle:`Employed labour force, ${place.name}${ctx.bench.id!==place.id?` vs ${ctx.bench.name}`:''}`,group:PLACE_OF_WORK,ctx,base,size:'sm'});
  },
};

// Workforce indicators: resident industries, occupations, education.
function workforceCards(body,ctx) {
  const {place,base}=ctx,[a,s,t]=['a','s','t'].map(n=>cell(body,n));
  slot(a,async el=>{const {p,b}=await base,rows=shares(p,INDUSTRY),ben=b?shares(b,INDUSTRY):null;
    const sorted=rows.map((r,i)=>({...r,bench:ben?.[i].value})).filter(r=>r.value!=null).sort((a,b)=>b.value-a.value);
    const max=Math.max(1,...rows.flatMap((r,i)=>[r.value,ben?.[i].value]).filter(Number.isFinite));
    const plot=items=>barList(items.map(r=>({label:r.label,value:r.value,text:pct(r.value),bench:r.bench,benchText:b?pct(r.bench):null})),{max,size:'sm',benchName:ctx.bench.name});
    el.replaceChildren(chartCard({title:'Top industries of the resident labour force',subtitle:'Ten largest published sectors · share of the labour force aged 15+, including unemployed people with recent work · Census 2021',
      meta:{...censusMeta(place,{universe:'Labour force aged 15+, including unemployed people with recent work'}),table:()=>({headers:['Sector',`${place.name} people`,`${place.name} share (%)`,...(b?[`${ctx.bench.name} share (%)`]:[])],rows:rows.map((r,i)=>[r.label,r.count,r.value,...(b?[ben[i].value]:[])]),numeric:new Set([1,2,3]),format:(v,i)=>i>1?pct(v):typeof v==='number'?int(v):v})}},
      h('div',{class:'body'},plot(sorted.slice(0,10)),sorted.length>10?h('details',{class:'remaining-sectors'},h('summary',{},'Show remaining sectors'),plot(sorted.slice(10))):null),
      legend([[place.name,PRIMARY],...(b?[[ctx.bench.name,COMPARE,'tick']]:[])])));
    },{alive:ctx.alive,context:'Industry of employment'});
  slot(s,async el=>{const {p,b}=await base,ben=b?shares(b,OCCUPATION):null,rows=shares(p,OCCUPATION).map((r,i)=>({...r,bench:ben?.[i].value})).sort((x,y)=>(y.count??-1)-(x.count??-1)).slice(0,5);
    el.replaceChildren(chartCard({title:'Top occupations',subtitle:'Labour force aged 15+ by occupation group (NOC 2021)',
      meta:{...censusMeta(place,{universe:'Labour force aged 15+'}),table:()=>({headers:['Occupation group',`${place.name} people`,`${place.name} share (%)`,...(b?[`${ctx.bench.name} share (%)`]:[])],rows:shares(p,OCCUPATION).map((r,i)=>[r.label,r.count,r.value,...(b?[ben[i].value]:[])]),numeric:new Set([1,2,3]),format:(v,i)=>i>1?pct(v):typeof v==='number'?int(v):v})}},
      h('div',{class:'body'},barList(rows.map(r=>({label:r.label,value:r.value,text:pct(r.value),bench:r.bench,benchText:b?pct(r.bench):null})),{size:'sm',benchName:ctx.bench.name})),legend([[place.name,PRIMARY],...(b?[[ctx.bench.name,COMPARE,'tick']]:[])])));
    },{alive:ctx.alive,context:'Top occupations'});
  slot(t,async el=>{const {p}=await base,rows=shares(p,EDUCATION);
    el.replaceChildren(chartCard({title:'Education levels',subtitle:'Population aged 25 to 64, Census 2021. These indicators overlap: higher degrees also count toward the broader qualifications.',
      meta:{...censusMeta(place,{universe:'Population aged 25 to 64 in private households',notes:'The four indicators are nested, not exclusive: a master’s degree also counts as bachelor’s or higher.'}),
        table:()=>({headers:['Credential','People','Share (%)'],rows:rows.map(r=>[r.label,r.count,r.value]),numeric:new Set([1,2]),format:(v,i)=>i===2?pct(v):int(v)})}},
      h('div',{class:'body'},shareBars(rows.map(r=>({label:r.label,value:r.value,count:r.count}))))));},{alive:ctx.alive,context:'Education levels'});
}

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
    meta:{...censusMeta(g,{notes:'LQ = sector share of the area’s labour force divided by the benchmark’s share. Workers beyond benchmark share = e − t·S. Mix difference D = ½ Σ |s − S| (Krugman 1991). Residents are counted where they live, not where they work.'}),table:t}},
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
