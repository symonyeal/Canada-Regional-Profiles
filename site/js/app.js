// Page state, URL and history, geography selection and lazy tool mounting.
// Geography changes push a history entry; view and filter changes replace the current one.
import {PT,CANADA,TYPES,provinceOf,matchesProvince,int} from './model.js';
import {parse,serialize,withGeography,SECTIONS,KEYS} from './state.js';
import {geographies,census,journal} from './api.js';
import {refreshData} from './refresh.js';
import {h,dialog,dataTable} from './ui.js';
import {logistics} from './tools/logistics.js';
import {profile} from './tools/profile.js';
import {explorer} from './tools/explorer.js';
import {market,workforce} from './tools/market.js';
import {insights} from './tools/insights.js';
import {growing,largest} from './tools/industries.js';
import {talent} from './tools/talent.js';

const $=id=>document.getElementById(id);
const TOOLS={
  logistics:{title:'Logistics and access',nav:'Logistics',text:'Airports, highways, ports, rail and high-speed internet around the selected area.',make:logistics},
  profile:{title:'Community profile',nav:'Community profile',text:'Economy, residents, households, dwellings, workforce and livability, compared with the chosen benchmark.',make:profile},
  explorer:{title:'Community explorer',nav:'Explorer',text:'Find a community by name or municipal type, see it on the map and open its profile.',make:explorer},
  market:{title:'Market',nav:'Market',text:'Consumers, dwellings and businesses in chosen Census groups, mapped by census subdivision.',make:market},
  workforce:{title:'Workforce',nav:'Workforce',text:'Education, industry and occupation of residents, with catchment maps of chosen groups.',make:workforce},
  insights:{title:'Industry insights',nav:'Industry insights',text:'Employment trend, specialization and business locations for any industry.',make:insights},
  growing:{title:'Fast-growing industries',nav:'Fast-growing',text:'Industries with the largest five-year gains in payroll employment.',make:growing},
  largest:{title:'Largest industries',nav:'Largest',text:'Industries with the most payroll employees.',make:largest},
  talent:{title:'Talent pipeline',nav:'Talent',text:'Postsecondary enrolments by field of study and institution.',make:talent},
};

let state=parse(location.search,location.hash),place=null,placeToken=0;
const mounted=new Map();
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
  choose(geo,section){go(withGeography(state,geo),section);},
  placeList,
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
  for(const [, tool] of mounted)tool.update(changed);
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
  $('refresh').onclick=()=>{refreshData();lists.clear();$('geo-status').textContent=`Data cleared at ${new Date().toLocaleTimeString('en-CA')}; querying the sources again.`;
    for(const [,tool] of mounted)tool.update(new Set(['geo','refresh']));};
  $('open-sources').onclick=sources;
}

// ---------- sections ----------
function build() {
  const main=$('main'),links=$('section-links');
  for(const key of SECTIONS){
    const t=TOOLS[key],mount=h('div',{class:'tool',id:`${key}-tool`});
    main.append(h('section',{class:'tool-section',id:key,'aria-labelledby':`${key}-h`},
      h('div',{class:'wrap'},h('div',{class:'section-head'},h('h2',{id:`${key}-h`},t.title),h('span',{class:'dashes','aria-hidden':'true'}),h('p',{},t.text)),mount)));
    links.append(h('li',{},h('a',{href:`#${key}`,onclick:()=>{state={...state,section:key};}},t.nav)));
  }
  const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting&&!mounted.has(e.target.dataset.key)){
    const key=e.target.dataset.key,tool=TOOLS[key].make(e.target,app);mounted.set(key,tool);tool.update(new Set(['geo']));io.unobserve(e.target);}},{rootMargin:'700px 0px'});
  for(const key of SECTIONS){const el=$(`${key}-tool`);el.dataset.key=key;io.observe(el);}
  const spy=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)
    links.querySelectorAll('a').forEach(a=>a.setAttribute('aria-current',String(a.getAttribute('href')===`#${e.target.id}`)));},{rootMargin:'-45% 0px -50% 0px'});
  for(const key of SECTIONS)spy.observe($(key));
}
function sources() {
  const rows=journal.slice(-150).reverse().map(r=>[r.url.replace(/\?.*/,'?…'),String(r.status),r.ms,r.at.slice(11,19),r.attempt]);
  dialog('Sources and requests',h('div',{},
    h('p',{class:'side-text'},'Each exhibit queries these public services when it is shown. Retrieval time is not the observation period; every exhibit names its own reference period.'),
    h('ul',{class:'side-text'},[['Statistics Canada Census Profile 2021 (SDMX)','https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/dataflow/all/all/latest'],
      ['Statistics Canada Web Data Service (tables)','https://www.statcan.gc.ca/en/developers/wds'],['Statistics Canada 2021 cartographic boundaries (simplified copy served with this page)','https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer'],
      ['ECCC climate normals','https://api.weather.gc.ca/collections/climate-normals'],['Transport Canada: airports and National Highway System','https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC'],
      ['NRCan: high-speed internet coverage; CanVec railways','https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/High_Speed_Internet_haute_vitesse/MapServer'],
      ['FOSSGIS Valhalla drive times (OpenStreetMap)','https://valhalla1.openstreetmap.de/'],['Wikidata Query Service','https://query.wikidata.org/'],
      ['OpenFreeMap basemap','https://openfreemap.org/']].map(([t,u])=>h('li',{},h('a',{href:u,target:'_blank',rel:'noopener'},t)))),
    h('h4',{style:{margin:'16px 0 8px'}},`Requests in this tab (${journal.length})`),
    dataTable({headers:['Endpoint','Status','ms','Time (UTC)','Attempt'],rows,numeric:new Set([2,4])})));
}

window.addEventListener('popstate',()=>{const next=parse(location.search,location.hash);const changed=diff(state,next);state=next;apply(changed);});
setupBar();build();apply(new Set(['geo']));
if(state.section)requestAnimationFrame(()=>document.getElementById(state.section)?.scrollIntoView());
