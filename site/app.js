// S: current selection. Each render owns a separate DOM root; late requests cannot replace newer views.
import {PT,CANADA,matchesProvince,esc,validGeographyId} from './model.js';
import {census,geographies,clearCache} from './api.js';
import {loading,failure} from './charts.js';
import {community,workforce,market,profileBrowser} from './profiles.js';
import {industryView} from './industries.js';
import {talent} from './talent.js';
import {logistics,clearMapCache} from './maps.js';
import {explorer} from './explorer.js';
import {sources} from './sources.js';
const $=id=>document.getElementById(id);
const VIEWS={community:['Community profile',community],logistics:['Logistics & access',logistics],explorer:['Community explorer',explorer],
  market:['Market advantages',market],workforce:['Workforce',workforce],insights:['Industry insights',(r,c)=>industryView(r,c,'insights')],
  growing:['Fast growing',(r,c)=>industryView(r,c,'growing')],largest:['Largest industries',(r,c)=>industryView(r,c,'largest')],talent:['Talent pipeline',talent],
  profile:['All characteristics',profileBrowser],sources:['Data & coverage',sources]};
const TYPES={PR:'Province / territory',CSD:'City / municipality',CD:'Census division',CMACA:'Metro / agglomeration',ER:'Economic region',POPCNTR:'Population centre'};
let S,places=[],placeVersion=0,renderVersion=0,cleanups=[];
function readURL() {
  const q=new URLSearchParams(location.search),legacy=PT.find(x=>x[1]===location.hash.slice(1)),province=q.get('province')??legacy?.[0]??'';
  const type=Object.hasOwn(TYPES,q.get('type'))?q.get('type'):'PR';
  const id=q.get('geo')??(province?`2021A0002${province}`:CANADA.id);
  const options=Object.fromEntries([...q.entries()].filter(([k])=>['dashboard','station','airport','display','workview','marketview','marketmode','mapdim','mapbins','mapunit','gender','workage','seasonal','level','measure','trade','top','growth','minbase','metric','institution','talentgroup','program','kind','student','registration','psisgender','topic','exploretype','placetype','minpop','sort'].includes(k)));
  return {province:PT.some(x=>x[0]===province)?province:'',geo:{id:validGeographyId(id)?id:CANADA.id,type,name:q.get('name')??(province?PT.find(x=>x[0]===province)?.[2]:CANADA.name),province},
    view:Object.hasOwn(VIEWS,q.get('view'))?q.get('view'):'community',benchmark:q.get('benchmark')==='PT'?'PT':'CA',options};
}
function urlFor(view=S.view) {
  const q=new URLSearchParams({view,type:S.geo.type,geo:S.geo.id,...(S.province?{province:S.province}:{}),benchmark:S.benchmark,...S.options});
  return `${location.pathname}?${q}`;
}
function save(){history.replaceState(null,'',urlFor());}
function update(k,v){S.options={...S.options,[k]:v};if(['mapdim','marketmode'].includes(k))delete S.options.mapbins;if(k==='talentgroup')delete S.options.program;save();render();}
function parentProvince(g){const members=String(g.province??(g.type==='CSD'||g.type==='CD'?g.id.slice(9,11):S.province)).split('_');return members.includes(S.province)?S.province:members[0];}
function choose(g){S.geo={...g,province:parentProvince(g)};S.province=S.geo.province;S.view='community';S.options={};save();sync();loadPlaces(g.type);render();}
function sync(){
  $('province').value=S.province;$('geo-level').value=S.geo.type;$('benchmark').value=S.benchmark;
  $('place-search').disabled=S.geo.type==='PR';$('place').disabled=S.geo.type==='PR';
  if(S.geo.type==='PR'){$('place').innerHTML='<option>Whole province / territory, or Canada</option>';}else fillPlaces();
  $('navigation').innerHTML=Object.entries(VIEWS).map(([k,[title]],i)=>`<a href="${esc(urlFor(k))}" data-view="${k}" ${k===S.view?'aria-current="page" class="active"':''}><span class="num">${String(i+1).padStart(2,'0')}</span>${esc(title)}</a>`).join('');
}
function fillPlaces(){
  const term=$('place-search').value.toLowerCase(),matching=places.filter(g=>matchesProvince(g,S.province)&&g.name.toLowerCase().includes(term));
  $('place').replaceChildren();
  const prompt=new Option(matching.length?`Choose a place (${matching.length})`:'No matching places','');$('place').append(prompt);
  for(const g of matching)$('place').append(new Option(g.description??g.name,g.id));
  $('place').value=matching.some(g=>g.id===S.geo.id)?S.geo.id:'';
}
async function loadPlaces(type,autoselect=false){
  const version=++placeVersion;$('place').disabled=true;$('global-status').textContent='Loading official geographies…';
  try {
    const data=await geographies(type);if(version!==placeVersion)return;places=data;fillPlaces();$('place').disabled=false;$('global-status').textContent='';
    if(autoselect){$('global-status').textContent='Choose a place to load its profile.';}
  }catch(e){if(version===placeVersion){$('global-status').textContent=e.message;$('place').disabled=false;}}
}
async function render(){
  const version=++renderVersion;cleanups.forEach(f=>f());cleanups=[];
  $('content').setAttribute('aria-busy','true');
  document.querySelectorAll('.js-plotly-plot').forEach(el=>window.Plotly?.purge(el));
  const root=document.createElement('div');$('content').replaceChildren(root);loading(root);
  const snapshot={...S,geo:{...S.geo},options:{...S.options}};
  $('region-name').textContent=snapshot.geo.name??'Selected geography';$('geo-type').textContent=snapshot.geo.id===CANADA.id?'Country':TYPES[snapshot.geo.type];
  $('region-description').textContent='Explore the people, industries and connections that shape a place.';
  document.title=`${snapshot.geo.name??'Canada'} · ${VIEWS[snapshot.view][0]} · Canada Regional Profiles`;
  try {
    if(snapshot.view==='sources'){root.replaceChildren();await sources(root);return;}
    const benchmark=snapshot.benchmark==='PT'&&snapshot.province?{id:`2021A0002${snapshot.province}`,type:'PR'}:CANADA;
    const [p,b]=await Promise.all([census(snapshot.geo),census(benchmark)]);
    if(version!==renderVersion)return;
    S.geo.name=p.area.name;snapshot.geo.name=p.area.name;
    $('region-name').textContent=p.area.name;document.title=`${p.area.name} · ${VIEWS[snapshot.view][0]} · Canada Regional Profiles`;
    $('retrieved').textContent=`Retrieved ${new Date().toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'})}`;
    root.replaceChildren();
    await VIEWS[snapshot.view][1](root,{...snapshot,p,b,provinceName:PT.find(x=>x[0]===snapshot.province)?.[2],update,choose,persist:(k,v)=>{S.options={...S.options,[k]:v};save();},
      cleanup:fn=>{if(version===renderVersion)cleanups.push(fn);else fn();}});
  }catch(e){if(version===renderVersion)failure(root,e,()=>{clearCache();clearMapCache();render();});}
  finally{if(version===renderVersion)$('content').setAttribute('aria-busy','false');}
}
for(const [code,abbr,name] of PT)$('province').append(new Option(`${name} (${abbr})`,code));
$('navigation').onclick=e=>{const a=e.target.closest('a[data-view]');if(!a)return;e.preventDefault();S.view=a.dataset.view;save();sync();render();};
$('province').onchange=()=>{S.province=$('province').value;S.geo=S.province?{id:`2021A0002${S.province}`,name:PT.find(x=>x[0]===S.province)[2],type:'PR',province:S.province}:{...CANADA};S.options={};placeVersion++;save();sync();render();};
$('geo-level').onchange=()=>{const type=$('geo-level').value;$('place-search').value='';
  if(type==='PR'){$('province').onchange();return;}
  // Retain the current profile until a concrete new geography is selected.
  $('place-search').disabled=false;loadPlaces(type,true);
};
$('place-search').oninput=fillPlaces;
$('place').onchange=()=>{const geo=places.find(g=>g.id===$('place').value);if(geo){S.geo={...geo,province:parentProvince(geo)};S.province=S.geo.province;S.options={};$('global-status').textContent='';save();sync();render();}};
$('benchmark').onchange=()=>{S.benchmark=$('benchmark').value;save();render();};
$('refresh').onclick=()=>{clearCache();clearMapCache();if(S.geo.type!=='PR')loadPlaces(S.geo.type);render();};
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('share').textContent='Copied ✓';setTimeout(()=>$('share').textContent='Copy link',1800);}catch{$('global-status').textContent='Copy the URL from your browser address bar to share this selection.';}};
window.addEventListener('popstate',()=>{S=readURL();sync();if(S.geo.type!=='PR')loadPlaces(S.geo.type);render();});
S=readURL();sync();if(S.geo.type!=='PR')loadPlaces(S.geo.type);render();
