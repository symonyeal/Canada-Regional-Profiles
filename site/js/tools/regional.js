// Findings and peer comparisons. Legend: g = geography; p,b = selected/benchmark Census profiles;
// C = cohort {label, areas, P}; m = measure; r = finding row; a = live render generation.
import {census,censusMany,request} from '../api.js';
import {CANADA,PT,int,pct} from '../model.js';
import {MEASURES,MEASURE_IDS,SIMILAR,measure,show,difference,findings,rankText,similar,sectorBase,peerIds} from '../regional-model.js';
import {h,chartCard,dataTable,loading,failure,segmented} from '../ui.js';
import {barList,strip,legend} from '../charts.js';
import {PRIMARY,COMPARE} from '../palette.js';

// The cohort's dots: PRIMARY at the strip's 16 % opacity over the page.
const COHORT='#cfd8cd';
import {lifetime,sharedPair,censusMeta,slot,cohort,provinceName} from './common.js';
import {trendPanel} from './trends.js';

const note=()=>h('p',{class:'period-note'},'Census 2021 · income refers to 2020. Same-period comparisons; a live request does not make the observations current.');
const trendNote=()=>h('p',{class:'period-note'},'Annual series from Statistics Canada tables (population estimates, Labour Force Survey, tax data, CMHC rents) and the OECD regional database, separate from the Census 2021 values. The range covers the years published for every area shown.');
const meta=(g,table,notes)=>({...censusMeta(g,{notes}),table});

// One finding: measure, value, standing in the cohort, benchmark and the cohort's distribution.
function finding(r,{C,bench,national}) {
  const {m,x,w,X}=r;
  let context;
  if(national&&X){const named=C.areas.map((a,i)=>[a.name,X[i]]).filter(([,v])=>v!=null).sort((s,t)=>t[1]-s[1]);
    context=named.length?`Provinces and territories range from ${named.at(-1)[0]} (${show(m,named.at(-1)[1])}) to ${named[0][0]} (${show(m,named[0][1])}).`:'';}
  else context=[r.standing?`${rankText(r.standing)[0].toUpperCase()}${rankText(r.standing).slice(1)} ${C.label}.`:C?'':'Ranking among comparable areas…',
    w!=null?`${bench.name} ${show(m,w)} (${difference(m,x,w)}).`:''].filter(Boolean).join(' ');
  return h('li',{class:'finding'},
    h('div',{class:'finding-head'},h('span',{class:'finding-theme'},m.theme),h('h3',{},m.label),h('span',{class:'finding-period'},m.period)),
    h('div',{class:'finding-value'},show(m,x)),
    h('p',{class:'finding-text'},context),
    X?strip({X,x:national?null:x,w,format:v=>show(m,v)}):h('div',{class:'strip'}));
}

export function overview(el,app) {
  const life=lifetime(el);
  function render() {
    const a=life.next(),key=h('div',{class:'strip-key'}),list=h('ol',{class:'findings'}),base=h('div',{class:'brief-body'}),rest=h('div',{class:'brief-body'});
    const over=h('div',{class:'trend-panel'});
    el.replaceChildren(note(),key,list,h('h3',{class:'subhead'},'Over time'),trendNote(),over,base,rest);
    // The profiles need only the DGUID: start them while the geography list resolves the name; the request cache joins them.
    for(const geo of [app.state.geo,...(app.state.t.bench==='CA'?[CANADA]:[])])census(geo).catch(()=>{});
    slot(list,async t=>{
      const g=await app.resolved(),bench=app.bench,national=g.id===CANADA.id,{p,b}=await sharedPair(g,bench);if(!a())return;
      const draw=(C,error)=>{
        const F=findings(p,national?p:b,C?.P??null,{national});
        key.replaceChildren(legend([...(national?[]:[[g.name,PRIMARY,'dot']]),...(b||national?[[national?'Canada':bench.name,COMPARE,'tick']]:[]),...(C?[[`${C.areas.length} ${C.label}`,COHORT,'dot']]:[])]));
        t.replaceChildren(...F.headline.map(r=>finding(r,{C,bench:national?CANADA:bench,national})));
        if(error)t.append(h('li',{class:'notice'},`Ranks unavailable: ${error.message}`));
        if(!national)sectorCard(base,g,p,b,bench);
        measureTable(rest,g,F,C,national?null:bench,national);
      };
      draw(null);
      try {const C=await cohort(g,app.placeList);if(a())draw(C);}catch(e){if(a())draw(null,e);}
    },{alive:a,context:'Findings'});
    app.resolved().then(g=>{if(!a())return;const national=g.id===CANADA.id;
      trendPanel(over,app,{g,alive:a,rows:async()=>national?[{...CANADA}]:[g,{...app.bench,bench:true}].filter((r,i)=>i===0||r.id!==g.id),cohort:()=>cohort(g,app.placeList)});});
  }
  return {update(c){if(['geo','bench','refresh','tm','yr'].some(k=>c.has(k)))render();}};
}

// Resident workers' sectors against the benchmark: the three most over-represented and the mix difference D.
function sectorCard(el,g,p,b,bench) {
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

function measureTable(el,g,F,C,bench,national) {
  const t=()=>({headers:['Measure',national?'Canada':g.name,...(bench?[bench.name,'Difference']:[]),...(national?['Lowest','Highest']:['Rank'])],
    rows:F.rows.map(r=>{const Y=r.X?.filter(Number.isFinite)??[];return [`${r.m.label} · ${r.m.period}`,show(r.m,r.x),...(bench?[show(r.m,r.w),difference(r.m,r.x,r.w)]:[]),
      ...(national?[Y.length?show(r.m,Math.min(...Y)):null,Y.length?show(r.m,Math.max(...Y)):null]:[rankText(r.standing)])];}),numeric:new Set([1,2])});
  el.replaceChildren(h('details',{class:'recent-detail'},h('summary',{},`All ${F.rows.length} measures${C?` · ranked among ${C.label}`:''}`),
    chartCard({title:'All measures',subtitle:C?`Ranks are among ${C.areas.length} ${C.label} with a published value; 1 is the highest.`:'',meta:meta(g,t)},dataTable(t()))));
}

// ---------- Compare ----------
const COLUMNS=['population','growth','age','employment','income','burden','renters','degree'];
const MODES=[['similar','Most similar'],['near','Neighbours'],['chosen','Your choice']];
const rowTable=(rows,ms)=>({headers:['Region',...ms.map(m=>`${m.label} (${m.period})`)],
  rows:rows.map(r=>[r.name,...ms.map(m=>r.p?m.of(r.p):null)]),numeric:new Set(ms.map((_,i)=>i+1)),format:(v,i)=>i?show(ms[i-1],v):v});

export function compare(el,app) {
  const life=lifetime(el);
  async function render() {
    const a=life.next(),g=await app.resolved();if(!a())return;
    const national=g.id===CANADA.id||g.type==='PR',local=['CSD','CD'].includes(g.type);
    const modes=MODES.filter(([k])=>k!=='near'||local),mode=modes.some(([k])=>k===app.state.t.pm)?app.state.t.pm:'similar';
    const controls=h('div',{class:'compare-controls'}),out=h('div',{'aria-live':'polite'});
    el.replaceChildren(controls,note(),out);
    const metric=h('select',{'aria-label':'Chart measure'},MEASURES.filter(m=>m.id!=='population').map(m=>{const o=new Option(m.label,m.id);o.selected=m.id===app.state.t.cm;return o;}));
    metric.onchange=()=>{app.set('cm',metric.value);render();};
    if(g.id!==CANADA.id)controls.append(segmented(modes,mode,k=>{app.set('pm',k);render();},'Peer set'));
    controls.append(h('label',{class:'field'},h('span',{},'Chart measure'),metric));
    loading(out,'Comparing published Census profiles…');
    let rows,why;
    try {
      if(g.id===CANADA.id){const C=await cohort(g,app.placeList);rows=C.areas.map((x,i)=>({...x,p:C.P[i]}));why='All provinces and territories, territories first.';}
      else if(mode==='similar'){
        const C=await cohort(g,app.placeList),i=C.areas.findIndex(x=>x.id===g.id);
        rows=[i,...similar(C.P,i,5).map(s=>s.j)].map(j=>({...C.areas[j],p:C.P[j]}));
        why=`The five ${C.label} closest to ${g.name} on ${SIMILAR.map(id=>measure(id).label.toLowerCase()).join(', ')}, each standardised among the ${C.areas.length} areas.`;
      } else if(mode==='near'){
        const pr=String(g.province??g.id.slice(9,11)).split('_')[0],N=(await request(`boundaries/neighbours-${pr}.json`))[g.id]??[];
        const names=new Map((await app.placeList(g.type)).map(x=>[x.id,x])),P=await censusMany(g.type,[g.id,...N],MEASURE_IDS);
        rows=[g.id,...N].map(id=>({...(names.get(id)??{id,name:id}),p:P.get(id)?.rows.length?P.get(id):null}));
        why=N.length?`${g.name} and the ${N.length} ${g.type==='CSD'?'municipalities':'census divisions'} sharing a border with it in ${provinceName(pr)}.`:`${g.name} shares no border with another area of its type in ${provinceName(pr)}.`;
      } else {
        const ids=peerIds(app.state.t.peers,g),list=national?PT.map(([c,,name])=>({id:`2021A0002${c}`,type:'PR',name})):await app.placeList(g.type);if(!a())return;
        picker(controls,g,ids,list);
        const geos=[g,...ids.map(id=>list.find(x=>x.id===id)).filter(Boolean)],P=await Promise.allSettled(geos.map(census));
        rows=geos.map((x,i)=>({...x,p:P[i].status==='fulfilled'?P[i].value:null}));
        why=ids.length?'Peers you added; links keep them.':'Add up to three peers of the same geography type.';
      }
    } catch(e) {if(a())failure(out,e,render,'Comparison unavailable');return;}
    if(!a())return;
    const bench=g.id===CANADA.id?null:app.bench,b=bench?await census(bench).catch(()=>null):null;if(!a())return;
    const all=[...rows,...(b?[{...bench,p:b,bench:true}]:[])],m=measure(app.state.t.cm)??measure('employment'),ms=COLUMNS.map(measure);
    const chart=chartCard({title:`${m.label} · ${m.period}`,subtitle:why,meta:meta({name:all.map(r=>r.name).join('; ')},()=>rowTable(all,MEASURES))},
      h('div',{class:'body'},barList(all.map(r=>({label:`${r.name}${r.bench?' (benchmark)':''}`,value:r.p?m.of(r.p):null,text:r.p?show(m,m.of(r.p)):'Source unavailable'})),{max:m.unit==='%'?100:undefined})));
    const over=h('div',{class:'trend-panel'});
    out.replaceChildren(chart,h('div',{class:'comparison-table'},dataTable(rowTable(all,ms))),h('h3',{class:'subhead'},'Over time'),trendNote(),over);
    // Canada's comparison lists the provinces and territories; Canada joins the annual view as their benchmark.
    trendPanel(over,app,{g,alive:a,rows:async()=>[...all.map(r=>({id:r.id,type:r.type??g.type,name:r.name,bench:!!r.bench})),...(g.id===CANADA.id?[{...CANADA,bench:true}]:[])]});
    if(rows.some(r=>!r.p))out.prepend(h('p',{class:'notice'},'Some regions could not be retrieved. Their values are unavailable, not zero.'));
  }
  // Manual peers: search the same-level list; chips remove a peer.
  function picker(controls,g,ids,list) {
    const input=h('input',{type:'search',placeholder:'Search peers','aria-label':'Find a peer',disabled:ids.length>=3}),results=h('div',{class:'peer-results'});
    input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();results.replaceChildren(...(q?list.filter(x=>x.id!==g.id&&!ids.includes(x.id)&&x.name.toLowerCase().includes(q)).slice(0,8)
      .map(x=>h('button',{type:'button',class:'peer-result',onclick:()=>{app.set('peers',[...ids,x.id].join(','));render();}},x.description??x.name,h('small',{},x.id.slice(9)))):[]));});
    controls.append(h('div',{class:'peer-picker'},h('label',{class:'field'},h('span',{},'Add a region'),input),results),
      h('div',{class:'peer-chips'},ids.map(id=>{const x=list.find(y=>y.id===id);return h('button',{type:'button',class:'peer-chip','aria-label':`Remove ${x?.name??id}`,
        onclick:()=>{app.set('peers',ids.filter(y=>y!==id).join(','));render();}},x?.name??id,' ×');})));
  }
  return {update(c){if(['geo','bench','peers','cm','pm','refresh','tm','yr'].some(k=>c.has(k)))render();}};
}
