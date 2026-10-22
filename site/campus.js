import {PT,esc,fmt,completeSum} from './model.js';
import {points,coord} from './api.js';
import {boundary,formRequest} from './maps.js';
import {card,notice,sourceLink} from './charts.js';
const fold=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^the /,'').replace(/[^a-z0-9]/g,'');
export async function campusMap(root,ctx,data,latest) {
  const node=card(root,{title:'Postsecondary institutions',subtitle:'Live mapped facilities. Enrolments are attached only when the institution name matches exactly.'});
  const element=document.createElement('div');element.className='map';node.append(element);
  const status=document.createElement('div');status.className='map-list';node.append(status);
  if(!window.L){notice(node,'The map library is unavailable.',true);return;}
  const map=L.map(element,{scrollWheelZoom:false}).setView([57,-98],3);ctx.cleanup(()=>map.remove());
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const code=ctx.province||ctx.geo.province,pt=PT.find(p=>p[0]===code);
  if(!pt){notice(status,'Choose a province or territory to load its university and college facilities. National enrolment charts remain available.');return;}
  status.textContent='Querying public university and college locations…';
  try{const shape=await boundary({type:'PR',id:`2021A0002${code}`});if(!root.isConnected)return;
    const layer=L.geoJSON(shape,{style:{color:'#7d622e',weight:1,fillOpacity:.025}}).addTo(map);map.fitBounds(layer.getBounds(),{padding:[15,15]});
  }catch(e){notice(status,'Boundary service unavailable; the facility service is queried separately.');}
  const query=`[out:json][timeout:12];area["ISO3166-2"="CA-${pt[1]}"]->.a;nwr["amenity"~"^(university|college)$"](area.a);out center 500;`;
  try{
    const facilities=await formRequest('https://overpass-api.de/api/interpreter',{data:query});if(!root.isConnected)return;
    if(facilities.remark)throw Error(facilities.remark);
    const nameLookup=new Map(data.institutions.map(i=>[fold(i.memberNameEn.replace(/, [^,]+$/,'')),i]));
    const places=(facilities.elements??[]).map(f=>({...f,lat:f.lat??f.center?.lat,lon:f.lon??f.center?.lon,
      institution:nameLookup.get(fold(f.tags?.name??''))})).filter(f=>Number.isFinite(f.lat)&&Number.isFinite(f.lon));
    const matched=[...new Map(places.filter(f=>f.institution).map(f=>[f.institution.memberId,f.institution])).values()];
    const selected=data.fields.find(f=>String(f.id)===ctx.options.program),fields=selected?(selected.parts??[selected]).map(f=>f.id):[1];
    const key=(i,f)=>coord([i.memberId,f,1,1,Number(ctx.options.kind??1),Number(ctx.options.registration??1),Number(ctx.options.student??1),Number(ctx.options.psisgender??1)]);
    const values=await points('37100277',matched.flatMap(i=>fields.map(f=>key(i,f))),1);if(!root.isConnected)return;
    const enrol=i=>{if(!i)return null;const numbers=fields.map(f=>values.get(key(i,f))?.find(p=>p.refPer===latest)?.value??null);
      return completeSum(numbers);};
    const counts=matched.map(enrol).filter(v=>v!=null),maximum=Math.max(...counts,1);
    for(const f of places){const n=enrol(f.institution);L.circleMarker([f.lat,f.lon],{radius:n==null?5:5+20*Math.sqrt(n/maximum),color:'#fff',weight:1.5,fillColor:'#473729',fillOpacity:.75})
      .bindPopup(`<b>${esc(f.tags?.name??'Unnamed postsecondary facility')}</b><br>${n==null?'No exact published enrolment match':`${esc(fmt(n))} institution enrolments · ${esc(selected?.name??'All programs')}`}<br>Whole institution count; no allocation to individual campuses.`).addTo(map);}
    status.innerHTML=`<p>${places.length} mapped facilities (query limit 500); ${matched.length} institution names matched exactly to PSIS. ${esc(selected?.name??'All programs')}. Whole-institution enrolments are not campus-specific enrolments.</p>`;
  }catch(e){if(root.isConnected)status.textContent='Facility service unavailable: '+e.message+' The live enrolment charts remain available.';}
  const foot=document.createElement('p');foot.className='source';foot.innerHTML=`${sourceLink('https://www.openstreetmap.org/copyright','OpenStreetMap contributors')} · ${sourceLink('https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3710027701','Statistics Canada · PSIS')}. Facility coverage is incomplete; unmatched names retain no enrolment value.`;node.append(foot);
}
