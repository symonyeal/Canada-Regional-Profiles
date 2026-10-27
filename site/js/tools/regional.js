// Regional brief and peer comparisons. Legend: p,b = Census profiles; m = measure;
// g = geography; d = loaded profile; a = live render generation; v = observation.
import {census} from '../api.js';
import {CANADA,PT,TYPES,int} from '../model.js';
import {MEASURES,show,difference,peerIds} from '../regional-model.js';
import {h,kpiCard,chartCard,dataTable,loading,failure} from '../ui.js';
import {barList,lines} from '../charts.js';
import {PRIMARY} from '../palette.js';
import {lifetime,sharedPair,censusMeta,populationSeries,tableMeta,slot} from './common.js';

const provinces=()=>PT.map(([c,,name])=>({id:`2021A0002${c}`,type:'PR',province:c,name}));
const observation=(m,p)=>p.value(m.char);
const note=()=>h('p',{class:'period-note'},'Census 2021 · income refers to 2020. Same-period comparisons; a live request does not make the observations current.');
const meta=(g,table)=>({...censusMeta(g),table});
const rowTable=(geos,data,ms)=>({headers:['Region',...ms.map(m=>`${m.label} (${m.period})`)],
  rows:geos.map((g,i)=>[g.name,...ms.map(m=>data[i]?observation(m,data[i]):null)]),numeric:new Set(ms.map((_,i)=>i+1)),format:(v,i)=>i?show(ms[i-1],v):v});

export function overview(el,app) {
  const life=lifetime(el);
  function render() {
    const a=life.next(),strip=h('div',{class:'brief-kpis'}),body=h('div',{class:'brief-body'});
    el.replaceChildren(note(),strip,body);
    slot(strip,async t=>{
      const g=await app.resolved(),{p,b}=await sharedPair(g,app.bench);if(!a())return;
      const ms=['population','employment','income','rent'].map(id=>MEASURES.find(m=>m.id===id));
      t.replaceChildren(...ms.map(m=>{
        const v=observation(m,p),w=b?observation(m,b):null;
        const c=kpiCard({title:m.label,value:show(m,v),sub:m.period,
          meta:meta(g,()=>({headers:['Region',m.label],rows:[[g.name,v],...(b?[[app.bench.name,w]]:[])],numeric:new Set([1]),format:(v,i)=>i?show(m,v):v}))});
        c.append(h('p',{class:'kpi-context'},m.id==='population'?`${show(MEASURES[1],p.value('3'))} since 2016`:b?`${difference(m,v,w)} vs ${app.bench.name}`:'Published national value'));
        return c;
      }));
      const panel=h('div');body.prepend(panel);
      if(g.id===CANADA.id)national(panel,a);else regional(panel,g,p,b,app.bench);
    },{alive:a,context:'Regional overview'});
    const recent=h('details',{class:'recent-detail'},h('summary',{},'Recent population estimates'),h('div',{class:'recent-body'}));
    let started=false;
    recent.addEventListener('toggle',()=>{if(!recent.open||started)return;started=true;
      slot(recent.lastChild,async t=>{const g=await app.resolved(),d=await populationSeries(g);if(!a())return;
        const fin=d.values.filter(v=>v.value!=null),first=fin[0],last=fin.at(-1);
        if(!first||!last)throw new Error('No annual population observations published.');
        t.replaceChildren(chartCard({title:`${int(last.value)} residents in ${last.year}`,subtitle:`${d.geoName} · July 1 estimates, ${first.year}–${last.year}. Separate from Census counts above.`,
          meta:{...tableMeta(d,{universe:'Total population, annual estimates'}),table:()=>({headers:['Year','Population'],rows:d.values.map(v=>[String(v.year),v.value]),numeric:new Set([1]),format:(v,i)=>i?int(v):v})}},
          h('div',{class:'body'},lines({x:d.values.map(v=>String(v.year)),series:[{name:g.name,values:d.values.map(v=>v.value),color:PRIMARY,fmt:int}],fmt:int,height:240}))));
      },{alive:a,context:'Recent population estimates'});
    });
    body.append(recent);
  }
  return {update(c){if(['geo','bench','refresh'].some(k=>c.has(k)))render();}};
}
async function national(el,a) {
  loading(el,'Comparing provinces and territories…');
  const geos=provinces(),m=MEASURES.find(m=>m.id==='employment');
  const results=await Promise.allSettled(geos.map(census));if(!a())return;
  const data=results.map(r=>r.status==='fulfilled'?r.value:null),known=data.filter(Boolean);
  if(!known.length){failure(el,results[0].reason,()=>national(el,a),'Provincial comparison unavailable');return;}
  el.replaceChildren(chartCard({title:'Employment rates across provinces and territories',subtitle:'Share of population aged 15+ employed, Census 2021. Territories first, then west to east.',
    meta:meta({name:'Provinces and territories'},()=>rowTable(geos,data,[m]))},
    h('div',{class:'body national-bars'},barList(geos.map((g,i)=>({label:g.name,value:data[i]?.value(m.char)??null,text:data[i]?show(m,data[i].value(m.char)):'Source unavailable'})),{max:100,size:'sm'}))));
}
function regional(el,g,p,b,bench) {
  const ms=MEASURES.filter(m=>m.id!=='population'),rates=ms.filter(m=>m.unit==='%'&&p.value(m.char)!=null&&b?.value(m.char)!=null);
  rates.sort((x,y)=>Math.abs(p.value(y.char)-b.value(y.char))-Math.abs(p.value(x.char)-b.value(x.char)));
  const m=rates[0],v=m?p.value(m.char)-b.value(m.char):null;
  const finding=m?`${m.label}: ${Math.abs(v).toFixed(1)} percentage points ${v<0?'below':'above'} ${bench.name}`:`${g.name}: population and living conditions`;
  const t=()=>({headers:['Measure',g.name,...(b?[bench.name,'Difference']:[])],rows:ms.map(m=>[`${m.label} · ${m.period}`,show(m,p.value(m.char)),...(b?[show(m,b.value(m.char)),difference(m,p.value(m.char),b.value(m.char))]:[])]),numeric:new Set([1,2,3])});
  el.replaceChildren(chartCard({title:finding,subtitle:b?'Largest absolute gap among the population-change and labour-market rates below. Differences in rates are percentage points (pp).':'Benchmark unavailable; the selected area’s published values remain visible.',meta:meta(g,t)},dataTable(t())));
}

export function compare(el,app) {
  const life=lifetime(el);let list=[];
  async function render() {
    const a=life.next(),g=await app.resolved();if(!a())return;
    const national=g.id===CANADA.id;
    const controls=h('div',{class:'compare-controls'}),chips=h('div',{class:'peer-chips'}),out=h('div',{'aria-live':'polite'});
    el.replaceChildren(h('p',{class:'section-intro'},national?'Compare all provinces and territories using the same published Census measures.':'Add up to three peers at the same geography level. All columns use the same Census period.'),controls,chips,note(),out);
    const metric=h('select',{'aria-label':'Comparison measure'},MEASURES.filter(m=>m.id!=='growth').map(m=>{const o=new Option(m.label,m.id);o.selected=m.id===app.state.t.cm;return o;}));
    metric.onchange=()=>{app.set('cm',metric.value);render();};
    controls.append(h('label',{class:'field'},h('span',{},'Chart measure'),metric));
    const ids=peerIds(app.state.t.peers,g);
    if(!national){
      const input=h('input',{type:'search',placeholder:`Search ${TYPES[g.type].toLowerCase()} peers`,'aria-label':'Find a peer'}),results=h('div',{class:'peer-results'});
      const box=h('div',{class:'peer-picker'},h('label',{class:'field'},h('span',{},'Add a region'),input),results);controls.prepend(box);
      const choose=geo=>{if(ids.length>=3)return;app.set('peers',[...ids,geo.id].join(','));render();};
      input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();results.replaceChildren(...(q?list.filter(x=>x.id!==g.id&&!ids.includes(x.id)&&(x.name.toLowerCase().includes(q)||x.id.includes(q))).slice(0,8).map(x=>h('button',{type:'button',class:'peer-result',onclick:()=>choose(x)},x.description??x.name,h('small',{},x.id.slice(9)))):[]));});
      input.disabled=ids.length>=3;
      try {list=g.type==='PR'?provinces():await app.placeList(g.type);}catch(e){if(a())failure(out,e,render,'Peer list unavailable');return;}
      if(!a())return;
    }
    const geos=national?provinces():[g,...ids.map(id=>list.find(x=>x.id===id)).filter(Boolean)];
    if(!national){
      chips.append(h('span',{class:'peer-chip'},g.name));
      for(const peer of geos.slice(1))chips.append(h('button',{type:'button',class:'peer-chip',onclick:()=>{app.set('peers',ids.filter(id=>id!==peer.id).join(','));render();},'aria-label':`Remove ${peer.name}`},peer.name,' ×'));
    }
    loading(out,'Comparing published Census profiles…');
    const results=await Promise.allSettled(geos.map(census));if(!a())return;
    const data=results.map(r=>r.status==='fulfilled'?r.value:null),m=MEASURES.find(m=>m.id===app.state.t.cm)??MEASURES[2];
    if(data.every(p=>!p)){failure(out,results[0].reason,render,'Comparison unavailable');return;}
    const chart=chartCard({title:`${m.label} · ${m.period}`,subtitle:`${m.unit==='%'?'Share (%)':m.unit} · ${geos.length} ${geos.length===1?'region':'regions'}${!national&&geos.length===1?' · add a peer to compare':''}`,meta:meta({name:geos.map(g=>g.name).join('; ')},()=>rowTable(geos,data,[m]))},
      h('div',{class:'body'},barList(geos.map((g,i)=>({label:g.name,value:data[i]?.value(m.char)??null,text:data[i]?show(m,data[i].value(m.char)):'Source unavailable'})),{max:m.unit==='%'?100:undefined})));
    out.replaceChildren(chart,h('div',{class:'comparison-table'},dataTable(rowTable(geos,data,MEASURES.filter(m=>['population','employment','unemployment','income','rent'].includes(m.id))))));
    if(data.some(p=>!p))out.prepend(h('p',{class:'notice'},'Some regions could not be retrieved. Their values are unavailable, not zero.'));
  }
  return {update(c){if(['geo','peers','cm','refresh'].some(k=>c.has(k)))render();}};
}
