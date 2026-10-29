// Page state, URL and history, geography selection and lazy tool mounting.
// Geography and benchmark changes push history entries; view and filter changes replace the current one.
import {PT,CANADA,TYPES,provinceOf,provinceGeo,provinceName,matchesProvince,int} from './model.js';
import {parse,serialize,withGeography,SECTIONS,KEYS,benchmarkFor} from './state.js';
import {geographies,census} from './api.js';
import {journal,memoRequest,clearCache} from './transport.js';
import {h,dialog,dataTable,combobox} from './ui.js';
import {mapLibrary} from './geo.js';
import {profile} from './tools/profile.js';
import {explorer} from './tools/explorer.js';
import {market} from './tools/market.js';
import {industries} from './tools/industries.js';
import {overview,compare} from './tools/regional.js';

const $=id=>document.getElementById(id);
const TOOLS={
  overview:{title:'Findings',text:'Where this place stands out: its value, its rank among comparable areas and the benchmark.',make:overview},
  industries:{title:'Economy',text:'Payroll job change by sector over the years you choose, the sectors residents work in, and detailed industries.',make:industries},
  compare:{title:'Compare',text:'The same measures and period across the most similar areas, neighbours or peers you choose.',make:compare},
  detail:{title:'Detail',text:'Residents, work, households, housing and commuting, each against the benchmark.',make:profile},
};

let state=parse(location.search,location.hash),place=null,placeToken=0;
const mounted=new Map();
let mapDialog=null,mapTool=null;
const lists=new Map();
const placeList=type=>memoRequest(lists,type,()=>geographies(type));

// Resolve name and province for a geography from the official list (or the profile when the list fails).
async function resolve(geo) {
  if(geo.id===CANADA.id) return {...CANADA};
  if(geo.type==='PR'){const c=provinceOf(geo),name=provinceName(c);return {...geo,name:name||geo.id,province:name?c:''};}
  try {const g=(await placeList(geo.type)).find(x=>x.id===geo.id);if(g)return {...geo,name:g.name,description:g.description,population:g.population,province:String(g.province??provinceOf(geo)),municipalType:g.municipalType};}
  catch {}
  try {const p=await census(geo);return {...geo,name:p.area?.name??geo.id,province:provinceOf(geo)};}
  catch {return {...geo,name:geo.id,province:provinceOf(geo),unresolved:true};}
}
let benchPlace=null,benchPending=null;
const benchmark=()=>{const g=benchmarkFor(place?.id===state.geo.id?place:state.geo,state.t.bench);
  return benchPlace?.id===g.id?benchPlace:{...g,name:g.name??g.id};};

// The context every tool receives. set() writes one URL key; choose() changes geography.
let pending=null;
const resolveCurrent=()=>{if(pending?.id!==state.geo.id){pending=resolve(state.geo);pending.id=state.geo.id;}return pending;};
const app={
  get state(){return state;},get place(){return place;},get bench(){return benchmark();},
  // Resolved place for the current geography; tools compare its id with app.state.geo.id before drawing.
  async resolved(){const p=await resolveCurrent();if(p.id!==state.geo.id)return p;place=p;
    const v=state.t.bench,g=benchmarkFor(p,v);
    if(benchPlace?.id!==g.id){
      if(benchPending?.id!==g.id){benchPending=resolve(g);benchPending.id=g.id;}
      const b=await benchPending;if(p.id===state.geo.id&&v===state.t.bench)benchPlace=b;
    }
    return p;},
  set(key,value){state={...state,t:{...state.t,[key]:value}};history.replaceState(null,'',serialize(state)||location.pathname);},
  choose(geo,section='overview'){
    const next=withGeography(state,geo);next.t.map='';
    go(next,section);
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
  if(place?.id!==state.geo.id)setHeader({...state.geo,name:'Loading…'});
  const resolved=await app.resolved();if(token!==placeToken||resolved.id!==state.geo.id)return;setHeader(resolved);syncBar();
}
function setHeader(g) {
  $('place-name').textContent=g.name;
  const type=g.id===CANADA.id?'Country':TYPES[g.type]??'';
  const parent=g.province&&g.type!=='PR'?String(g.province).split('_').map(provinceName).filter(Boolean).join(' and '):'';
  $('place-meta').textContent=[g.municipalType||type,parent,g.population?`${int(g.population)} residents (2021)`:'',g.unresolved?'name unavailable from the source':''].filter(Boolean).join(' · ');
  document.title=g.name&&g.name!=='Loading…'?`${g.name} · Canada Regional Profiles`:'Canada Regional Profiles';
}

// ---------- geography bar ----------
function syncBar() {
  const pr=place?provinceOf(place):'';
  $('province').value=pr;
  if(place&&place.type!=='PR')$('level').value=place.type;
  if(state.t.map&&!mapDialog)openMap(state.t.map);
  if(!state.t.map&&mapDialog)mapDialog.close();
  const g=place??state.geo,custom=!['CA','PT'].includes(state.t.bench)&&benchmark().type!=='PR';
  const options=[new Option('Canada','CA'),new Option('Province or territory','PT')];
  options[1].disabled=!pr||g.type==='PR';
  if(g.id!==CANADA.id)options.push(...PT.map(([c])=>provinceGeo(c)).filter(p=>p.id!==g.id).map(p=>new Option(p.name,p.id)));
  if(g.type!=='PR')options.push(new Option('Another region…','custom'));
  $('bench').replaceChildren(...options);$('bench').value=custom?'custom':state.t.bench;
  $('benchmark-search').hidden=!custom;
  $('bench-input').value=custom?benchmark().name:'';
  $('bench-help').textContent=custom?`Comparing with ${benchmark().name}. Search by name anywhere in Canada.`:'Choose a region to apply the benchmark.';
  $('place-input').value=place&&place.type!=='PR'?place.name:'';
}
function setupBar() {
  $('province').append(new Option('Canada',''),...PT.map(([c,,n])=>new Option(n,c)));
  $('province').onchange=()=>{const c=$('province').value;go(withGeography(state,c?provinceGeo(c):CANADA));};
  $('bench').onchange=()=>{const v=$('bench').value;
    if(v==='custom'){$('benchmark-search').hidden=false;$('bench-input').value='';$('bench-help').textContent=`Search ${TYPES[state.geo.type].toLowerCase()} names across Canada; select one to apply it.`;$('bench-input').focus();return;}
    chooseBench(v);
  };
  setupBenchmark();
  $('level').onchange=()=>{$('place-input').value='';$('place-input').focus();openList();};
  const openList=combobox($('place-input'),$('place-list'),{
    pending:'Loading official geographies…',empty:'No matching places in this province or territory.',error:'Geography list unavailable',
    load:async term=>{
      const type=$('level').value,pr=$('province').value,all=await placeList(type);
      return all.filter(g=>matchesProvince(g,pr)&&(!term||g.name.toLowerCase().includes(term)))
        .sort((a,b)=>(a.name.toLowerCase().startsWith(term)?0:1)-(b.name.toLowerCase().startsWith(term)?0:1)||(b.population??0)-(a.population??0)).slice(0,60);
    },
    describe:g=>[g.description?.replace(/ \[[^\]]+\]/,'')??g.name,g.population!=null?int(g.population):''],
    choose:g=>go(withGeography(state,{id:g.id,type:g.type})),
  });
  $('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('geo-status').textContent='Link copied. It reopens this geography and these views.';}
    catch{$('geo-status').textContent='Copy the address bar to share this view.';}};
  $('explore-map').onclick=()=>openMap('market');
  $('open-sources').onclick=sources;
}

// The benchmark uses the selected area's level, without restricting the search to its province.
function chooseBench(v,g) {
  if(g)benchPlace=g;
  go({...state,t:{...state.t,bench:v}});
}
function setupBenchmark() {
  combobox($('bench-input'),$('bench-list'),{
    pending:'Loading official regions…',empty:'No matching regions. Try a name in another province.',error:'Region list unavailable',
    load:async q=>{
      const {type,id}=state.geo,all=await placeList(type);if(id!==state.geo.id)return null;
      return all.filter(g=>g.id!==id&&`${g.name} ${g.description??''}`.toLowerCase().includes(q))
        .sort((a,b)=>(b.population??0)-(a.population??0)).slice(0,40);
    },
    describe:g=>[g.description??g.name,PT.find(p=>p[0]===provinceOf(g))?.[1]??''],choose:g=>chooseBench(g.id,g),
  });
}

// ---------- sections ----------
function build() {
  const main=$('main'),links=$('section-links');
  for(const key of SECTIONS){
    const t=TOOLS[key],mount=h('div',{class:'tool',id:`${key}-tool`});
    main.append(h('section',{class:'tool-section',id:key,hidden:true,'aria-labelledby':`${key}-h`},
      h('div',{class:'wrap'},h('div',{class:'section-head'},h('h2',{id:`${key}-h`},t.title),h('p',{},t.text)),mount)));
    links.append(h('li',{},h('a',{href:`#${key}`,onclick:e=>{e.preventDefault();app.show(key);}},t.title)));
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
async function openMap(kind='market') {
  if(mapDialog){mapDialog.close();mapDialog.remove();mapDialog=null;mapTool?.destroy?.();mapTool=null;}
  app.set('map',kind);
  const body=h('div',{class:'map-dialog-body'}),bar=h('div',{class:'map-switch'}),host=h('div',{class:'map-dialog-host'});
  bar.append(...[['market','Explore distributions'],['explorer','Find communities']].map(([k,label])=>h('button',{class:'btn ghost',type:'button','aria-pressed':String(k===kind),onclick:()=>openMap(k)},label)));
  body.append(bar,host);host.append(h('p',{class:'notice'},'Loading map…'));
  const d=dialog('Explore map',body);d.classList.add('map-dialog');mapDialog=d;
  d.addEventListener('close',()=>{d.remove();if(mapDialog!==d)return;mapTool?.destroy?.();mapTool=null;mapDialog=null;app.set('map','');});
  try {await mapLibrary();if(mapDialog!==d)return;host.replaceChildren();mapTool=(kind==='explorer'?explorer:market)(host,app);mapTool.update(new Set(['geo']));}
  catch(e){if(mapDialog===d)host.replaceChildren(h('p',{class:'notice'},e.message));}
}
function refresh() {
  clearCache();lists.clear();$('geo-status').textContent='Querying the public sources again.';
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
