import {memoRequest} from './api.js';
import {CANADA,esc} from './model.js';
import {heading,notice,card,sourceLink,loading} from './charts.js';
const BASE='https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer';
const LAYERS={PR:0,ER:2,CD:4,CMACA:6,POPCNTR:7,CSD:9};
const cache=new Map();
export const clearMapCache=()=>cache.clear();
export async function formRequest(url,params) {
  return memoRequest(cache,url+JSON.stringify(params),async()=>{
    let error;
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const r=await fetch(url,{method:'POST',body:new URLSearchParams(params),signal:AbortSignal.timeout(35000)});
        if(!r.ok)throw Error(`Map source returned HTTP ${r.status}.`);
        const d=await r.json();if(d.error)throw Error(d.error.message??'Map query failed.');return d;
      }catch(e){error=e;if(attempt<2)await new Promise(r=>setTimeout(r,600*(attempt+1)));}
    }throw error;
  });
}
export async function boundary(geo) {
  return formRequest(`${BASE}/${LAYERS[geo.type]}/query`,{where:geo.id===CANADA.id?'1=1':`DGUID='${geo.id}'`,
    outFields:'*',returnGeometry:'true',outSR:'4326',maxAllowableOffset:geo.type==='PR'?'.015':'.002',f:'geojson'});
}
function containsRing(point,ring) {
  const [x,y]=point;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [a,b]=ring[i],[c,d]=ring[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }return inside;
}
export function contains(point,collection) {
  return collection.features.some(f=>{
    const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
    return polygons.some(rings=>containsRing(point,rings[0])&&!rings.slice(1).some(r=>containsRing(point,r)));
  });
}
export async function logistics(root,ctx) {
  heading(root,'Logistics & access','Explore transport networks and facilities. Boundaries come from Statistics Canada; feature locations come from OpenStreetMap.', 'Live spatial services');
  notice(root,'Airport markers show facilities, not scheduled routes or flight frequencies. OAG aviation schedules in the reference are proprietary. OpenStreetMap coverage varies; a missing feature does not establish that a facility is absent.');
  const node=card(root,{title:'Regional transport connections',subtitle:ctx.geo.name}),bar=document.createElement('div');bar.className='map-toolbar';node.append(bar);
  const target=document.createElement('div');target.className='map';target.setAttribute('aria-label','Interactive transport map');node.append(target);
  const status=document.createElement('div');status.className='map-list';node.append(status);
  const footer=document.createElement('p');footer.className='source';footer.innerHTML=`${sourceLink(BASE,'Statistics Canada · 2021 cartographic boundaries')} · ${sourceLink('https://www.openstreetmap.org/copyright','OpenStreetMap contributors · ODbL')} · ${sourceLink('https://wiki.openstreetmap.org/wiki/Overpass_API','Overpass API')}. Feature queries are limited to 500 results in the map viewport; lists are not inventories.`;node.append(footer);
  if(!window.L){notice(node,'The map library could not load. Please retry with access to cdn.jsdelivr.net.',true);return;}
  const map=L.map(target,{scrollWheelZoom:false}).setView([59,-98],3);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  let features=null,points=L.layerGroup().addTo(map),version=0,active='airports',railOverlay=null;
  const buttons={};let outline=null;
  ctx.cleanup(()=>{version++;map.remove();});
  try {features=await boundary(ctx.geo);if(!root.isConnected)return;
    outline=L.geoJSON(features,{style:{color:'#087e83',weight:2,fillOpacity:.035}}).addTo(map);
    if(ctx.geo.id!==CANADA.id&&outline.getBounds().isValid())map.fitBounds(outline.getBounds(),{padding:[20,20],maxZoom:11});
  }catch(e){notice(node,'Official boundary unavailable: '+e.message+' The basemap is still usable; feature results describe the viewport, not a verified area boundary.',true);}
  async function load(kind) {
    if(!root.isConnected)return;
    active=kind;const v=++version;points.clearLayers();Object.entries(buttons).forEach(([key,b])=>b.classList.toggle('active',key===kind));
    if(railOverlay){map.removeLayer(railOverlay);railOverlay=null;}
    if(kind==='rail')railOverlay=L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      {maxZoom:18,attribution:'<a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> · OSM contributors',opacity:.8}).addTo(map);
    if(kind==='broadband') {
      status.innerHTML=`<p>Broadband availability is published by ISED. The official interactive map includes service speeds, technologies and provider layers. A verified live household aggregate API is not connected here.</p><p>${sourceLink('https://ised-isde.canada.ca/app/scr/sittibc/web/bbmap/hm.html?lang=eng','Open the National Broadband Internet Service Availability Map')}</p>`;return;
    }
    if(kind==='roads'){status.innerHTML='<p>Roads and highways are shown in the live OpenStreetMap basemap. Zoom in for road names and local detail.</p>';return;}
    if(map.getZoom()<5){status.innerHTML='<p>Zoom into an area (level 5 or closer), then select “Load this map area” to query facilities. This keeps requests to the public map service bounded.</p>';return;}
    loading(status,'Querying facilities in this map viewport…');
    const bbox=map.getBounds(),box=[bbox.getSouth(),bbox.getWest(),bbox.getNorth(),bbox.getEast()].join(',');
    const selector={airports:'["aeroway"="aerodrome"]',ports:'["harbour"="yes"]',rail:'["railway"="station"]',education:'["amenity"~"university|college"]'}[kind];
    try {
      const query=`[out:json][timeout:25];nwr${selector}(${box});out center 500;`;
      const data=await formRequest('https://overpass-api.de/api/interpreter',{data:query});
      if(v!==version||!root.isConnected)return;
      if(data.remark)throw Error('The map source returned an incomplete query: '+data.remark);
      const rows=(data.elements??[]).map(x=>({...x,lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
        .filter(x=>!features||contains([x.lon,x.lat],features));
      for(const x of rows)L.circleMarker([x.lat,x.lon],{radius:6,color:'#fff',weight:1.5,fillColor:'#087e83',fillOpacity:.9}).bindPopup(`<b>${esc(x.tags?.name??'Unnamed facility')}</b><br>${esc(x.tags?.iata??x.tags?.operator??kind)}`).addTo(points);
      status.innerHTML=`<p>${rows.length} mapped features returned inside ${features?'the selected boundary and ':''}viewport. Query limit: 500 before boundary filtering; this is not a regional total.</p>`+
        rows.map(x=>`<p><strong>${esc(x.tags?.name??'Unnamed facility')}</strong>${esc([x.tags?.iata,x.tags?.operator,x.tags?.['addr:city']].filter(Boolean).join(' · '))}</p>`).join('');
    }catch(e){if(v===version&&root.isConnected)status.innerHTML=`<p>Facility service unavailable: ${esc(e.message)} Use “Load this map area” to retry. The live basemap remains available.</p>`;}
  }
  for(const [key,label] of Object.entries({airports:'Airports',roads:'Roads',rail:'Rail stations',ports:'Harbours',education:'Universities & colleges',broadband:'Broadband'})) {
    const b=document.createElement('button');b.className='button subtle';b.textContent=label;b.onclick=()=>load(key);bar.append(b);buttons[key]=b;
  }
  const reload=document.createElement('button');reload.className='button subtle';reload.textContent='Load this map area';reload.onclick=()=>load(active);bar.append(reload);
  await load('airports');
}
