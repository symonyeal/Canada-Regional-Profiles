// Annual measures over the years every shown area publishes, with a chosen range. Legend: m = annual measure;
// R = shown areas [{id, type, name, bench}]; D = Map id → series; Y = common years; [a, c] = chosen range;
// C = cohort {label, areas} for ranks; E = Map id → cohort series; Q = cohort changes over [a, c].
import {CANADA} from '../model.js';
import {TRENDS,commonYears,parseRange,clampRange,rangeText,change,changeText,valueText} from '../trend-model.js';
import {standing,rankText} from '../regional-model.js';
import {h,chartCard,dataTable,loading,failure,rangeSlider} from '../ui.js';
import {lines,legend} from '../charts.js';
import {PRIMARY,COMPARE} from '../palette.js';
import {trendSeries,levelOf} from './common.js';

const relative=m=>m.unit==='people'||m.unit.startsWith('$');
const span=s=>{const v=s.values.filter(p=>p.value!=null);return v.length?rangeText([v[0].year,v.at(-1).year]):'';};
// The selected area is drawn in PRIMARY, the benchmark in COMPARE and other areas as grey context lines.
const OTHER='#b4beb4';
const short=t=>t.replace(/^Statistics Canada, table ([\d-]+).*/,'Statistics Canada $1').replace(/^OECD Regional Statistics.*/,'OECD');

// Measures with a source at the selected area's level; m falls back to the first of them.
export const trendsFor=g=>TRENDS.filter(m=>m.source[levelOf(g)]);

// Draw the panel into el. rows() resolves R (selected area first); cohort(), when given, resolves C. The view
// redraws on range changes without new requests; alive() guards every write.
export function trendPanel(el,app,{g,rows,cohort,alive,title='Over time'}) {
  const M=trendsFor(g);
  if(!M.length){el.replaceChildren(h('p',{class:'notice'},'No annual series is published for this geography level; the values above are Census 2021.'));return;}
  const m=M.find(x=>x.id===app.state.t.tm)??M[0];
  const pick=h('select',{'aria-label':'Annual measure'},M.map(x=>{const o=new Option(x.label,x.id);o.selected=x===m;return o;}));
  const body=h('div',{'aria-live':'polite'});
  el.replaceChildren(h('div',{class:'compare-controls trend-controls'},h('label',{class:'field'},h('span',{},'Annual measure'),pick)),body);
  pick.onchange=()=>{app.set('tm',pick.value);trendPanel(el,app,{g,rows,cohort,alive,title});};
  loading(body,`Reading every published year of ${m.label.toLowerCase()}…`);
  (async()=>{
    let R,D;
    try {R=await rows();D=await trendSeries(m,R);}
    catch(e){if(alive())failure(body,e,()=>trendPanel(el,app,{g,rows,cohort,alive,title}),title);return;}
    if(!alive())return;
    const shown=R.filter(r=>D.has(r.id)),missing=R.filter(r=>!D.has(r.id)),Y=commonYears(shown.map(r=>D.get(r.id).values));
    if(!shown.length||!Y.length){body.replaceChildren(h('p',{class:'notice'},shown.length
      ?`No year is published for every area shown: ${shown.map(r=>`${r.name} ${span(D.get(r.id))}`).join('; ')}.`
      :`${m.label} is not published annually for ${R.map(r=>r.name).join(', ')}.`));return;}
    let C=null,E=null;
    const view=h('div'),w0=clampRange(Y,parseRange(app.state.t.yr));
    const slider=Y.length>1?rangeSlider({n:Y.length,lo:Y.indexOf(w0[0]),hi:Y.indexOf(w0[1]),label:'Years',ends:[String(Y[0]),String(Y.at(-1))],
      describe:(x,y)=>rangeText([Y[x],Y[y]]),onchange:(x,y)=>{app.set('yr',`${Y[x]}-${Y[y]}`);draw();}}):null;
    body.replaceChildren(...[slider?h('div',{class:'trend-range'},h('span',{class:'field-label'},`Years published for every area shown: ${rangeText([Y[0],Y.at(-1)])}`),slider.el,slider.out):null,view].filter(Boolean));
    const draw=()=>{
      const w=clampRange(Y,parseRange(app.state.t.yr)),[a,c]=w,X=Y.filter(y=>y>=a&&y<=c);
      const K=shown.map(r=>({r,s:D.get(r.id),...change(D.get(r.id).values,w,m.unit,m.fit)}));
      const index=relative(m)&&shown.length>1,at=(s,y)=>s.values.find(p=>p.year===y)?.value??null;
      const fy=v=>index?v.toFixed(0):valueText(m.unit,v);
      const lead=K.find(k=>k.r.id===g.id)??null,bench=K.filter(k=>k.r.bench&&k!==lead),others=K.filter(k=>k!==lead&&!k.r.bench);
      const line=({r,s,x0},color,context)=>({name:r.name,color,width:context?1.25:2,markers:!context,fmt:v=>index?`${v.toFixed(1)} (${a} = 100)`:valueText(m.unit,v),
        values:X.map(y=>{const v=at(s,y);return v==null?null:index?100*v/x0:v;})});
      const series=[...others.map(k=>line(k,OTHER,true)),...bench.map(k=>line(k,COMPARE)),...(lead?[line(lead,PRIMARY)]:[])];
      const ranked=K.filter(k=>k.d!=null).sort((p,q)=>q.d-p.d);
      const Q=E&&C.areas.map(x=>E.has(x.id)?change(E.get(x.id).values,w,m.unit,m.fit).d:null);
      const rank=Q&&lead&&g.id!==CANADA.id&&lead.d!=null?standing(lead.d,Q):null;
      const said=[lead?`${lead.r.name}: ${valueText(m.unit,lead.x0)} in ${a}, ${valueText(m.unit,lead.x1)} in ${c} (${changeText(m.unit,lead)}).`:`${g.name}: not published annually.`,
        ...bench.map(k=>`${k.r.name}: ${changeText(m.unit,k)}.`),
        others.length>1&&ranked.length>2?`Among the areas shown, change runs from ${ranked.at(-1).r.name} (${changeText(m.unit,ranked.at(-1))}) to ${ranked[0].r.name} (${changeText(m.unit,ranked[0])}).`:'',
        rank?`${rankText(rank)[0].toUpperCase()}${rankText(rank).slice(1)} ${C.label} in change over ${rangeText(w)}.`:''].filter(Boolean).join(' ');
      const sources=[...new Map(K.map(k=>[k.s.source,k.s])).values()];
      const full=()=>({headers:['Year',...K.map(k=>k.r.name)],rows:Y.map(y=>[String(y),...K.map(k=>at(k.s,y))]),numeric:new Set(K.map((_,i)=>i+1)),format:(v,i)=>i?valueText(m.unit,v):v});
      const summary={headers:['Area','Source','Published years',String(a),String(c),'Change'],
        rows:K.map(k=>[k.r.name,short(k.s.source),span(k.s),k.x0,k.x1,changeText(m.unit,k)]),numeric:new Set([3,4]),format:(v,i)=>i===3||i===4?valueText(m.unit,v):v};
      view.replaceChildren(...[
        chartCard({title:`${m.label}, ${rangeText(w)}`,subtitle:said,meta:{source:sources.map(x=>x.source).join('; '),
          url:sources[0].url,geo:K.map(k=>k.r.name).join('; '),period:`${rangeText([Y[0],Y.at(-1)])}, every year published for all areas shown`,universe:m.survey,
          notes:[index?`Chart: index, ${a} = 100, so areas of different size share one axis; the table gives the published values.`:'',
            missing.length?`Not published annually for ${missing.map(r=>r.name).join(', ')}.`:'',
            m.fit?'':relative(m)?'Change: per cent over the range and compound annual rate.':'Change: difference over the range.',
            m.unit.startsWith('$')&&!/constant prices/.test(m.survey)?'Current dollars, not adjusted for inflation.':'',m.note??''].filter(Boolean).join(' ')||null,table:full}},
          h('div',{class:'body'},lines({x:X.map(String),series,fmt:fy,height:260})),legend([...(lead?[[lead.r.name,PRIMARY]]:[]),...bench.map(k=>[k.r.name,COMPARE]),...(others.length?[[`${others.length} other area${others.length>1?'s':''} (grey; names in the table)`,OTHER]]:[])])),
        h('div',{class:'comparison-table'},dataTable(summary)),
        missing.length?h('p',{class:'notice'},`${m.label} is not published annually for ${missing.map(r=>r.name).join(', ')}.`):null,
        E?rankTable(C,E,w,m):null].filter(Boolean));
    };
    draw();
    if(!cohort)return;
    try {
      const c=await cohort(),e=await trendSeries(m,c.areas);if(!alive())return;
      C=c;E=e;draw();
    } catch(e){if(alive())view.append(h('p',{class:'notice'},`Ranks unavailable: ${e.message}`));}
  })();
}

// The cohort's changes over the range, highest first, in a closed details element.
function rankTable(C,E,w,m) {
  const rows=C.areas.map(x=>{const s=E.get(x.id),k=s?change(s.values,w,m.unit,m.fit):null;return [x.name,k?.x0??null,k?.x1??null,k?.d??null];})
    .sort((p,q)=>(q[3]??-Infinity)-(p[3]??-Infinity));
  const n=rows.filter(r=>r[3]!=null).length;
  return h('details',{class:'recent-detail'},h('summary',{},`Change over ${rangeText(w)} among ${C.label} (${n} with both years published)`),
    dataTable({headers:['Area',String(w[0]),String(w[1]),m.fit?'Trend per decade':relative(m)?'Change (%)':m.unit==='%'?'Change (pp)':'Change'],rows,numeric:new Set([1,2,3]),
      format:(v,i)=>i===1||i===2?valueText(m.unit,v):i===3?`${v>0?'+':''}${v.toFixed(m.fit?2:1)}`:v}));
}
