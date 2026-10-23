// Spatial services and the shared map. All observations still come from the tools; this module draws them.
import {request,SourceError} from './api.js';
import {h,icon} from './ui.js';
import {CANADA} from './model.js';

export const BOUNDARIES='https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer';
export const GEOCA='https://maps-cartes.services.geo.ca/server_serveur/rest/services';
const LAYERS={PR:0,ER:2,CD:4,CMACA:6,POPCNTR:7,CSD:9};
const STYLE='https://tiles.openfreemap.org/styles/positron';

// StatCan cartographic boundaries. The service returns HTTP 500 at random and for explicit field lists,
// so every query asks for all fields. Connections fail independently (about half of new ones), so retries race
// four parallel copies; six rounds leave well under a 1 in 100,000 chance of failing when connections are independent. Pages of 1000 features until exhausted.
export async function boundaries(type,where,{offset='.004'}={}) {
  const features=[];
  for(let start=0;start<20000;start+=1000) {
    const d=await request(`${BOUNDARIES}/${LAYERS[type]}/query`,{attempts:6,backoff:150,race:4,limit:2,timeout:90000,body:new URLSearchParams({where,outFields:'*',returnGeometry:'true',
      outSR:'4326',maxAllowableOffset:offset,geometryPrecision:offset==='.002'?'4':'3',resultOffset:String(start),resultRecordCount:'1000',orderByFields:'OBJECTID',f:'geojson'})});
    if(!Array.isArray(d.features)) throw new SourceError('malformed','The boundary service returned no features.');
    features.push(...d.features.filter(f=>f.geometry?.coordinates?.length));if(d.features.length<1000)break;
  }
  return {type:'FeatureCollection',features};
}
// The boundary layers key metropolitan areas and population centres by provincial part; the Census Profile keys
// the whole area. Whole areas are selected by their unit code (CMAUID, PCUID), provincial parts by CMAPUID.
export function boundaryWhere(geo) {
  if(geo.id===CANADA.id) return '1=1';
  const code=geo.id.slice(9);
  return geo.type==='CMACA'?(code.length===3?`CMAUID='${code}'`:`CMAPUID='${code}'`):geo.type==='POPCNTR'?`PCUID='${code}'`:`DGUID='${geo.id}'`;
}
export const boundaryOf=geo=>boundaries(geo.id===CANADA.id?'PR':geo.type,boundaryWhere(geo),{offset:geo.id===CANADA.id?'.03':geo.type==='PR'?'.01':'.002'});
export const subdivisions=province=>boundaries('CSD',`PRUID='${province}'`,{offset:'.008'});
export const provinces=()=>boundaries('PR','1=1',{offset:'.03'});

// Federal ArcGIS map services on geo.ca (Transport Canada, NRCan). Paged GeoJSON queries.
export async function arcgis(service,params,max=8000) {
  const features=[];
  for(let start=0;start<max;start+=1000) {
    const q=new URLSearchParams({where:'1=1',outFields:'*',returnGeometry:'true',outSR:'4326',f:'geojson',resultOffset:String(start),resultRecordCount:'1000',...params});
    const d=await request(`${GEOCA}/${service}/MapServer/0/query?${q}`,{attempts:3});
    features.push(...(d.features??[]));if(!d.exceededTransferLimit&&(d.features?.length??0)<1000)break;
  }
  return {type:'FeatureCollection',features};
}

// Drive-time areas from the public FOSSGIS Valhalla server (OpenStreetMap roads). The server caps contours at 60 minutes.
export async function isochrone(lon,lat,minutes) {
  const json=JSON.stringify({locations:[{lat,lon}],costing:'auto',contours:minutes.map(time=>({time})),polygons:true,denoise:.5,generalize:120});
  return request(`https://valhalla1.openstreetmap.de/isochrone?json=${encodeURIComponent(json)}`,{attempts:2,timeout:30000});
}
export async function overpass(query) {
  const d=await request('https://overpass-api.de/api/interpreter',{body:new URLSearchParams({data:query}),attempts:2,timeout:90000});
  if(d.remark&&/runtime error|timeout/i.test(d.remark)) throw new SourceError('timeout','OpenStreetMap query timed out on the public Overpass server.');
  return d;
}
export async function wikidata(sparql) {
  const d=await request(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,{accept:'application/sparql-results+json',attempts:2});
  return d.results.bindings.map(b=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v.value])));
}

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
      if(l.id==='background')l.paint={'background-color':'#f8f8f7'};
      if(/^water/.test(l.id)&&l.type==='fill')l.paint={...l.paint,'fill-color':'#cfe3f1'};
      if(/^waterway/.test(l.id)&&l.type==='line')l.paint={...l.paint,'line-color':'#cfe3f1'};
      if(/^landcover|^landuse|^park/.test(l.id)&&l.type==='fill')l.paint={...l.paint,'fill-opacity':.35};
    }
    return st;
  });
  return styleJSON;
}
// Creates a MapLibre map inside el. Returns {map, ready, destroy}. The basemap failing leaves overlays usable on a plain background.
export function createMap(el,{bounds,controls=true}={}) {
  if(!window.maplibregl){el.append(h('div',{class:'state failure'},'The map library could not load. Tables and exports remain available.'));return null;}
  const map=new maplibregl.Map({container:el,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#f8f8f7'}}],glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'},
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
export function raster(map,id,tiles,{opacity=1,attribution}={}) {
  if(map.getSource(id))return;
  map.addSource(id,{type:'raster',tiles:[tiles],tileSize:256,attribution});
  map.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':opacity}},map.getStyle().layers.find(l=>l.type==='symbol')?.id);
}
// Icon marker in a coloured disc, keyboard focusable; returns the MapLibre marker.
export function marker(map,[lon,lat],{iconName,color,label,selected,onclick}) {
  const el=h('button',{type:'button',class:`map-marker${selected?' selected':''}`,style:{'--c':color},'aria-label':label,title:label,onclick},icon(iconName,selected?16:13));
  return new maplibregl.Marker({element:el}).setLngLat([lon,lat]).addTo(map);
}
