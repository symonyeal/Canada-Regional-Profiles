// Distribution maps (consumers, dwellings, businesses): rail, filter cards and map.
import {FILTERS} from '../census.js';
import {h,rail,exhibitMenu,failure} from '../ui.js';
import {lifetime} from './common.js';
import {CANADA} from '../model.js';
import {filterData,filterCards,parseSelection,serializeSelection,mapPanel,mapTable,shapes,scopeOf} from './choropleth.js';

const MARKET=[['consumers','Consumers','household'],['dwellings','Dwellings','dwelling'],['businesses','Businesses','store']];

// One filter group: description, filter cards and a map. keys: URL keys for map, selection and unit.
function groupView(el,app,group,keys,alive) {
  const g=FILTERS[group],filters=h('div',{class:'filters'}),mapBox=h('div',{class:'map-cell',style:{position:'relative',minHeight:'0',display:'flex'}});
  el.replaceChildren(filters,mapBox);
  const mapKey=g.maps[app.state.t[keys.map]]?app.state.t[keys.map]:Object.keys(g.maps)[0];
  const panel=mapPanel(mapBox,{unit:app.state.t[keys.unit],onunit:v=>app.set(keys.unit,v),onopen:id=>app.choose({id,type:app.state.geo.id===CANADA.id?'PR':'CSD'})});
  mapBox.querySelector('.map-wrap').style.flex='1';
  const head=[h('h3',{class:'side-title'},g.title),h('p',{class:'side-text'},g.description),h('div',{class:'count-label'},`${Object.keys(g.maps).length} ${Object.keys(g.maps).length===1?'map':'maps'}`)];
  const cards=h('div',{});filters.append(...head,cards);
  let state={key:mapKey,data:null,sel:null};
  app.resolved().then(async place=>{
    if(!alive()||place.id!==app.state.geo.id)return;
    const shapesP=shapes(scopeOf(place));shapesP.catch(()=>{});
    const load=async key=>{
      state={key,data:null,sel:null};
      filterCards(cards,{group,open:key,sel:null,onopen:open});
      try {
        const data=await filterData(place,group,key);if(!alive()||state.key!==key)return;
        const sel=parseSelection(data.spec,key===app.state.t[keys.map]?app.state.t[keys.sel]:'',data.spec.bins.length);
        state={key,data,sel};draw(place,shapesP);
      } catch(e) {if(alive()&&state.key===key)failure(cards.querySelector('.filter[aria-expanded=true]')??cards,e,()=>load(key),'Map data unavailable');}
    };
    const open=key=>{app.set(keys.map,key);app.set(keys.sel,'');load(key);};
    const draw=(place,shapesP)=>{
      const {key,data,sel}=state;
      filterCards(cards,{group,open:key,sel,names:data.names,onopen:open,onchange:next=>{state.sel=next;app.set(keys.sel,serializeSelection(data.spec,next));draw(place,shapesP);}});
      panel.draw({data,sel,place,group,shapes:shapesP}).then(()=>{
        const tools=mapBox.querySelector('.map-tools')??mapBox.querySelector('.map-wrap').appendChild(h('div',{class:'map-tools'}));
        tools.replaceChildren(exhibitMenu({title:`${g.title}: ${data.spec.label.replace('by ','')}`,...data.source,geo:`${place.name} (card); census subdivisions of ${scopeOf(place)?'the province or territory':'Canada'} (map)`,
          notes:'The selected bins of one Census distribution are summed; different filters are not combined into a joint count. Map classes are natural breaks.',table:()=>mapTable(panel.rows)}));
      });
    };
    load(mapKey);
  });
  return panel;
}

export function market(el,app) {
  const life=lifetime(el),frame=h('div',{class:'frame with-filters'});el.append(frame);let panel=null;
  function render() {
    const alive=life.next(),group=app.state.t.mk,body=h('div',{style:{display:'contents'}});
    panel?.destroy?.();
    frame.replaceChildren(rail(MARKET.map(([key,label,icon])=>({key,label,icon})),group,key=>{app.set('mk',key);app.set('mkm','');app.set('mkr','');render();},'Market'),body);
    panel=groupView(body,app,group,{map:'mkm',sel:'mkr',unit:'mku'},alive);
  }
  return {update(changed){if(['geo','refresh','mk','mkm','mkr'].some(k=>changed.has(k)))render();},destroy:()=>panel?.destroy?.()};
}
