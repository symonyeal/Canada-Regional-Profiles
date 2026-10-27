// Findings and peer comparisons. Legend: g = geography; p,b = selected/benchmark Census profiles;
// C = cohort {label, areas, P}; m = measure; r = finding row; a = live render generation.
import {census,censusMany,request} from '../api.js';
import {CANADA,PT,int,pct,compact} from '../model.js';
import {MEASURES,MEASURE_IDS,SIMILAR,measure,show,difference,findings,standing,rankText,similar,sectorBase,peerIds} from '../regional-model.js';
import {latest,valueText,changeText} from '../trend-model.js';
import {h,chartCard,dataTable,loading,failure,segmented} from '../ui.js';
import {barList,strip,legend,lines} from '../charts.js';
import {PRIMARY,COMPARE} from '../palette.js';

// The cohort's dots: PRIMARY at the strip's 16 % opacity over the page.
const COHORT='#cfd8cd';
import {lifetime,sharedPair,censusMeta,slot,cohort,cohortAreas,trendSeries,provinceName} from './common.js';
import {trendPanel,trendsFor} from './trends.js';

const note=()=>h('p',{class:'period-note'},'Census 2021 · income refers to 2020. Same-period comparisons; a live request does not make the observations current.');
const recentNote=()=>h('p',{class:'period-note'},'Annual series from Statistics Canada tables (population estimates, Labour Force Survey, tax data, CMHC rents) and the OECD regional database. Each card gives the latest year published for this area and compares the benchmark and comparable areas in that same year. Survey definitions differ from the Census measures below.');
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

// The strip key: selected area, benchmark and cohort, as the strips draw them.
const keyFor=(g,bench,C,national)=>legend([...(national?[]:[[g.name,PRIMARY,'dot']]),...(bench||national?[[national?'Canada':bench.name,COMPARE,'tick']]:[]),
  ...(C?[[`${C.areas.length} ${C.label}`,COHORT,'dot']]:[])]);

// One latest finding: annual measure m and its latest standing r in year y, with the benchmark and the cohort in y.
function recentFinding(m,r,{C,bench,national,g,S}) {
  const fmt=x=>valueText(m.unit,x),when=y=>m.period?.(y)??String(y),rank=rankText(r.standing);
  const named=national?C.areas.map((a,i)=>[a.name,r.X[i]]).filter(([,v])=>v!=null).sort((s,t)=>t[1]-s[1]):[];
  const context=[national?named.length?`Provinces and territories range from ${named.at(-1)[0]} (${fmt(named.at(-1)[1])}) to ${named[0][0]} (${fmt(named[0][1])}).`:''
    :rank?`${rank[0].toUpperCase()}${rank.slice(1)} ${C.label}${r.standing.n<C.areas.length?' publishing it':''} in ${when(r.y)}.`:'',
    !national&&r.w!=null&&m.unit!=='people'?`${bench.name} ${fmt(r.w)} (${m.unit==='%'||m.unit.startsWith('$')?difference(m,r.x,r.w):changeText(m.unit,{d:r.x-r.w})}).`:'',
    r.change?.d!=null?`${changeText(m.unit,r.change)} since ${when(r.y0)}.`:''].filter(Boolean).join(' ');
  return h('article',{class:'finding'},
    h('div',{class:'finding-head'},h('span',{class:'finding-theme'},m.theme),h('h3',{},m.label),h('span',{class:'finding-period'},when(r.y))),
    h('div',{class:'finding-value'},fmt(r.x)),
    h('p',{class:'finding-text'},context),
    strip({X:r.X,x:national?null:r.x,w:national||m.unit==='people'?null:r.w,format:fmt}),
    recentHistory(m,S.get(g.id),g));
}

// A visible history next to each current finding. Gaps stay gaps; the source menu keeps the plotted values.
function recentHistory(m,s,g) {
  if(!s)return null;
  const last=s.values.filter(v=>v.value!=null).at(-1)?.year;
  const V=s.values.filter(v=>v.year>=last-14&&v.year<=last);
  if(V.filter(v=>v.value!=null).length<2)return h('p',{class:'finding-history'},'Only one year published.');
  const period=`${V[0].year}–${V.at(-1).year}`,fmt=v=>m.unit==='people'?compact(v):m.unit.startsWith('$')?`$${compact(v)}`:valueText(m.unit,v);
  return h('div',{class:'finding-history'},chartCard({title:`${g.name} · ${period}`,
    meta:{source:s.source,url:s.url,geo:g.name,period,universe:m.survey,notes:m.note,
      table:()=>({headers:['Year',`${m.label} (${m.unit})`],rows:V.map(v=>[String(v.year),v.value]),numeric:new Set([1]),format:(v,i)=>i?valueText(m.unit,v):v})}},
    lines({x:V.map(v=>String(v.year)),series:[{name:g.name,values:V.map(v=>v.value),color:PRIMARY,fmt:v=>valueText(m.unit,v)}],fmt,height:136,markers:false})),
    h('p',{class:'chart-source'},s.source));
}

// Latest annual values: every annual measure published at the area's level, read once for the area, its benchmark
// and its cohort. A source failing for one measure names that measure and leaves the others drawn.
async function recent(t,app,a,key) {
  const g=await app.resolved(),national=g.id===CANADA.id,bench=national?null:app.bench,M=trendsFor(g).filter(m=>!m.fit);if(!a())return;
  if(!M.length){t.replaceChildren(h('li',{class:'notice'},'No annual series is published for this geography level; the Census 2021 values follow.'));return;}
  const C=await cohortAreas(g,app.placeList),R=[...new Map([g,...(bench?[bench]:[]),...C.areas].map(x=>[x.id,x])).values()];
  if(!a())return;
  key.replaceChildren(keyFor(g,bench,C,national));
  // Independent slots: a slow OECD response must not hide already available Statistics Canada measures.
  const slots=M.map(()=>h('li',{class:'recent-slot'}));t.replaceChildren(...slots);
  M.forEach((m,i)=>{
    slot(slots[i],async host=>{
      const S=await trendSeries(m,R);if(!a())return;
      const r=latest(m,S.get(g.id)?.values,bench?S.get(bench.id)?.values:null,C.areas.map(x=>S.get(x.id)?.values));
      if(!r){host.replaceChildren(h('p',{class:'notice'},`${m.label}: no annual value published for ${g.name}.`));return;}
      host.replaceChildren(recentFinding(m,{...r,standing:national?null:standing(r.x,r.X)},{C,bench,national,g,S}));
    },{alive:a,context:m.label,text:`Loading ${m.label.toLowerCase()}…`});
  });
}

// Two readable cohort rankings share the profiles already requested for the findings.
// Large cohorts show both extremes and the selected area; the menu retains the complete ranking.
function cohortCharts(el,g,C,bench,b) {
  if(!C){el.replaceChildren(h('p',{class:'notice'},'Regional charts appear when comparable Census profiles are available.'));return;}
  const options=MEASURES.filter(m=>!['population','growth'].includes(m.id));
  el.replaceChildren(...['employment','income'].map(id=>{
    const host=h('section',{class:'cohort-chart'}),pick=h('select',{'aria-label':`Regional comparison: ${id}`},options.map(m=>new Option(m.label,m.id)));
    pick.value=id;const body=h('div');
    const draw=()=>{
      const m=measure(pick.value),all=C.areas.map((x,i)=>{const value=C.P[i]?m.of(C.P[i]):null;return {id:x.id,label:x.name,value,text:show(m,value)};})
        .sort((p,q)=>(q.value??-Infinity)-(p.value??-Infinity));
      const published=all.filter(x=>x.value!=null),short=published.length>15;
      const wanted=new Set(short?[...published.slice(0,6),...published.slice(-6),...published.filter(x=>x.id===g.id)].map(x=>x.id):published.map(x=>x.id));
      const rows=published.filter(x=>wanted.has(x.id)),w=b?m.of(b):null;
      const table=()=>({headers:['Region',`${m.label} (${m.period})`],rows:all.map(x=>[x.label,x.value]),numeric:new Set([1]),format:(v,i)=>i?show(m,v):v});
      body.replaceChildren(chartCard({title:`${m.label} · ${m.period}`,subtitle:`${C.label}; highest first. ${short?'Six highest, six lowest and the selected area; all regions in the data table. ':''}${all.length>published.length?`${all.length-published.length} without a published value.`:''}`,
        meta:meta({name:C.label},table)},
        published.length?barList(rows.map(x=>({...x,color:x.id===g.id?PRIMARY:'var(--cohort-bar)',bench:w,benchText:w==null?null:show(m,w)})),{benchName:bench?.name}):h('p',{class:'notice'},'No values published.'),
        bench&&w!=null?legend([[g.name,PRIMARY],[bench.name,COMPARE,'tick']]):null,
        h('p',{class:'chart-source'},'Statistics Canada · Census 2021; income refers to 2020.')));
    };
    pick.onchange=draw;host.append(h('label',{class:'field'},h('span',{},'Compare a Census measure'),pick),body);draw();return host;
  }));
}

export function overview(el,app) {
  const life=lifetime(el);
  function render() {
    const a=life.next(),key=h('div',{class:'strip-key'}),latestList=h('ol',{class:'findings recent'}),list=h('ol',{class:'findings census'});
    const base=h('div',{class:'brief-body'}),rest=h('div',{class:'brief-body'}),over=h('div',{class:'trend-panel'}),across=h('div',{class:'cohort-charts'});
    el.replaceChildren(h('h3',{class:'subhead first'},'Latest published year'),recentNote(),key,latestList,h('h3',{class:'subhead'},'Census 2021'),note(),list,
      h('h3',{class:'subhead'},'Across comparable areas'),across,h('h3',{class:'subhead'},'Over time'),trendNote(),over,base,rest);
    slot(latestList,t=>recent(t,app,a,key),{alive:a,context:'Latest published year'});
    // The profiles need only the DGUID: start them while the geography list resolves the name; the request cache joins them.
    for(const geo of [app.state.geo,...(app.state.t.bench==='CA'?[CANADA]:[])])census(geo).catch(()=>{});
    slot(list,async t=>{
      const g=await app.resolved(),bench=app.bench,national=g.id===CANADA.id,{p,b}=await sharedPair(g,bench);if(!a())return;
      const draw=(C,error)=>{
        const F=findings(p,national?p:b,C?.P??null,{national});
        if(C)key.replaceChildren(keyFor(g,b?bench:null,C,national));
        t.replaceChildren(...F.headline.map(r=>finding(r,{C,bench:national?CANADA:bench,national})));
        if(error)t.append(h('li',{class:'notice'},`Ranks unavailable: ${error.message}`));
        if(!national)sectorCard(base,g,p,b,bench);
        cohortCharts(across,g,C,national?null:bench,b);
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
