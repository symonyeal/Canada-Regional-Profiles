// Page state, URL and history, geography selection and lazy tool mounting.
// Geography changes push a history entry; view and filter changes replace the current one.
import {PT,CANADA,TYPES,provinceOf,matchesProvince,int} from './model.js';
import {parse,serialize,withGeography,SECTIONS,KEYS} from './state.js';
import {geographies,census,journal} from './api.js';
import {refreshData} from './refresh.js';
import {h,dialog,dataTable} from './ui.js';
import {profile} from './tools/profile.js';
import {explorer} from './tools/explorer.js';
import {market} from './tools/market.js';
import {industries} from './tools/industry-brief.js';
import {overview,compare} from './tools/regional.js';

const $=id=>document.getElementById(id);
const TOOLS={
  overview:{title:'Overview',text:'Population, work and living conditions, with dates and a common benchmark.',make:overview},
  people:{title:'People and work',text:'Residents, qualifications and occupations. Resident workers are distinct from jobs located in the area.',
    make:(el,app)=>profile(el,app,{key:'pv',maps:false,tabs:[['resident','Residents','resident'],['workforce','Work and education','workforce']]})},
  housing:{title:'Housing and incomes',text:'Household composition, housing stock and shelter costs. Every measure states its population and period.',
    make:(el,app)=>profile(el,app,{key:'hv',maps:false,tabs:[['household','Households','household'],['dwelling','Housing stock','dwelling'],['livability','Costs and commuting','livability']]})},
  industries:{title:'Industries',text:'Industry size, job gains and losses, and specialization. Open an industry for its history and earnings.',make:industries},
  compare:{title:'Compare regions',text:'The same measures and periods across peer regions.',make:compare},
};

let state=parse(location.search,location.hash),place=null,placeToken=0;
const mounted=new Map();
let mapDialog=null,mapTool=null;
const lists=new Map();
const placeList=type=>{if(!lists.has(type))lists.set(type,geographies(type).catch(e=>{lists.delete(type);throw e;}));return lists.get(type);};

// Resolve name and province for a geography from the official list (or the profile when the list fails).
async function resolve(geo) {
  if(geo.id===CANADA.id) return {...CANADA};
  if(geo.type==='PR'){const p=PT.find(x=>`2021A0002${x[0]}`===geo.id);return {...geo,name:p?.[2]??geo.id,province:p?.[0]??''};}
  try {const g=(await placeList(geo.type)).find(x=>x.id===geo.id);if(g)return {...geo,name:g.name,description:g.description,population:g.population,province:String(g.province??provinceOf(geo)),municipalType:g.municipalType};}
  catch {}
  try {const p=await census(geo);return {...geo,name:p.area?.name??geo.id,province:provinceOf(geo)};}
  catch {return {...geo,name:geo.id,province:provinceOf(geo),unresolved:true};}
}
const benchmark=()=>{const pr=String(place?.province??'').split('_')[0];
  return state.t.bench==='PT'&&pr&&place.type!=='PR'?{id:`2021A0002${pr}`,type:'PR',name:PT.find(x=>x[0]===pr)?.[2]??'Province',province:pr}:{...CANADA};};

// The context every tool receives. set() writes one URL key; choose() changes geography.
let pending=null;
const resolveCurrent=()=>{if(pending?.id!==state.geo.id){pending=resolve(state.geo);pending.id=state.geo.id;}return pending;};
const app={
  get state(){return state;},get place(){return place;},get bench(){return benchmark();},
  // Resolved place for the current geography; tools compare its id with app.state.geo.id before drawing.
  async resolved(){const p=await resolveCurrent();place=p.id===state.geo.id?p:place;return p;},
  set(key,value){state={...state,t:{...state.t,[key]:value}};history.replaceState(null,'',serialize(state)||location.pathname);},
  choose(geo,section='overview'){
    const next=withGeography(state,geo);next.t.map='';
    go(next,({profile:'overview',market:'overview',explorer:'overview',workforce:'people',insights:'industries',largest:'industries',growing:'industries'})[section]??section);
  },
  placeList,
  show(section){state={...state,section};history.replaceState(null,'',serialize(state)||location.pathname);showSection();},
};

async function go(next,section) {
  const changed=diff(state,next);state=next;
  if(section)state={...state,section};
  history.pushState(null,'',serialize(state)||location.pathname);
  await apply(changed);
  if(section)document.getElementById(section)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function diff(a,b) {
  const c=new Set();if(a.geo.id!==b.geo.id)c.add('geo');
  for(const k of Object.keys(KEYS))if(a.t[k]!==b.t[k])c.add(k);return c;
}
async function apply(changed) {
  const token=++placeToken;
  showSection(changed);
  mapTool?.update(changed);
  if(changed.has('geo')||!place){
    if(place?.id!==state.geo.id)setHeader({...state.geo,name:'Loading…'});
    const resolved=await app.resolved();if(token!==placeToken||resolved.id!==state.geo.id)return;setHeader(resolved);syncBar();
  } else syncBar();
}
function setHeader(g) {
  $('place-name').textContent=g.name;
  const type=g.id===CANADA.id?'Country':TYPES[g.type]??'';
  const parent=g.province&&g.type!=='PR'?String(g.province).split('_').map(p=>PT.find(x=>x[0]===p)?.[2]).filter(Boolean).join(' and '):'';
  $('place-meta').textContent=[g.municipalType||type,parent,g.population?`${int(g.population)} residents (2021)`:'',g.unresolved?'name unavailable from the source':''].filter(Boolean).join(' · ');
  document.title=g.name&&g.name!=='Loading…'?`${g.name} · Canada Regional Profiles`:'Canada Regional Profiles';
}

// ---------- geography bar ----------
function syncBar() {
  const pr=String(place?.province??'').split('_')[0];
  $('province').value=place?.type==='PR'?pr:pr;
  if(place&&place.type!=='PR')$('level').value=place.type;
  if(state.t.map&&!mapDialog)openMap(state.t.map);
  if(!state.t.map&&mapDialog)mapDialog.close();
  $('bench').value=state.t.bench;
  $('bench').options[1].disabled=!pr||place?.type==='PR';
  $('place-input').value=place&&place.type!=='PR'?place.name:'';
}
function setupBar() {
  $('province').append(new Option('Canada',''),...PT.map(([c,,n])=>new Option(n,c)));
  $('province').onchange=()=>{const c=$('province').value;go(withGeography(state,c?{id:`2021A0002${c}`,type:'PR'}:CANADA));};
  $('bench').onchange=()=>{const v=$('bench').value;state={...state,t:{...state.t,bench:v}};history.replaceState(null,'',serialize(state)||location.pathname);apply(new Set(['bench']));};
  $('level').onchange=()=>{$('place-input').value='';$('place-input').focus();openList();};
  const input=$('place-input'),list=$('place-list');let matches=[],active=-1,version=0;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
  async function openList() {
    const v=++version,type=$('level').value,pr=$('province').value,term=input.value.trim().toLowerCase();
    list.hidden=false;input.setAttribute('aria-expanded','true');list.replaceChildren(h('li',{class:'note'},'Loading official geographies…'));
    try {
      const all=await placeList(type);if(v!==version)return;
      matches=all.filter(g=>matchesProvince(g,pr)&&(!term||g.name.toLowerCase().includes(term)))
        .sort((a,b)=>(a.name.toLowerCase().startsWith(term)?0:1)-(b.name.toLowerCase().startsWith(term)?0:1)||(b.population??0)-(a.population??0)).slice(0,60);
      active=-1;
      list.replaceChildren(...(matches.length?matches.map((g,i)=>h('li',{id:`opt-${i}`,role:'option','aria-selected':'false',onmousedown:e=>{e.preventDefault();pick(i);}},
        h('span',{},g.description?.replace(/ \[[^\]]+\]/,'')??g.name),h('small',{},g.population!=null?int(g.population):''))):[h('li',{class:'note'},'No matching places in this province or territory.')]));
    } catch(e) {if(v===version)list.replaceChildren(h('li',{class:'note'},`Geography list unavailable: ${e.message}`));}
  }
  const pick=i=>{const g=matches[i];if(!g)return;close();go(withGeography(state,{id:g.id,type:g.type}));};
  const highlight=i=>{active=i;[...list.children].forEach((li,j)=>li.setAttribute('aria-selected',String(j===i)));
    if(i>=0){input.setAttribute('aria-activedescendant',`opt-${i}`);list.children[i]?.scrollIntoView({block:'nearest'});}};
  input.addEventListener('input',openList);input.addEventListener('focus',openList);input.addEventListener('blur',()=>setTimeout(close,120));
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)openList();else highlight(Math.min(matches.length-1,active+1));}
    else if(e.key==='ArrowUp'){e.preventDefault();highlight(Math.max(0,active-1));}
    else if(e.key==='Enter'){e.preventDefault();pick(active>=0?active:0);}
    else if(e.key==='Escape'){close();}
  });
  $('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('geo-status').textContent='Link copied. It reopens this geography and these views.';}
    catch{$('geo-status').textContent='Copy the address bar to share this view.';}};
  $('explore-map').onclick=()=>openMap('market');
  $('open-sources').onclick=sources;
}

// ---------- sections ----------
function build() {
  const main=$('main'),links=$('section-links');
  for(const key of SECTIONS){
    const t=TOOLS[key],mount=h('div',{class:'tool',id:`${key}-tool`});
    main.append(h('section',{class:'tool-section',id:key,hidden:true,'aria-labelledby':`${key}-h`},
      h('div',{class:'wrap'},h('div',{class:'section-head'},h('h2',{id:`${key}-h`},t.title),h('p',{},t.text)),mount)));
    links.append(h('li',{},h('a',{href:`#${key}`,onclick:e=>{e.preventDefault();app.show(key);}},t.title==='Compare regions'?'Compare':t.title)));
  }
}
function showSection(changed=new Set()) {
  const key=state.section||'overview';
  for(const id of SECTIONS)$(id).hidden=id!==key;
  $('section-links').querySelectorAll('a').forEach(a=>a.setAttribute('aria-current',String(a.hash===`#${key}`)));
  if(!mounted.has(key)){
    const tool=TOOLS[key].make($(`${key}-tool`),app);mounted.set(key,tool);tool.update(new Set(['geo']));
  } else mounted.get(key).update(new Set([...changed,'geo','view']));
  // Inactive tools receive state on next activation, rather than querying invisible panels.
}
let mapLibrary=null;
function loadMapLibrary() {
  if(window.maplibregl)return Promise.resolve();
  return mapLibrary??=new Promise((resolve,reject)=>{
    const css=h('link',{rel:'stylesheet',href:'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css',crossorigin:'anonymous'});
    const js=h('script',{src:'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js',crossorigin:'anonymous'});
    js.onload=resolve;js.onerror=()=>{mapLibrary=null;js.remove();css.remove();reject(new Error('Map library unavailable. Close this view and try again.'));};
    document.head.append(css,js);
  });
}
async function openMap(kind='market') {
  if(mapDialog){mapDialog.close();mapDialog.remove();mapDialog=null;mapTool?.destroy?.();mapTool=null;}
  app.set('map',kind);
  const body=h('div',{class:'map-dialog-body'}),bar=h('div',{class:'map-switch'}),host=h('div',{class:'map-dialog-host'});
  bar.append(...[['market','Explore distributions'],['explorer','Find communities']].map(([k,label])=>h('button',{class:'btn ghost',type:'button','aria-pressed':String(k===kind),onclick:()=>openMap(k)},label)));
  body.append(bar,host);host.append(h('p',{class:'notice'},'Loading map…'));
  const d=dialog('Explore map',body);d.classList.add('map-dialog');mapDialog=d;
  d.addEventListener('close',()=>{d.remove();if(mapDialog!==d)return;mapTool?.destroy?.();mapTool=null;mapDialog=null;app.set('map','');});
  try {await loadMapLibrary();if(mapDialog!==d)return;host.replaceChildren();mapTool=(kind==='explorer'?explorer:market)(host,app);mapTool.update(new Set(['geo']));}
  catch(e){if(mapDialog===d)host.replaceChildren(h('p',{class:'notice'},e.message));}
}
function refresh() {
  refreshData();lists.clear();$('geo-status').textContent='Querying the public sources again.';
  for(const [,tool] of mounted)tool.update(new Set(['geo','refresh']));
  mapTool?.update(new Set(['geo','refresh']));
}
function sources() {
  const rows=journal.slice(-150).reverse().map(r=>[r.url.replace(/\?.*/,'?…'),String(r.status),r.ms,r.at.slice(11,19),r.attempt]);
  dialog('Data and sources',h('div',{},h('button',{class:'btn ghost',type:'button',id:'refresh',onclick:refresh},'Refresh data'),
    h('p',{class:'side-text'},'Each exhibit queries these public services when it is shown. Retrieval time is not the observation period; every exhibit names its own reference period.'),
    h('ul',{class:'side-text'},[['Statistics Canada Census Profile 2021 (SDMX)','https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/dataflow/all/all/latest'],
      ['Statistics Canada Web Data Service (tables)','https://www.statcan.gc.ca/en/developers/wds'],['Statistics Canada 2021 cartographic boundaries (simplified copy served with this page)','https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer'],
      ['OpenFreeMap basemap','https://openfreemap.org/']].map(([t,u])=>h('li',{},h('a',{href:u,target:'_blank',rel:'noopener'},t)))),
    h('h4',{style:{margin:'16px 0 8px'}},`Requests in this tab (${journal.length})`),
    dataTable({headers:['Endpoint','Status','ms','Time (UTC)','Attempt'],rows,numeric:new Set([2,4])})));
}

window.addEventListener('hashchange',()=>{const next=parse(location.search,location.hash);const changed=diff(state,next);state=next;apply(changed);});
window.addEventListener('popstate',()=>{const next=parse(location.search,location.hash);const changed=diff(state,next);state=next;apply(changed);});
setupBar();build();apply(new Set(['geo']));
