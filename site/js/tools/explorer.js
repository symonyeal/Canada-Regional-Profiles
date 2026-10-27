// Community explorer: search and municipal-type filters, a community list and a boundary map with coordinated selection.
import {geographies,censusMany} from '../api.js';
import {CANADA,PT,int,pct,fmt,matchesProvince} from '../model.js';
import {h,icon,showTip,hideTip,esc,failure,loading} from '../ui.js';
import {createMap,subdivisions,bbox,centroid,setLayer,fit} from '../geo.js';
import {lifetime} from './common.js';

const PAGE=25;
const initials=name=>name.replace(/\(.*\)/,'').split(/[\s-]+/).filter(w=>/^[A-ZÀ-Ý]/.test(w)).slice(0,2).map(w=>w[0]).join('')||name[0];

export function explorer(el,app) {
  const life=lifetime(el),search=h('input',{type:'search',placeholder:'Search communities','aria-label':'Search communities'});
  const chips=h('div',{class:'chips',role:'group','aria-label':'Municipal type'}),listEl=h('div',{class:'community-list',role:'list','aria-label':'Communities'});
  const mapEl=h('div',{class:'map',role:'region','aria-label':'Map of communities'}),panel=h('div',{class:'selected-panel',hidden:true}),note=h('p',{class:'map-note',hidden:true});
  const wrap=h('div',{class:'map-wrap'},mapEl,panel,note);
  el.append(h('div',{class:'frame explorer'},h('div',{class:'explorer-head'},h('label',{class:'search'},icon('search',16),search),chips),listEl,wrap));
  const m=createMap(mapEl);let shown=PAGE,data=null;

  async function render() {
    const alive=life.next(),place=await app.resolved();if(!alive()||place.id!==app.state.geo.id)return;
    const pr=place.id===CANADA.id?'':String(place.province).split('_')[0];
    search.value=app.state.t.exq;loading(listEl,'Loading official communities…');panel.hidden=true;note.hidden=true;shown=PAGE;
    try {
      const all=(await geographies('CSD')).filter(g=>matchesProvince(g,pr));if(!alive())return;
      data={pr,all,place,features:null,points:new Map()};
      drawChips();drawList();
      if(!pr){note.hidden=false;note.textContent='Choose a province or territory to map its communities. The list covers all of Canada.';return;}
      if(!m)return;await m.ready;if(!alive())return;
      let fc;
      try {fc=await subdivisions(pr);}
      catch(e){if(alive()){note.hidden=false;note.textContent=`Boundaries unavailable: ${e.message} The community list and profiles still work; Refresh data tries again.`;}return;}
      if(!alive())return;
      data.features=fc;for(const f of fc.features){const c=centroid(f);if(c)data.points.set(f.properties.DGUID,c);}
      const b=bbox(fc);mapEl._bounds=b;fit(m.map,b,false);
      setLayer(m.map,'csd',{type:'FeatureCollection',features:fc.features.map(f=>({type:'Feature',geometry:f.geometry,properties:{id:f.properties.DGUID,name:f.properties.name}}))},
        [{id:'csd-fill',type:'fill',paint:{'fill-color':'#bf1003','fill-opacity':['case',['boolean',['feature-state','hover'],false],.25,0]}},
         {id:'csd-line',type:'line',paint:{'line-color':['case',['boolean',['feature-state','selected'],false],'#000','#a8a8a8'],'line-width':['case',['boolean',['feature-state','selected'],false],2.2,.5]}}],
        m.map.getStyle().layers.find(l=>l.type==='symbol')?.id,{promoteId:'id'});
      if(!m.bound){m.bound=true;let hover=null;
        m.map.on('mousemove','csd-fill',e=>{const f=e.features[0];if(hover!=null&&hover!==f.id)m.map.setFeatureState({source:'csd',id:hover},{hover:false});
          hover=f.id;m.map.setFeatureState({source:'csd',id:hover},{hover:true});m.map.getCanvas().style.cursor='pointer';showTip(e.originalEvent,`<b>${esc(f.properties.name)}</b>`);});
        m.map.on('mouseleave','csd-fill',()=>{if(hover!=null)m.map.setFeatureState({source:'csd',id:hover},{hover:false});hover=null;m.map.getCanvas().style.cursor='';hideTip();});
        m.map.on('click','csd-fill',e=>select(e.features[0].properties.id,true));
        m.map.on('click','dots',e=>select(e.features[0].properties.id,true));
      }
      drawDots();
      if(app.state.t.exs)select(app.state.t.exs,false);
    } catch(e) {if(alive())failure(listEl,e,render,'Communities unavailable');}
  }
  const filtered=()=>{const q=search.value.trim().toLowerCase(),t=app.state.t.ext;
    return data.all.filter(g=>(!t||g.municipalType===t)&&(!q||g.name.toLowerCase().includes(q))).sort((a,b)=>(b.population??-1)-(a.population??-1));};
  function drawChips() {
    const counts=new Map();for(const g of data.all)if(g.municipalType)counts.set(g.municipalType,(counts.get(g.municipalType)??0)+1);
    const types=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,9).map(x=>x[0]).sort();const t=app.state.t.ext;
    chips.replaceChildren(...['',...types].map(type=>h('button',{type:'button',class:'chip-btn','aria-pressed':String(type===t),
      onclick:()=>{app.set('ext',type);shown=PAGE;drawChips();drawList();drawDots();}},type||'All types')));
  }
  function drawList() {
    const rows=filtered();
    listEl.replaceChildren(...rows.slice(0,shown).map(g=>h('button',{type:'button',class:'community',role:'listitem','aria-current':String(g.id===app.state.t.exs),onclick:()=>select(g.id,true)},
      h('span',{class:'avatar','aria-hidden':'true'},initials(g.name)),h('span',{},h('span',{class:'community-name'},g.name),
        h('small',{},[g.municipalType,g.population!=null?`${int(g.population)} residents`:null,data.pr?null:PT.find(p=>p[0]===g.id.slice(9,11))?.[1]].filter(Boolean).join(' · '))),icon('chevronRight',16))),
      rows.length>shown?h('button',{type:'button',class:'btn ghost list-more',onclick:()=>{shown+=PAGE*4;drawList();}},`View more communities (${int(rows.length-shown)} left)`)
        :rows.length?null:h('div',{class:'state empty'},'No communities match this search and type.'));
  }
  function drawDots() {
    if(!m||!data?.features)return;
    const pts=filtered().filter(g=>data.points.has(g.id)).map(g=>({type:'Feature',geometry:{type:'Point',coordinates:data.points.get(g.id)},properties:{id:g.id,name:g.name}}));
    setLayer(m.map,'dots',{type:'FeatureCollection',features:pts},[{id:'dots',type:'circle',paint:{'circle-radius':4.5,'circle-color':'#bf1003','circle-stroke-color':'#fff','circle-stroke-width':1.5}}]);
  }
  search.addEventListener('input',()=>{app.set('exq',search.value.trim());shown=PAGE;drawList();drawDots();});

  // selected: the last community chosen, with or without a map; an older selection's indicators never draw.
  let selected=null;
  async function select(id,user) {
    const g=data.all.find(x=>x.id===id);if(!g)return;
    app.set('exs',id);
    drawList();
    if(m&&data.features){if(selected)m.map.setFeatureState({source:'csd',id:selected},{selected:false});m.map.setFeatureState({source:'csd',id},{selected:true});
      const f=data.features.features.find(x=>x.properties.DGUID===id);if(f&&user){const b=bbox({features:[f]});fit(m.map,b);}}
    selected=id;
    panel.hidden=false;panel.replaceChildren(h('h5',{},g.name),h('p',{class:'card-sub'},g.description?.replace(/ \[[^\]]+\]/,'')??''),h('p',{class:'card-sub'},'Loading Census 2021 indicators…'));
    try {
      const p=(await censusMany('CSD',[id],['1','2','3','6','40'])).get(id);if(selected!==id)return;
      panel.replaceChildren(h('h5',{},g.name),h('p',{class:'card-sub'},`${g.municipalType||'Census subdivision'} · CSD ${id.slice(9)}`),
        h('dl',{},h('dt',{},'Population, 2021'),h('dd',{},int(p.value('1'))),h('dt',{},'Change since 2016'),h('dd',{},p.value('3')==null?'Not available':`${fmt(p.value('3'))}%`),
          h('dt',{},'Density per km²'),h('dd',{},fmt(p.value('6'))),h('dt',{},'Median age'),h('dd',{},fmt(p.value('40')))),
        h('button',{type:'button',class:'btn',onclick:()=>app.choose({id,type:'CSD'},'profile')},'Open community profile',icon('chevronRight',15)));
    } catch(e) {if(selected===id)failure(panel,e,()=>select(id,false),'Indicators unavailable');}
  }
  return {update(changed){if(['geo','refresh','ext'].some(k=>changed.has(k))||(changed.has('exq')&&!changed.has('geo')))render();},destroy:()=>{life.next();m?.destroy();}};
}
