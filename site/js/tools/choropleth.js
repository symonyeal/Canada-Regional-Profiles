// Target-group maps shared by Market, Workforce catchment and the Resident/Household dashboards.
// One active filter defines the target: a contiguous interval of ordered bins, or any subset of categories.
// The card reports the selected area's own published counts; the map shows census subdivisions for context.
import {census,censusMany,geographies,catalog,tablePair,metadata,geoMember,points,coord,table,memoRequest} from '../api.js';
import {CANADA,binCounts,jenks,ramp,int,pct,matchesProvince} from '../model.js';
import {FILTERS} from '../census.js';
import {h,icon,rangeSlider,toggle,showTip,hideTip,esc} from '../ui.js';
import {createMap,subdivisions,provinces,boundaryOf,bbox,setLayer,removeLayer,fit} from '../geo.js';

// ---------- selections ----------
export function parseSelection(spec,text,n) {
  const on=Array(n).fill(false);
  if(spec.kind==='range'){const m=/^(\d+)-(\d+)$/.exec(text??'');const [a,b]=m?[+m[1],+m[2]]:spec.default;
    for(let i=Math.min(a,b);i<=Math.min(n-1,Math.max(a,b));i++)on[i]=true;}
  else {const list=text?text.split('.').map(Number):text===''?spec.default:[];for(const i of list)if(i>=0&&i<n)on[i]=true;}
  return on;
}
export const serializeSelection=(spec,on)=>{const idx=on.flatMap((v,i)=>v?[i]:[]);
  return spec.kind==='range'?(idx.length?`${idx[0]}-${idx.at(-1)}`:''):(idx.length?idx.join('.'):'-');};

// ---------- data ----------
const cache=new Map();
const memo=(key,fn)=>memoRequest(cache,key,fn);
export const clearChoropleth=()=>cache.clear();
export const scopeOf=place=>place.id===CANADA.id?'':String(place.province).split('_')[0];

// Areas of the map scope: provinces and territories for Canada, census subdivisions for a province.
export function areas(scope) {
  return memo(`areas:${scope}`,async()=>{
    const type=scope?'CSD':'PR',list=(await geographies(type)).filter(g=>g.id!==CANADA.id&&matchesProvince(g,scope));
    return {type,list};
  });
}
export const shapes=scope=>memo(`shapes:${scope}`,()=>scope?subdivisions(scope):provinces());

async function censusMatrix(scope,spec) {
  const {type,list}=await areas(scope);
  const profiles=await memo(`census:${scope}:${spec.total}:${spec.bins.map(b=>b.id).join('+')}`,
    ()=>censusMany(type,list.map(g=>g.id),[spec.total,...spec.bins.map(b=>b.id)]));
  return new Map(list.map(g=>{const p=profiles.get(g.id);return [g.id,{name:g.name,total:p?.value(spec.total)??null,values:spec.bins.map(b=>p?.value(b.id)??null)}];}));
}
// Business Counts by sector: the national table for Canada and provinces, the local table for CSDs and CMAs.
export function businessBins(local) {
  return memo(`bizmeta:${local}`,async()=>{
    const pair=tablePair(await catalog(),local),m=await metadata(pair.current.productId);
    const naics=m.dimension[2].member,subtotal=naics.find(x=>x.classificationCode==='3');
    return {table:pair.current,metadata:m,subtotal,bins:naics.filter(x=>/^\d{2}(?:-\d{2})?$/.test(x.classificationCode??''))
      .map(s=>({id:String(s.memberId),name:s.memberNameEn.replace(/ \[[\d-]+\]$/,''),code:s.classificationCode}))};
  });
}
async function businessRows(geos,local) {
  const {metadata:m,bins,subtotal,table:t}=await businessBins(local);
  const matched=geos.map(g=>({g,member:geoMember(m.dimension[0],g)})).filter(x=>x.member);
  const keys=matched.flatMap(({member})=>[coord([member.memberId,1,subtotal.memberId]),...bins.map(b=>coord([member.memberId,1,Number(b.id)]))]);
  const data=await points(t.productId,keys),at=k=>data.get(k)?.at(-1)?.value??null;
  return new Map(matched.map(({g,member})=>{
    let values=bins.map(b=>at(coord([member.memberId,1,Number(b.id)])));const total=at(coord([member.memberId,1,subtotal.memberId]));
    // Omitted sector series are zero only when the published classified subtotal reconciles the row.
    if(total!=null&&values.reduce((s,v)=>s+(v??0),0)===total)values=values.map(v=>v??0);
    return [g.id,{name:g.name,total,values}];}));
}
export async function filterData(place,group,mapKey) {
  const spec=FILTERS[group].maps[mapKey],scope=scopeOf(place);
  if(spec.source==='business'){
    const {bins,table:t}=await businessBins(!!scope),{list}=await areas(scope);
    const national=place.type==='PR',local=['CSD','CMACA'].includes(place.type);
    const [matrix,own]=await Promise.all([memo(`biz:${scope}`,()=>businessRows(list,!!scope)),
      national?businessRows([place],false):local?businessRows([place],true):Promise.resolve(new Map())]);
    return {spec:{...spec,bins},scope,matrix,own:own.get(place.id)??null,names:bins.map(b=>b.name),
      source:{source:`Statistics Canada, ${t.cubeTitleEn}`,url:table(t.productId),universe:spec.universe,period:t.cubeTitleEn.match(/(June|December) \d{4}$/)?.[0]}};
  }
  const [matrix,p]=await Promise.all([censusMatrix(scope,spec),census(place)]);
  return {spec,scope,matrix,own:{name:place.name,total:p.value(spec.total),values:spec.bins.map(b=>p.value(b.id))},
    names:spec.bins.map(b=>b.name??p.name(b.id)?.replace(/^\d+(-\d+)? /,'')??b.id),
    source:{source:'Statistics Canada, Census Profile 2021',url:'https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm',universe:spec.universe,period:'Census 2021'}};
}

// ---------- filter accordion ----------
// Renders the group's filter cards into el. open: active map key; sel: boolean array for it.
export function filterCards(el,{group,open,sel,names,onopen,onchange}) {
  el.replaceChildren();
  for(const [key,spec] of Object.entries(FILTERS[group].maps)) {
    const expanded=key===open,card=h('div',{class:'filter','aria-expanded':String(expanded)});
    card.append(h('button',{type:'button',class:'filter-head','aria-expanded':String(expanded),onclick:()=>{if(!expanded)onopen(key);}},
      h('span',{class:'option-icon'},icon(spec.icon,15)),spec.label));
    if(expanded&&sel) {
      const body=h('div',{class:'filter-body'});
      if(spec.kind==='range'){
        const idx=sel.flatMap((v,i)=>v?[i]:[]),n=spec.bins.length;
        const slider=rangeSlider({n,lo:idx[0]??0,hi:idx.at(-1)??0,label:spec.label.replace('by ',''),ends:spec.ends,
          describe:(a,b)=>spec.text(spec.bins[a],spec.bins[b]),onchange:(a,b)=>onchange(spec.bins.map((_,i)=>i>=a&&i<=b))});
        body.append(h('div',{class:'range-row'},slider.out,h('button',{type:'button',class:'clear',onclick:()=>onchange(parseSelection(spec,'',n))},'Reset')),slider.el);
      } else {
        body.append(h('div',{class:'all-none'},h('button',{type:'button',onclick:()=>onchange(sel.map(()=>true))},'All'),h('span',{'aria-hidden':'true'},'|'),
          h('button',{type:'button',onclick:()=>onchange(sel.map(()=>false))},'None')));
        (names??[]).forEach((name,i)=>body.append(toggle(name,sel[i],v=>{const next=sel.slice();next[i]=v;onchange(next);})));
      }
      card.append(body);
    }
    el.append(card);
  }
}

// ---------- map panel ----------
// A map with KPI card, count/share toggle and legend. draw(model) redraws for new data or a new selection.
// model: {data (from filterData), sel, place, group, shapes (promise of boundaries)}
export function mapPanel(container,{unit='p',onunit,onopen,label:fixedLabel}={}) {
  const mapEl=h('div',{class:'map',role:'region','aria-label':'Map of the selected groups by area'});
  const kpi=h('div',{class:'map-kpi',role:'status','aria-live':'polite'}),legend=h('div',{class:'map-legend'});
  const unitBtns=[['n','123','Show counts'],['p','%','Show shares']].map(([v,t,l])=>h('button',{type:'button','aria-label':l,'aria-pressed':String(v===unit),
    onclick:()=>{unit=v;unitBtns.forEach((b,i)=>b.setAttribute('aria-pressed',String(['n','p'][i]===v)));onunit?.(v);if(last)draw(last);}},t));
  const wrap=h('div',{class:'map-wrap'},mapEl,kpi,h('div',{class:'unit-toggle',role:'group','aria-label':'Map values'},unitBtns),legend);
  container.append(wrap);
  const m=createMap(mapEl);let last=null,rows=new Map(),scope=null,bound=false;
  async function draw(model) {
    last=model;const {data,sel,place,group}=model,{spec,matrix,own}=data,label=(fixedLabel??spec.unit??FILTERS[group].unit).toLowerCase();
    // Target: selected bins, all published. Total: the published universe total, else the complete sum of bins.
    const counts=r=>{const c=binCounts(r.values,sel);return {total:r.total??c.total,target:c.target};};
    const list=[...matrix].map(([id,r])=>{const c=counts(r);
      return {id,name:r.name,total:c.total,target:c.target,value:unit==='p'?(c.total>0&&c.target!=null?100*c.target/c.total:null):c.target};});
    rows=new Map(list.map(r=>[r.id,r]));
    const mine=own?counts(own):{total:null,target:null},k=sel.filter(Boolean).length;
    kpi.replaceChildren(h('span',{},fixedLabel?`${fixedLabel} in selected groups`:`Total ${label}`),h('b',{},mine.target==null?'Not available':int(mine.target)),
      h('small',{},[spec.kind==='toggle'?`${k} of ${sel.length} groups mapped`:null,
        mine.total>0&&mine.target!=null?`${pct(100*mine.target/mine.total)} of ${place.name}`:own?null:'Not published for this geography'].filter(Boolean).join(' · ')));
    const breaks=jenks(list.map(r=>r.value),6),colors=ramp(spec.ramp,Math.max(2,breaks.length-1));
    const colorOf=v=>{if(v==null||breaks.length<2)return '#e4e7ec';let i=0;while(i<colors.length-1&&v>breaks[i+1])i++;return colors[i];};
    const fin=list.map(r=>r.value).filter(Number.isFinite),f=v=>v==null?'–':unit==='p'?pct(v,0):int(v);
    legend.replaceChildren(h('b',{},`Target ${label}`),h('div',{class:'scale'},h('span',{},f(fin.length?Math.min(...fin):null)),h('span',{},f(fin.length?Math.max(...fin):null))),
      h('div',{class:'grad',style:{background:`linear-gradient(90deg,${colors.join(',')})`}}),
      ...(list.some(r=>r.value==null)?[h('div',{class:'scale',style:{marginTop:'6px',marginBottom:0}},h('span',{},'Grey: not published'))]:[]));
    if(!m) return list;
    await m.ready;
    let fc;
    try {fc=await model.shapes;}
    catch(e){if(model===last&&mapEl.isConnected){
      wrap.querySelector('.basemap-note')?.remove();
      if(!wrap.querySelector('.map-note:not(.basemap-note)'))wrap.append(h('p',{class:'map-note'},`Boundaries unavailable: ${e.message} The card, legend and data table still use the published values; Refresh data tries again.`));
    }return list;}
    if(model!==last||!mapEl.isConnected)return list;
    wrap.querySelector('.map-note:not(.basemap-note)')?.remove();
    const features={type:'FeatureCollection',features:fc.features.map(ft=>({type:'Feature',geometry:ft.geometry,properties:{dguid:ft.properties.DGUID,
      name:rows.get(ft.properties.DGUID)?.name??ft.properties.name??'',color:colorOf(rows.get(ft.properties.DGUID)?.value)}}))};
    setLayer(m.map,'areas',features,[{id:'areas-fill',type:'fill',paint:{'fill-color':['get','color'],'fill-opacity':.85}},
      {id:'areas-line',type:'line',paint:{'line-color':'#ffffff','line-width':.6}}],m.map.getStyle().layers.find(l=>l.type==='symbol')?.id);
    if(!bound){bound=true;
      m.map.on('mousemove','areas-fill',e=>{const p=e.features[0].properties,r=rows.get(p.dguid);m.map.getCanvas().style.cursor=onopen?'pointer':'';
        showTip(e.originalEvent,`<b>${esc(p.name)}</b><br>${r?.target==null?'Not published':`${int(r.target)} of ${int(r.total)} (${r.total>0?pct(100*r.target/r.total):'–'})`}${onopen?'<br><small>Select to open its profile</small>':''}`);});
      m.map.on('mouseleave','areas-fill',()=>{m.map.getCanvas().style.cursor='';hideTip();});
      if(onopen)m.map.on('click','areas-fill',e=>{hideTip();onopen(e.features[0].properties.dguid);});
    }
    const key=`${place.id}:${fc.features.length}`;
    if(scope!==key){scope=key;const b=bbox(fc);mapEl._bounds=b;fit(m.map,b,false);removeLayer(m.map,'selected');
      if(place.type!=='PR'&&place.id!==CANADA.id)boundaryOf(place).then(o=>{if(model!==last)return;
        setLayer(m.map,'selected',o,[{id:'selected-line',type:'line',paint:{'line-color':'#1d2939','line-width':2.4,'line-dasharray':[2,1.2]}}]);
        const sb=bbox(o);if(sb){mapEl._bounds=sb;fit(m.map,sb);}}).catch(()=>{});
    }
    return list;
  }
  return {draw,get unit(){return unit;},get rows(){return [...rows.values()];},destroy:()=>m?.destroy()};
}

// Table for the current map values (dialog and CSV).
export function mapTable(rows) {
  return {headers:['Area','Universe total','Target count','Target share (%)'],rows:rows.map(r=>[r.name,r.total,r.target,r.total>0&&r.target!=null?Math.round(1000*r.target/r.total)/10:null]),
    numeric:new Set([1,2,3]),format:(v,i)=>i===3?pct(v):int(v)};
}
