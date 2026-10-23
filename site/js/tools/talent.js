// Talent pipeline: postsecondary enrolments by CIP primary grouping (37-10-0011, as published) and by institution
// (37-10-0277). Institution counts are whole-institution totals, attached to a mapped facility only on an exact name
// match; a grouping is shown for an institution only when every one of its CIP components is published.
import {psisGroups,psis,psisInstitutions,request,table} from '../api.js';
import {CANADA,PT,int,compact} from '../model.js';
import {h,exhibitMenu,failure,loading,esc,showTip,hideTip} from '../ui.js';
import {spark} from '../charts.js';
import {createMap,boundaryOf,overpass,bbox,setLayer,fit} from '../geo.js';
import {lifetime} from './common.js';

const fold=s=>s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/, [^,]+$/,'').replace(/^the /,'').replace(/[^a-z0-9]/g,'');
const schoolYear=p=>p?.refPer2?`${p.refPer.slice(0,4)}/${p.refPer2.slice(2,4)}`:p?.refPer?`${p.refPer.slice(0,4)}/${String(Number(p.refPer.slice(2,4))+1).padStart(2,'0')}`:'';
const select=(label,key,value,options,app,render)=>h('label',{class:'station-row'},`${label} `,h('select',{onchange:e=>{app.set(key,e.target.value);render();}},
  options.map(([v,l])=>{const o=new Option(l,v);o.selected=v===value;return o;})));

export function talent(el,app) {
  const life=lifetime(el),side=h('div',{class:'side'}),mapEl=h('div',{class:'map',role:'region','aria-label':'Map of postsecondary institutions'});
  const kpi=h('div',{class:'map-card',style:{minWidth:'230px'}}),note=h('p',{class:'map-note',hidden:true}),tools=h('div',{class:'map-tools'});
  el.append(h('div',{class:'frame talent'},side,h('div',{class:'map-wrap'},mapEl,kpi,note,tools)));
  const m=createMap(mapEl);let rules=null;

  async function render() {
    const alive=life.next(),place=await app.resolved();if(!alive()||place.id!==app.state.geo.id)return;
    const t=app.state.t,pr=place.id===CANADA.id?'':String(place.province).split('_')[0],prName=PT.find(p=>p[0]===pr)?.[2];
    side.replaceChildren(h('p',{class:'side-eyebrow'},'Talent pipeline'),h('h3',{class:'side-title'},'Talent pipeline'),
      h('p',{class:'side-text'},`Universities and colleges ${pr?`in ${prName}`:'in Canada'} and their enrolments by field of study.`),
      h('div',{class:'count-label'},'Students by discipline'),h('div',{class:'cip-list'}));
    const listEl=side.querySelector('.cip-list');loading(listEl,'Querying enrolments…');kpi.replaceChildren(h('span',{class:'card-sub'},'Loading…'));note.hidden=true;
    let d;
    try {d=await psisGroups(pr,{kind:Number(t.tpk),registration:Number(t.tpr)});} catch(e) {if(alive())failure(listEl,e,render,'Enrolments unavailable');return;}
    if(!alive())return;
    const latest=d.total.filter(p=>p.value!=null).at(-1),at=s=>s.find(p=>p.refPer===latest?.refPer)?.value??null;
    const list=[{id:'',name:'All disciplines',series:d.total},...d.groups].map(g=>({...g,value:at(g.series)}));
    list.sort((a,b)=>a.id===''?-1:b.id===''?1:(b.value??-1)-(a.value??-1));
    const chosen=list.find(g=>g.id===t.tp)??list[0];
    listEl.replaceChildren(...list.map(g=>h('button',{type:'button',class:'cip','aria-pressed':String(g===chosen),onclick:()=>{app.set('tp',g.id);render();}},
      h('span',{},g.name),h('span',{},h('b',{},g.value==null?'n/a':compact(g.value)),h('small',{},g.value==null?'not published':'Students')))));
    side.append(h('div',{class:'side-foot'},
      select('Institutions','tpk',t.tpk,[['1','All institutions'],['2','Universities'],['3','Colleges']],app,render),
      select('Registration','tpr',t.tpr,[['1','All registrations'],['2','Full-time'],['3','Part-time']],app,render),
      h('p',{},`Statistics Canada, table 37-10-0011 (PSIS), ${schoolYear(latest)}. Enrolments count registrations, not graduates or unique people.`)));
    const meta={source:'Statistics Canada, table 37-10-0011: Postsecondary enrolments, by field of study (CIP primary groupings)',url:table('37100011'),geo:d.geoName,period:schoolYear(latest),
      universe:'Registrations at public postsecondary institutions',notes:Number(pr)>=60?'Primary groupings are published for the three territories combined.':'Groupings and the total are published by Statistics Canada; rounding means groups need not add exactly to the total.'};
    const years=d.total.map(p=>p.refPer);
    tools.replaceChildren(exhibitMenu({title:'Enrolments by discipline',...meta,table:()=>({headers:['Discipline',...d.total.map(schoolYear)],
      rows:list.map(g=>[g.name,...years.map(y=>g.series.find(p=>p.refPer===y)?.value??null)]),numeric:new Set(years.map((_,i)=>i+1)),format:v=>int(v)})}));
    kpi.replaceChildren(h('span',{class:'card-sub'},`Enrolments, ${schoolYear(latest)}`),h('div',{class:'kpi-value',style:{fontSize:'27px',color:'#475467'}},chosen.value==null?'Not available':compact(chosen.value)),
      h('span',{class:'card-sub'},`${chosen.id?chosen.name:'All disciplines'} · ${d.geoName}${Number(pr)>=60?' (combined)':''}`),spark(chosen.series));
    if(place.type!=='PR'&&place.id!==CANADA.id){note.hidden=false;note.textContent=`Enrolments are published for institutions and provinces, not for ${place.name}; these figures describe ${d.geoName}.`;}
    if(!m)return;await m.ready;if(!alive())return;
    if(!pr){note.hidden=false;note.textContent='Choose a province or territory to map its institutions.';return;}
    boundaryOf({id:`2021A0002${pr}`,type:'PR'}).then(o=>{if(!alive())return;setLayer(m.map,'outline',o,[{id:'outline-line',type:'line',paint:{'line-color':'#555','line-width':1.3,'line-dasharray':[3,2]}}]);
      const b=bbox(o);mapEl._bounds=b;fit(m.map,b,false);}).catch(()=>{});
    mapInstitutions({place,pr,chosen,alive,latest});
  }

  // Institutions: 37-10-0277 totals for the chosen grouping (complete components only), placed at OpenStreetMap facilities.
  async function mapInstitutions({place,pr,chosen,alive}) {
    const t=app.state.t;let inst,counts;
    try {
      rules??=await request('classification.json');
      inst=await psis(place,{kind:Number(t.tpk),registration:Number(t.tpr),periods:1});
      const ids=chosen.id?inst.fields.filter(f=>f.code!=='30.'&&rules.cip?.[f.code]?.name===chosen.name).map(f=>f.id):[1];
      const year=inst.totalSeries.at(-1)?.refPer;
      counts=ids.length?await psisInstitutions(inst.metadata,inst.institutions,ids,{kind:Number(t.tpk),registration:Number(t.tpr)},year):new Map();
    } catch(e) {if(alive()){note.hidden=false;note.textContent=`Institution enrolments unavailable: ${e.message}`;}return;}
    if(!alive())return;
    note.hidden=false;note.textContent='Loading institution locations from OpenStreetMap (the public server can take up to a minute)…';
    let osm;
    try {osm=await overpass(`[out:json][timeout:60];area["ISO3166-2"="CA-${PT.find(p=>p[0]===pr)[1]}"]->.a;nwr["amenity"~"^(university|college)$"]["name"](area.a);out center 400;`);}
    catch(e){if(alive())note.textContent=`Institution locations unavailable: ${e.message} Enrolment figures are unaffected.`;return;}
    if(!alive())return;
    const byName=new Map(inst.institutions.map(i=>[fold(i.memberNameEn),i])),seen=new Set(),feats=[];
    for(const x of osm.elements??[]){const lat=x.lat??x.center?.lat,lon=x.lon??x.center?.lon;if(!Number.isFinite(lat))continue;
      const i=byName.get(fold(x.tags.name)),first=i&&!seen.has(i.memberId);if(first)seen.add(i.memberId);
      feats.push({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{name:x.tags.name,value:first?counts.get(i.memberId)??null:null,matched:!!i,first:!!first}});}
    const max=Math.max(1,...feats.map(f=>f.properties.value??0));
    for(const f of feats)f.properties.r=f.properties.value==null?4:6+26*Math.sqrt(f.properties.value/max);
    setLayer(m.map,'schools',{type:'FeatureCollection',features:feats},[{id:'schools',type:'circle',paint:{'circle-radius':['get','r'],
      'circle-color':['case',['==',['get','value'],null],'rgba(255,255,255,0.85)','rgba(245,170,40,0.35)'],'circle-stroke-color':['case',['get','matched'],'#f0a020','#98a2b3'],'circle-stroke-width':1.6}}]);
    if(!m.bound){m.bound=true;
      m.map.on('mousemove','schools',e=>{const p=e.features[0].properties;m.map.getCanvas().style.cursor='pointer';
        showTip(e.originalEvent,`<b>${esc(p.name)}</b><br>${p.value!=null&&p.value!=='null'?`${int(+p.value)} enrolments, whole institution`:p.first===true||p.first==='true'?'Grouping not published for this institution':p.matched===true||p.matched==='true'?'Further location of a matched institution':'No exact PSIS name match'}`);});
      m.map.on('mouseleave','schools',()=>{m.map.getCanvas().style.cursor='';hideTip();});
    }
    note.textContent=`${feats.length} facilities from OpenStreetMap; ${seen.size} of ${inst.institutions.length} PSIS institutions matched by exact name. Circles show whole-institution enrolments${chosen.id?` in ${chosen.name}`:''}, not campus counts.`;
  }
  return {update(changed){if(['geo','refresh','tp','tpk','tpr'].some(k=>changed.has(k)))render();},destroy:()=>m?.destroy()};
}
