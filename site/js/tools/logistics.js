// Logistics and access: airports, highways, ports, rail and high-speed internet, with drive-time areas.
import {airTraffic,geographies,table,request} from '../api.js';
import {CANADA,PT,int,pct,compact,matchesProvince} from '../model.js';
import {h,icon,showTip,hideTip,esc,dialog,dataTable} from '../ui.js';
import {createMap,boundaryOf,provinces,metroAreas,arcgis,isochrone,wikidata,contains,bbox,centroid,setLayer,removeLayer,raster,marker,fit,GEOCA} from '../geo.js';
import {lifetime} from './common.js';

const NETS=[
  {key:'air',label:'Airport network',sub:'Airports and passenger traffic',icon:'plane',color:'#326b7a'},
  {key:'road',label:'Major road network',sub:'National Highway System and drive times',icon:'city',color:'#8a652c'},
  {key:'port',label:'Sea port network',sub:'Ports and marine terminals',icon:'anchor',color:'#286f59'},
  {key:'rail',label:'Rail and freight network',sub:'National Railway Network',icon:'train',color:'#a35334'},
  {key:'bb',label:'Broadband network',sub:'High-speed internet coverage',icon:'wifi',color:'#77536c'},
];
const SPEEDS=[['25Mbps','25 Mbps','#67b77d'],['50/10Mbps','50/10 Mbps','#fee985'],['100Mbps','100 Mbps','#feb46a'],['Gigabit','Gigabit','#f26f71']];
const fold=s=>s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/, [^,]+$/,'').replace(/[^a-z0-9]/g,'');
export function logistics(el,app) {
  const life=lifetime(el),side=h('div',{class:'side'}),mapEl=h('div',{class:'map',role:'region','aria-label':'Logistics map'});
  const card=h('div',{class:'map-card',hidden:true}),pill=h('div',{class:'map-pill',hidden:true}),legendEl=h('div',{class:'map-legend',hidden:true}),note=h('p',{class:'map-note',hidden:true});
  const wrap=h('div',{class:'map-wrap'},mapEl,card,pill,legendEl,note);
  el.append(h('div',{class:'frame logistics'},side,wrap));
  const m=createMap(mapEl);let markers=[];
  const clearMarkers=()=>{markers.forEach(x=>x.remove());markers=[];};

  async function render() {
    const alive=life.next(),place=await app.resolved();if(!alive()||place.id!==app.state.geo.id)return;
    const net=NETS.find(n=>n.key===app.state.t.lg),pr=place.id===CANADA.id?'':String(place.province).split('_')[0];
    wrap.style.setProperty('--c',net.color);
    side.replaceChildren(h('p',{class:'side-eyebrow',style:{color:net.color}},'Regional access'),h('h3',{class:'side-title'},'Logistics and access'),
      h('p',{class:'side-text'},'The networks that connect the area to the rest of Canada and the world.'),
      h('div',{class:'net-list',role:'group','aria-label':'Network'},NETS.map(n=>h('button',{type:'button',class:'net',style:{'--c':n.color},'aria-pressed':String(n.key===net.key),
        onclick:()=>{if(n.key!==net.key){app.set('lg',n.key);app.set('lgf','');render();}}},h('span',{class:'net-icon'},icon(n.icon,18)),h('span',{},h('b',{},n.label),h('small',{},n.sub))))),
      h('div',{class:'facility-list',id:'facility-list'}),h('p',{class:'side-foot',id:'logistics-source'}));
    card.hidden=pill.hidden=legendEl.hidden=note.hidden=true;clearMarkers();
    if(!m)return;
    await m.ready;if(!alive())return;
    for(const id of ['iso','nhs','rail','bb'])removeLayer(m.map,id);
    // Facilities are listed for the province or territory (Canada: all); a selected local area is outlined within it.
    const provShape=(pr?boundaryOf({id:`2021A0002${pr}`,type:'PR'}):provinces()).catch(()=>null),outline=provShape;
    removeLayer(m.map,'local');
    provShape.then(o=>{if(!alive()||!o)return;setLayer(m.map,'outline',o,[{id:'outline-line',type:'line',paint:{'line-color':'#111','line-width':1.4,'line-dasharray':[3,2]}}]);
      const b=bbox(o);mapEl._bounds=b;fit(m.map,b,false);});
    if(!['PR'].includes(place.type))boundaryOf(place).then(o=>{if(alive())setLayer(m.map,'local',o,[{id:'local-line',type:'line',paint:{'line-color':'#1d2939','line-width':2.2}}]);}).catch(()=>{});
    const ctx={place,pr,alive,net,outline,provShape};
    try {await NET[net.key](ctx);}
    catch(e){if(alive()){note.hidden=false;note.textContent=`${net.label}: ${e.message}`;}}
  }

  // Drive-time areas around a point (Valhalla, OpenStreetMap roads). Off, 30 or 60 minutes.
  function driveTime(ctx,[lon,lat]) {
    const sel=app.state.t.lgd;
    const chip=(v,label)=>h('button',{type:'button',class:'chip','aria-pressed':String(sel===v),onclick:()=>{app.set('lgd',v);driveTime(ctx,[lon,lat]);}},h('i'),label);
    pill.hidden=false;pill.replaceChildren(h('span',{},'Drive time'),chip('30','30 min'),chip('60','60 min'),chip('0','Off'));
    removeLayer(m.map,'iso');if(sel==='0')return;
    const minutes=sel==='30'?[30]:[30,60];
    isochrone(lon,lat,minutes).then(fc=>{if(!ctx.alive())return;
      if(!fc.features?.some(f=>f.geometry?.coordinates?.length)){note.hidden=false;note.textContent='No drive-time area: this location has no connection to the public road network in OpenStreetMap.';return;}
      setLayer(m.map,'iso',fc,[{id:'iso-fill',type:'fill',paint:{'fill-color':ctx.net.color,'fill-opacity':.18}},{id:'iso-line',type:'line',paint:{'line-color':ctx.net.color,'line-width':1,'line-opacity':.6}}],
        m.map.getStyle().layers.find(l=>l.type==='symbol')?.id);})
      .catch(e=>{if(ctx.alive()){note.hidden=false;note.textContent=`Drive-time service unavailable: ${e.message}`;}});
  }
  function showCard(ctx,{title,badge,stats=[],noteText}) {
    card.hidden=false;card.style.setProperty('--c',ctx.net.color);
    card.replaceChildren(...[h('h5',{},title),badge?h('span',{class:'badge'},badge):null,
      stats.length?h('div',{class:'stats'},stats.map(([v,l])=>h('div',{class:'stat'},h('b',{},v),h('span',{},l)))):null,noteText?h('p',{class:'note'},noteText):null].filter(Boolean));
  }
  const sourceLine=html=>{const s=side.querySelector('#logistics-source');if(s)s.innerHTML=html;};
  const list=(items,selected,onpick)=>{const box=side.querySelector('#facility-list');if(!box)return;
    box.replaceChildren(...items.map(it=>h('button',{type:'button','aria-current':String(it.id===selected),onclick:()=>onpick(it)},h('span',{},it.name,it.mapped===false?h('small',{},' · not mapped'):null),h('small',{},it.figure??''))));};

  const NET={
    async air(ctx) {
      const {place,pr,alive}=ctx;
      const [tc,traffic]=await Promise.all([arcgis('TC/canadian_airports_w_air_navigation_services_en',{where:pr?`PROVINCE='${PT.find(p=>p[0]===pr)[2]}'`:'1=1'}),airTraffic(pr)]);
      if(!alive())return;
      const byName=new Map(traffic.airports.map(a=>[fold(a.name),a]));
      const located=new Map(tc.features.map(f=>[fold(f.properties.AIRPORT),f]));
      // Every airport with published passengers; located when a NAV CANADA airport has the same normalised name.
      const items=traffic.airports.filter(a=>a.total!=null).map(a=>{const f=located.get(fold(a.name));
        return {id:String(a.id),name:a.name.replace(/, [^,]+$/,''),a,feature:f,mapped:!!f,figure:compact(a.total)};}).sort((x,y)=>y.a.total-x.a.total);
      for(const f of tc.features)if(!items.some(i=>i.feature===f))items.push({id:`tc${f.properties.TC_ID}`,name:f.properties.AIRPORT,feature:f,mapped:true,figure:'no passenger series'});
      const chosen=items.find(i=>i.id===app.state.t.lgf)??items.find(i=>i.mapped)??items[0];
      const pick=it=>{app.set('lgf',it.id);select(it);};
      const select=it=>{
        list(items.slice(0,40),it.id,pick);clearMarkers();
        for(const i of items.filter(x=>x.mapped))markers.push(marker(m.map,i.feature.geometry.coordinates,{iconName:'plane',color:ctx.net.color,label:i.name,selected:i===it,onclick:()=>pick(i)}));
        const a=it.a,y=a?.year;
        showCard(ctx,{title:it.feature?.properties.AIRPORT??it.name,badge:it.feature?.properties.IATA||it.feature?.properties.ICAO,
          stats:a?[[compact(a.total),`Passengers, ${y}`],[a.at('Other International sector')!=null&&a.at('Transborder sector')!=null?compact(a.at('Other International sector')+a.at('Transborder sector')):'–','International and transborder']]:[],
          noteText:a?`Enplaned and deplaned passengers in ${y}. Scheduled routes and flight frequencies are not published as open data.`:'No passenger series is published for this airport.'});
        if(it.mapped)driveTime(ctx,it.feature.geometry.coordinates);
        else {pill.hidden=true;removeLayer(m.map,'iso');}
      };
      if(chosen)select(chosen);else showCard(ctx,{title:'No airports',noteText:`No airport with published passenger traffic in ${place.name}.`});
      sourceLine(`Passengers: <a href="${table('23100253')}" target="_blank" rel="noopener">Statistics Canada 23-10-0253</a>. Locations: Transport Canada, airports with NAV CANADA services. Drive times: OpenStreetMap via Valhalla.`);
    },
    async road(ctx) {
      const {pr,alive,place}=ctx;
      const layers=JSON.stringify([{id:0,source:{type:'mapLayer',mapLayerId:0},drawingInfo:{renderer:{type:'simple',symbol:{type:'esriSLS',style:'esriSLSSolid',color:[180,131,43,255],width:1.8}}}}]);
      raster(m.map,'nhs',`${GEOCA}/TC/canada_national_highway_system_en/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&dynamicLayers=${encodeURIComponent(layers)}&f=image`,{attribution:'Transport Canada'});
      const all=(await geographies('CMACA')).filter(g=>matchesProvince(g,pr)).sort((a,b)=>(b.population??0)-(a.population??0)).slice(0,30);
      const fc=await metroAreas(pr);if(!alive())return;
      const pos=new Map(fc.features.map(f=>[f.properties.CMAUID,centroid(f)]).filter(([,c])=>c));
      const items=all.filter(g=>pos.has(g.id.slice(9))).map(g=>({id:g.id,name:g.name,g,coord:pos.get(g.id.slice(9)),figure:compact(g.population)}));
      const pick=it=>{app.set('lgf',it.id);select(it);};
      const select=it=>{list(items,it.id,pick);clearMarkers();
        for(const i of items)markers.push(marker(m.map,i.coord,{iconName:'city',color:i===it?'#1d2939':'#fff',label:`${i.name}: ${int(i.g.population)} residents`,selected:i===it,onclick:()=>pick(i)}));
        markers.forEach(mk=>mk.getElement().classList.toggle('muted',!mk.getElement().classList.contains('selected')));
        showCard(ctx,{title:it.name,stats:[[int(it.g.population),'Population, Census 2021']],noteText:'Metropolitan area or agglomeration. Gold lines: National Highway System.'});
        driveTime(ctx,it.coord);};
      const chosen=items.find(i=>i.id===app.state.t.lgf)??items.find(i=>place.type==='CMACA'&&i.id===place.id)??items[0];
      if(chosen)select(chosen);
      sourceLine('Highways: Transport Canada, National Highway System. Places: Statistics Canada 2021 metropolitan areas and agglomerations. Drive times: OpenStreetMap via Valhalla.');
    },
    async port(ctx) {
      const {pr,alive,place,provShape}=ctx;
      const rows=await wikidata(`SELECT ?p ?pLabel ?coord WHERE { VALUES ?t {wd:Q44782 wd:Q15310171 wd:Q2023913} ?p wdt:P31 ?t; wdt:P17 wd:Q16; wdt:P625 ?coord. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`);
      const shape=await provShape;if(!alive())return;
      const seen=new Set(),items=rows.map(r=>{const m=/Point\(([-\d.]+) ([-\d.]+)\)/.exec(r.coord);return m&&{id:r.p.split('/').pop(),name:r.pLabel,coord:[+m[1],+m[2]],url:r.p};})
        .filter(x=>x&&!seen.has(x.id)&&seen.add(x.id)&&!/^Q\d+$/.test(x.name)).filter(x=>!shape||contains(x.coord,shape)).sort((a,b)=>a.name.localeCompare(b.name));
      if(!items.length){showCard(ctx,{title:'No ports recorded',noteText:`Wikidata records no port or seaport with coordinates in ${pr?PT.find(p=>p[0]===pr)[2]:'Canada'}.`});return;}
      const pick=it=>{app.set('lgf',it.id);select(it);};
      const select=it=>{list(items,it.id,pick);clearMarkers();
        for(const i of items)markers.push(marker(m.map,i.coord,{iconName:'anchor',color:ctx.net.color,label:i.name,selected:i===it,onclick:()=>pick(i)}));
        showCard(ctx,{title:it.name,noteText:'Port location from Wikidata. Facilities, cargo volumes and berths are not part of this open record.'});driveTime(ctx,it.coord);};
      select(items.find(i=>i.id===app.state.t.lgf)??items[0]);
      sourceLine(`Ports: <a href="https://query.wikidata.org/" target="_blank" rel="noopener">Wikidata</a> items that are ports or seaports in Canada with coordinates (${items.length} in this area); volunteered data, not an official inventory.`);
    },
    async rail(ctx) {
      raster(m.map,'rail','https://maps.geogratis.gc.ca/wms/canvec_en?service=WMS&version=1.3.0&request=GetMap&layers=railway_small,track_segment_mid,track_segment_large,track_segment_250k,track_segment_50k&styles=&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true',{attribution:'NRCan CanVec'});
      showCard(ctx,{title:'National Railway Network',noteText:'Railway lines from Natural Resources Canada CanVec (National Railway Network). Terminals and intermodal facilities are not mapped here.'});
      sourceLine('Railways: Natural Resources Canada, CanVec web map service (National Railway Network).');
    },
    async bb(ctx) {
      const meta=await request(`${GEOCA}/NRCan/High_Speed_Internet_haute_vitesse/MapServer/0/query?where=1%3D1&outFields=speed,Year&returnGeometry=false&f=json`);if(!ctx.alive())return;
      const years=[...new Set(meta.features.map(f=>f.attributes.Year))].sort((a,b)=>a-b),latest=years.at(-1),year=new Date(latest).getUTCFullYear();
      const draw=speed=>{removeLayer(m.map,'bb');
        const def=encodeURIComponent(JSON.stringify({0:`speed='${speed}' AND Year=date '${year}-01-01'`}));
        raster(m.map,'bb',`${GEOCA}/NRCan/High_Speed_Internet_haute_vitesse/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layerDefs=${def}&f=image`,{opacity:.75,attribution:'NRCan Atlas of Canada'});
        const s=SPEEDS.find(x=>x[0]===speed);
        legendEl.hidden=false;legendEl.replaceChildren(h('b',{},'High-speed internet'),h('div',{class:'chips'},h('span',{},h('i',{style:{'--c':s[2]}}),`Areas with ${s[1]} service available`)));
        showCard(ctx,{title:`High-speed internet, ${year}`,stats:[[s[1],'Minimum download speed shown']],noteText:'Coverage areas from the Atlas of Canada (ISED data). These are areas where service is available, not shares of households.'});
        card.append(h('div',{class:'speed-chips',role:'group','aria-label':'Download speed'},SPEEDS.map(([v,l,c])=>h('button',{type:'button',class:'chip',style:{'--c':c},'aria-pressed':String(v===speed),onclick:()=>draw(v)},h('i'),l))));
      };
      draw('50/10Mbps');
      sourceLine('Coverage: Natural Resources Canada, Atlas of Canada high-speed internet service map (ISED data), 2018 to the latest year.');
    },
  };
  return {update(changed){if(['geo','refresh','lg'].some(k=>changed.has(k))||(changed.has('lgf')&&!changed.has('geo')))render();},destroy:()=>m?.destroy()};
}
