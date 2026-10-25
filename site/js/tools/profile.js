// Community profile: six dashboards. Each card loads on its own; a failed source affects only its card.
import {establishments,request} from '../api.js';
import {CANADA,PT,int,pct,compact,fmt,ramp} from '../model.js';
import {KPI,AGE10,HH_INCOME5,HH_TYPE,HH_SIZE,TENURE,CONSTRUCTION,DWELLING,COMMUTE_MODE,PLACE_OF_WORK,COMMUTE_TIME,EDUCATION,OCCUPATION,INDUSTRY} from '../census.js';
import {h,rail,kpiCard,chartCard,rangeSlider} from '../ui.js';
import {spark,barList,legend,columns,stacked,treemap,climate,shareBars} from '../charts.js';
import {PRIMARY,COMPARE,SEQUENTIAL} from '../palette.js';
import {lifetime,slot,sharedPair,censusMeta,populationSeries,lfsSeries,incomeSeries,tableMeta} from './common.js';
import {filterData,parseSelection,serializeSelection,mapPanel,shapes,scopeOf} from './choropleth.js';
import {FILTERS} from '../census.js';
import {boundaryOf,centroid} from '../geo.js';

const DASHBOARDS=[['economic','Economic','economic'],['resident','Resident','resident'],['household','Household','household'],
  ['dwelling','Dwelling','dwelling'],['workforce','Workforce','workforce'],['livability','Livability','livability']];

export function profile(el,app) {
  const life=lifetime(el),frame=h('div',{class:'frame with-rail'});el.append(frame);
  let panel=null;
  function render() {
    const alive=life.next(),dash=app.state.t.cp;
    panel?.destroy?.();panel=null;
    const body=h('div',{class:`dash ${dash}`});
    frame.replaceChildren(rail(DASHBOARDS.map(([key,label,icon])=>({key,label,icon})),dash,key=>{app.set('cp',key);render();},'Community profile dashboards'),body);
    app.resolved().then(place=>{if(!alive()||place.id!==app.state.geo.id)return;
      const ctx={place,bench:app.bench,alive,app};
      ctx.base=sharedPair(place,ctx.bench);
      panel=DASH[dash](body,ctx)??null;});
  }
  return {update(changed){if(changed.has('geo')||changed.has('bench')||changed.has('cp')||changed.has('refresh'))render();}};
}

// ---------- shared card builders ----------
const area=(name,node)=>{node.dataset.area=name;return node;};
const cell=(body,name)=>body.appendChild(area(name,h('div',{class:'cell'})));
// Shares of a Census group for selected and benchmark profiles.
function shares(p,group) {
  const total=p?.value(group.total);
  return group.groups.map(([label,ids])=>{const v=p?.sum(ids);return {label:label??p?.name(ids[0])?.replace(/^\d+(-\d+)? /,'')?.replace(/ occupations?$/,''),count:v,value:v!=null&&total>0?100*v/total:null};});
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
      t.replaceChildren(kpiCard({title,value:format(last.value),sub:`${d.geoName} · ${last.year}`,spark:spark(d.values,kind),
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
  economic(body,ctx) {
    const {place,base}=ctx,[a,b,c,d,e,f,g,s]=['a','b','c','d','e','f','g','s'].map(n=>cell(body,n));
    seriesKpi(a,{title:'Labour force participation',ctx,load:()=>lfsSeries(place,/^Participation rate$/),format:v=>pct(v),universe:'Population aged 15+, annual LFS average',
      fallback:async()=>({value:(await base).p.value(KPI.participation),sub:`${place.name} · Census 2021`,universe:'Population aged 15+'})});
    seriesKpi(b,{title:'Population',ctx,load:()=>populationSeries(place),kind:'bars',format:v=>compact(v),universe:'Total population, July 1 estimates',
      fallback:async()=>({value:(await base).p.value(KPI.population),sub:`${place.name} · Census 2021`})});
    seriesKpi(c,{title:'Median family income',ctx,load:()=>incomeSeries(place,'family'),format:money,universe:'Census families, median total income (tax data)',
      fallback:async()=>({title:'Median household income',value:(await base).p.value(KPI.medianHouseholdIncome),sub:`${place.name} · 2020 income, Census 2021`,universe:'Private households'})});
    slot(d,async t=>{const {p,b}=await base,sel=shares(p,HH_INCOME5),ben=b?shares(b,HH_INCOME5):null;
      t.replaceChildren(chartCard({title:'Household income distribution',subtitle:`Share of households by 2020 total income, ${place.name}${b?` vs ${ctx.bench.name}`:''}`,
        meta:{...censusMeta(place,{universe:'Private households, 2020 total income'}),table:()=>({headers:['Income band',place.name,...(b?[ctx.bench.name]:[])],rows:sel.map((r,i)=>[r.label,r.value,...(b?[ben[i].value]:[])]),numeric:new Set([1,2]),format:v=>pct(v)})}},
        h('div',{class:'body'},columns({categories:sel.map(r=>r.label),series:[{name:place.name,values:sel.map(r=>r.value),color:PRIMARY},...(b?[{name:ctx.bench.name,values:ben.map(r=>r.value),color:COMPARE}]:[])],
          fmt:v=>pct(v),axisFmt:v=>`${v}%`,height:420})),legend([[place.name,PRIMARY],...(b?[[ctx.bench.name,COMPARE]]:[])])));},{alive:ctx.alive,context:'Household income distribution'});
    seriesKpi(e,{title:'Unemployment rate',ctx,load:()=>lfsSeries(place,/^Unemployment rate$/),format:v=>pct(v),universe:'Labour force aged 15+, annual LFS average',
      fallback:async()=>({value:(await base).p.value(KPI.unemployment),sub:`${place.name} · Census 2021`})});
    seriesKpi(f,{title:'Total employment',ctx,load:()=>lfsSeries(place,/^Employment$/),format:v=>compact(v),universe:'Employed persons aged 15+, annual LFS average',
      fallback:async()=>({title:'Employed residents',value:(await base).p.value('2225'),sub:`${place.name} · Census 2021`})});
    seriesKpi(g,{title:'Employer establishments',ctx,format:v=>int(v),universe:'Business locations with employees, June each year',
      load:async()=>{const d=await establishments(place);return {...d,pid:String(d.latest.productId),metadata:{cubeTitleEn:'Canadian Business Counts, with employees, June releases'}};},
      fallback:null});
    slot(s,async t=>{const {p}=await base,rows=shares(p,INDUSTRY).sort((x,y)=>(y.count??-1)-(x.count??-1)).slice(0,9);
      t.replaceChildren(chartCard({title:'Top employment sectors',subtitle:'Labour force aged 15+ by industry of work, Census 2021',
        meta:{...censusMeta(place,{universe:'Labour force aged 15+ (includes unemployed people with recent work)'}),table:()=>({headers:['Sector',place.name],rows:rows.map(r=>[r.label,r.count]),numeric:new Set([1]),format:v=>int(v)})}},
        h('div',{class:'body'},barList(rows.map(r=>({label:r.label,value:r.count,text:int(r.count)}))))));},{alive:ctx.alive,context:'Top employment sectors'});
  },
  resident(body,ctx) {
    const {place,base}=ctx,[a,b,c,m,s]=['a','b','c','m','s'].map(n=>cell(body,n));
    seriesKpi(a,{title:'Population',ctx,load:()=>populationSeries(place),kind:'bars',format:v=>compact(v),universe:'Total population, July 1 estimates',
      fallback:async()=>({value:(await base).p.value(KPI.population),sub:`${place.name} · Census 2021`})});
    seriesKpi(b,{title:'Median individual income',ctx,load:()=>incomeSeries(place,'individual'),format:money,universe:'Tax filers and dependants with income',
      fallback:async()=>({value:(await base).p.value(KPI.medianIndividualIncome),sub:`${place.name} · 2020 income, Census 2021`,universe:'Income recipients aged 15+'})});
    censusKpi(c,{title:'Median age',id:KPI.medianAge,ctx,base,format:v=>fmt(v)});
    shareCard(s,{title:'Age distribution',subtitle:`Share of population by age band, ${place.name}${ctx.bench.id!==place.id?` vs ${ctx.bench.name}`:''}`,group:AGE10,ctx,base,size:'sm'});
    return embeddedMap(m,ctx,'consumers','age','cpr');
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
    return embeddedMap(m,ctx,'consumers','hhincome','cph');
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
    const {place,base}=ctx,[a,b,c,d,s,t]=['a','b','c','d','s','t'].map(n=>cell(body,n));
    censusKpi(a,{title:'Median dwelling value',id:KPI.dwellingValue,ctx,base,format:v=>compact(v,'$'),sub:`${place.name} · owner households, Census 2021`});
    censusKpi(b,{title:'Median monthly rent',id:KPI.rent,ctx,base,format:moneyFull,sub:`${place.name} · tenant shelter costs, Census 2021`});
    slot(c,async el=>{const {p}=await base,v=p.sum(['2612','2613']),tot=p.value(COMMUTE_TIME.total),share=v!=null&&tot>0?100*v/tot:null;
      el.replaceChildren(kpiCard({title:'Commutes under 30 minutes',value:share==null?'Not available':pct(share),sub:`${place.name} · Census 2021`,
        meta:{...censusMeta(place,{universe:'Employed labour force with a usual place of work or no fixed address',notes:'The Census Profile publishes commuting duration in bands; it does not publish a mean commuting time.'}),
          table:()=>({headers:['Duration',place.name],rows:COMMUTE_TIME.groups.map(([l,ids])=>[l,p.sum(ids)]),numeric:new Set([1]),format:v=>int(v)})}}));},{alive:ctx.alive,context:'Commute duration'});
    climateCard(d,ctx);
    shareCard(s,{title:'Mode of commuting',subtitle:`Commute to work, ${place.name}${ctx.bench.id!==place.id?` vs ${ctx.bench.name}`:''}`,group:COMMUTE_MODE,ctx,base,size:'sm'});
    shareCard(t,{title:'Place of work status',subtitle:`Employed labour force, ${place.name}${ctx.bench.id!==place.id?` vs ${ctx.bench.name}`:''}`,group:PLACE_OF_WORK,ctx,base,size:'sm'});
  },
};

// Workforce indicators (also the Workforce tool's first view): industry treemap, occupations, education.
export function workforceCards(body,ctx) {
  const {place,base}=ctx,[a,s,t]=['a','s','t'].map(n=>cell(body,n));
  slot(a,async el=>{const {p}=await base,rows=shares(p,INDUSTRY);
    el.replaceChildren(chartCard({title:'Residents’ industry of employment',subtitle:'Labour force aged 15+ by industry sector, Census 2021',
      meta:{...censusMeta(place,{universe:'Labour force aged 15+'}),table:()=>({headers:['Sector',place.name],rows:rows.map(r=>[r.label,r.count]),numeric:new Set([1]),format:v=>int(v)})}},
      h('div',{class:'body'},treemap(rows.filter(r=>r.count>0).map(r=>({label:r.label,value:r.count,text:int(r.count)})),{height:'fill'}))));},{alive:ctx.alive,context:'Industry of employment'});
  slot(s,async el=>{const {p}=await base,rows=shares(p,OCCUPATION).sort((x,y)=>(y.count??-1)-(x.count??-1)).slice(0,5);
    el.replaceChildren(chartCard({title:'Top occupations',subtitle:'Labour force aged 15+ by occupation group (NOC 2021)',
      meta:{...censusMeta(place,{universe:'Labour force aged 15+'}),table:()=>({headers:['Occupation group',place.name],rows:shares(p,OCCUPATION).map(r=>[r.label,r.count]),numeric:new Set([1]),format:v=>int(v)})}},
      h('div',{class:'body'},barList(rows.map(r=>({label:r.label,value:r.count,text:int(r.count)})),{size:'sm'}))));},{alive:ctx.alive,context:'Top occupations'});
  slot(t,async el=>{const {p}=await base,rows=shares(p,EDUCATION);
    el.replaceChildren(chartCard({title:'Education levels',subtitle:'Share of population aged 25 to 64, Census 2021',
      meta:{...censusMeta(place,{universe:'Population aged 25 to 64 in private households',notes:'The four indicators are nested, not exclusive: a master’s degree also counts as bachelor’s or higher.'}),
        table:()=>({headers:['Credential','People','Share (%)'],rows:rows.map(r=>[r.label,r.count,r.value]),numeric:new Set([1,2]),format:(v,i)=>i===2?pct(v):int(v)})}},
      h('div',{class:'body'},shareBars(rows.map(r=>({label:r.label,value:r.value,count:r.count}))))));},{alive:ctx.alive,context:'Education levels'});
}

// The Resident and Household dashboards embed one target-group map with a single range filter.
function embeddedMap(target,ctx,group,mapKey,urlKey) {
  const spec=FILTERS[group].maps[mapKey],{place,app}=ctx;
  target.classList.add('map-cell');
  const filter=h('div',{class:'map-card',style:{top:'112px',left:'12px',minWidth:'190px'}});
  const panel=mapPanel(target,{label:group==='consumers'&&mapKey==='age'?'Population':'Households',onopen:id=>app.choose({id,type:'CSD'},'profile')});
  target.querySelector('.map-wrap').append(filter);target.querySelector('.map-wrap').style.height='100%';
  const sel0=parseSelection(spec,app.state.t[urlKey],spec.bins.length);let data=null,sel=sel0;
  const shapesP=shapes(scopeOf(place));shapesP.catch(()=>{});
  const drawFilter=()=>{const idx=sel.flatMap((v,i)=>v?[i]:[]);
    const s=rangeSlider({n:spec.bins.length,lo:idx[0]??0,hi:idx.at(-1)??0,label:spec.label.replace('by ',''),ends:spec.ends,
      describe:(a,b)=>spec.text(spec.bins[a],spec.bins[b]),onchange:(a,b)=>{sel=spec.bins.map((_,i)=>i>=a&&i<=b);app.set(urlKey,serializeSelection(spec,sel));panel.draw({data,sel,place,group,shapes:shapesP});}});
    filter.replaceChildren(h('h5',{},spec.label.replace('by ','')),s.out,s.el);};
  filterData(place,group,mapKey).then(d=>{if(!ctx.alive())return;data=d;drawFilter();panel.draw({data,sel,place,group,shapes:shapesP});})
    .catch(e=>{if(ctx.alive())target.querySelector('.map-kpi').replaceChildren(h('span',{},'Map data unavailable'),h('small',{},e.message));});
  return panel;
}

// Climate normals at the ECCC station nearest to the selected area (or its largest metropolitan area for a province).
function climateCard(target,ctx) {
  const {place,app}=ctx;
  slot(target,async el=>{
    if(place.id===CANADA.id){el.replaceChildren(chartCard({title:'Climate summary',subtitle:'Choose a province, territory or local area to see station normals.'},h('div',{class:'body'})));return;}
    const pr=String(place.province).split('_')[0],abbr=PT.find(p=>p[0]===pr)?.[1],base='https://api.weather.gc.ca/collections/climate-normals/items';
    // Stations with twelve monthly values for both total precipitation (56) and mean daily maximum (5).
    const [rain,heat]=await Promise.all(['56','5'].map(id=>request(`${base}?${new URLSearchParams({f:'json',limit:'3000',PROVINCE_CODE:abbr,NORMAL_ID:id})}`)));
    const months=list=>{const n=new Map();for(const f of list.features??[])n.set(f.properties.STN_ID,(n.get(f.properties.STN_ID)??0)+1);return n;},hot=months(heat);
    const stations=new Map();for(const f of rain.features??[]){const s=f.properties;if(!stations.has(s.STN_ID))stations.set(s.STN_ID,{id:String(s.STN_ID),name:s.STATION_NAME,coord:f.geometry.coordinates,months:0,period:`${s.PERIOD_BEGIN}–${s.PERIOD_END}`});stations.get(s.STN_ID).months++;}
    const complete=[...stations.values()].filter(s=>s.months>=12&&(hot.get(Number(s.id))??0)>=12);
    if(!complete.length){el.replaceChildren(chartCard({title:'Climate summary',subtitle:`No station with complete monthly normals in ${PT.find(p=>p[0]===pr)?.[2]}.`},h('div',{class:'body'})));return;}
    // Reference point: the selected area's centroid; for a province, the centroid of its most populous metropolitan area or agglomeration.
    let point=null,anchor=place.name;
    try {
      if(place.type==='PR'){const cmas=(await app.placeList('CMACA')).filter(g=>String(g.province).split('_').includes(pr)).sort((x,y)=>(y.population??0)-(x.population??0));
        if(cmas[0]){anchor=cmas[0].name;const fc=await boundaryOf(cmas[0]);point=centroid(fc.features[0]);}}
      else {const fc=await boundaryOf(place);point=centroid(fc.features[0]);}
    } catch {}
    const dist=s=>point?Math.hypot((s.coord[0]-point[0])*Math.cos(point[1]*Math.PI/180),s.coord[1]-point[1])*111.2:null;
    complete.sort((x,y)=>(dist(x)??0)-(dist(y)??0)||x.name.localeCompare(y.name));
    const chosen=complete.find(s=>s.id===app.state.t.stn)??complete[0];
    // One request per normal: a station publishes up to about 1,400 normals, so an unfiltered page can miss these three.
    const [precip,high,low]=await Promise.all(['56','5','8'].map(async id=>{
      const d=await request(`${base}?${new URLSearchParams({f:'json',limit:'20',STN_ID:chosen.id,NORMAL_ID:id})}`);
      return Array.from({length:12},(_,i)=>d.features.find(f=>f.properties.MONTH===i+1)?.properties.VALUE??null);}));
    if(!ctx.alive())return;
    const km=dist(chosen);
    const select=h('select',{class:'station-select','aria-label':'Climate station',onchange:e=>{app.set('stn',e.target.value);climateCard(target,ctx);}},
      complete.slice(0,60).map(s=>{const o=new Option(`${s.name}${dist(s)!=null?` · ${Math.round(dist(s))} km`:''}`,s.id);o.selected=s.id===chosen.id;return o;}));
    const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    el.replaceChildren(chartCard({title:'Climate summary',subtitle:`Monthly precipitation and average daily high and low · ${chosen.name}, normals ${chosen.period}${km!=null?` · ${Math.round(km)} km from ${anchor}`:''}`,
      meta:{source:'Environment and Climate Change Canada, Canadian Climate Normals (api.weather.gc.ca)',url:'https://api.weather.gc.ca/collections/climate-normals',
        geo:`Station ${chosen.name} (ECCC station ${chosen.id}); not an average for ${place.name}`,period:`${chosen.period} normals`,
        table:()=>({headers:['Month','Precipitation (mm)','Daily high (°C)','Daily low (°C)'],rows:monthNames.map((m,i)=>[m,precip[i],high[i],low[i]]),numeric:new Set([1,2,3]),format:v=>String(v)})}},
      h('div',{class:'body'},h('label',{class:'station-row'},'Station ',select),climate({precip,high,low,height:330})),
      legend([['Monthly precipitation (mm)','#b4cbd1'],['Low (°C)','#326b7a'],['High (°C)','#a35334']])));
  },{alive:ctx.alive,context:'Climate summary'});
}
