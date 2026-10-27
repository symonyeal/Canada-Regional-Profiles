// Spatial services and the shared map. All observations still come from the tools; this module draws them.
import {request,memoRequest,SourceError} from './api.js';
import {h,icon} from './ui.js';
import {CANADA} from './model.js';

const STYLE='https://tiles.openfreemap.org/styles/positron';

// 2021 Census cartographic boundaries, built from Statistics Canada's boundary service by tools/boundaries into
// site/boundaries/: <layer>-<province>.json for csd, cd, er, cma and pc, and pr.json for Canada.
// Geometry only; every observation drawn on them is requested at runtime.
const FILES={CSD:'csd',CD:'cd',ER:'er',CMACA:'cma',POPCNTR:'pc'};
const decoded=new Map();
const file=name=>memoRequest(decoded,name,()=>request(`boundaries/${name}.json`,{cache:'default',hedge:0}).then(topology));

// TopoJSON to GeoJSON (Bostock, TopoJSON specification 1.0): arcs are delta-encoded integer positions on the
// transform's grid; reference ~i is arc i reversed, and consecutive arcs of a ring share their joining position.
export function topology(t) {
  const {scale:[kx,ky],translate:[x0,y0]}=t.transform;
  const arcs=t.arcs.map(a=>{let x=0,y=0;return a.map(([dx,dy])=>[(x+=dx)*kx+x0,(y+=dy)*ky+y0]);});
  const ring=refs=>{const r=[];for(const i of refs){const a=i<0?arcs[~i].slice().reverse():arcs[i];r.push(...(r.length?a.slice(1):a));}return r;};
  return {type:'FeatureCollection',features:t.objects.areas.geometries.filter(g=>g.type).map(g=>({type:'Feature',properties:g.properties,
    geometry:g.type==='Polygon'?{type:'Polygon',coordinates:g.arcs.map(ring)}:{type:'MultiPolygon',coordinates:g.arcs.map(p=>p.map(ring))}}))};
}
// The boundary layers key metropolitan areas and population centres by provincial part; the Census Profile keys
// the whole area. Whole areas match their unit code (CMAUID, PCUID), provincial parts CMAPUID, the rest DGUID.
export function matcher(geo) {
  const code=geo.id.slice(9);
  return geo.type==='CMACA'?(code.length===3?p=>p.CMAUID===code:p=>p.CMAPUID===code):geo.type==='POPCNTR'?p=>p.PCUID===code:p=>p.DGUID===geo.id;
}
// Provinces whose files hold a geography: its own code, or every province a metropolitan area or population centre spans.
const provincesOf=geo=>['CSD','CD','ER'].includes(geo.type)?[geo.id.slice(9,11)]:String(geo.province||geo.id.slice(9,11)).split('_');
export async function boundaryOf(geo) {
  if(geo.id===CANADA.id) return provinces();
  const fcs=geo.type==='PR'?[await provinces()]:await Promise.all(provincesOf(geo).map(pr=>file(`${FILES[geo.type]}-${pr}`)));
  const match=matcher(geo),features=fcs.flatMap(fc=>fc.features.filter(f=>match(f.properties)));
  if(!features.length) throw new SourceError('empty','No boundary is published for this geography.');
  return {type:'FeatureCollection',features};
}
export const subdivisions=province=>file(`csd-${province}`);
export const provinces=()=>file('pr');
export function bbox(fc) {
  let a=[180,90,-180,-90];
  const walk=c=>{if(typeof c[0]==='number'){a=[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[2],c[0]),Math.max(a[3],c[1])];}else c.forEach(walk);};
  for(const f of fc.features??[])if(f.geometry)walk(f.geometry.coordinates);
  return a[0]<=a[2]?[[a[0],a[1]],[a[2],a[3]]]:null;
}
// Area-weighted centroid of a feature's largest ring (adequate for label and marker placement);
// the vertex mean when every ring has zero area after simplification.
export function centroid(f) {
  const polys=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];let best=null,area=0;
  for(const p of polys){const r=p[0];let A=0,cx=0,cy=0;
    for(let i=0,j=r.length-1;i<r.length;j=i++){const k=r[j][0]*r[i][1]-r[i][0]*r[j][1];A+=k;cx+=(r[j][0]+r[i][0])*k;cy+=(r[j][1]+r[i][1])*k;}
    if(Math.abs(A)>area){area=Math.abs(A);best=[cx/(3*A),cy/(3*A)];}}
  const r=polys[0]?.[0]??[];
  return best??(r.length?[r.reduce((s,v)=>s+v[0],0)/r.length,r.reduce((s,v)=>s+v[1],0)/r.length]:null);
}

// ---------- the map ----------
let styleJSON;
async function baseStyle() {
  styleJSON??=request(STYLE,{attempts:3}).then(s=>{
    const st=structuredClone(s);
    for(const l of st.layers){
      if(l.id==='background')l.paint={'background-color':'#f3f5ee'};
      if(/^water/.test(l.id)&&l.type==='fill')l.paint={...l.paint,'fill-color':'#dce8e4'};
      if(/^waterway/.test(l.id)&&l.type==='line')l.paint={...l.paint,'line-color':'#dce8e4'};
      if(/^landcover|^landuse|^park/.test(l.id)&&l.type==='fill')l.paint={...l.paint,'fill-opacity':.35};
      // Labels in Latin script only: the style's second line of non-Latin names made the map fetch glyph ranges
      // for a dozen scripts (about 1 MB) on first view.
      if(l.type==='symbol'&&/"name/.test(JSON.stringify(l.layout?.['text-field']??'')))l.layout={...l.layout,'text-field':['coalesce',['get','name:latin'],['get','name']]};
    }
    return st;
  });
  return styleJSON;
}
// Creates a MapLibre map inside el. Returns {map, ready, destroy}. The basemap failing leaves overlays usable on a plain background.
export function createMap(el,{bounds,controls=true}={}) {
  if(!window.maplibregl){el.append(h('div',{class:'state failure'},'The map library could not load. Tables and exports remain available.'));return null;}
  const map=new maplibregl.Map({container:el,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#f3f5ee'}}],glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'},
    center:[-96,60],zoom:2.4,attributionControl:{compact:true},cooperativeGestures:false,dragRotate:false,pitchWithRotate:false,maxPitch:0});
  map.touchZoomRotate.disableRotation();map.scrollZoom.disable();
  const ready=new Promise(resolve=>map.once('load',resolve)).then(async()=>{
    try {const st=await baseStyle();map.setStyle(st,{diff:false});await new Promise(r=>map.once('style.load',r));}
    catch {el.parentElement?.append(h('p',{class:'map-note'},'Basemap unavailable; boundaries and data layers are still shown.'));}
    return map;
  });
  if(controls){const zoom=h('div',{class:'map-controls'},
    h('button',{type:'button','aria-label':'Zoom in',onclick:()=>map.zoomIn()},icon('plus',18)),
    h('button',{type:'button','aria-label':'Zoom out',onclick:()=>map.zoomOut()},icon('minus',18)),
    h('button',{type:'button','aria-label':'Reset map view',onclick:()=>fit(map,el._bounds)},icon('maximize',16)));
    el.append(zoom);}
  const ro=new ResizeObserver(()=>{if(el.isConnected)map.resize();});ro.observe(el);
  el._bounds=bounds;if(bounds)fit(map,bounds,false);
  return {map,ready,destroy:()=>{ro.disconnect();map.remove();}};
}
export function fit(map,bounds,animate=true) {
  if(!bounds)return;const c=map.getContainer(),pad=Math.min(48,c.clientWidth/10);
  map.fitBounds(bounds,{padding:pad,animate,maxZoom:10});
}
// Replace or create a GeoJSON source and its layers. layers: MapLibre layer specs without source.
export function setLayer(map,id,data,layers,before,source={}) {
  const src=map.getSource(id);
  if(src)src.setData(data);
  else {map.addSource(id,{type:'geojson',data,...source});for(const l of layers)map.addLayer({...l,source:id},before);}
}
export function removeLayer(map,id) {
  if(!map.getStyle())return;
  for(const l of map.getStyle().layers.filter(l=>l.source===id))map.removeLayer(l.id);
  if(map.getSource(id))map.removeSource(id);
}
