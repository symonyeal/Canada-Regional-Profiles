import {census,geographies,request,decodeSDMX,CENSUS} from './api.js';
import {matchesProvince,esc,fmt,Profile} from './model.js';
import {heading,controls,notice,card,table,download,sourceLink,loading} from './charts.js';
export async function explorer(root,ctx) {
  const o=ctx.options,type=o.exploretype??'CSD';
  heading(root,'Community explorer','Find and compare communities using official geography and published Census indicators. Open a community to carry it into every profile tool.');
  controls(root,[{key:'exploretype',label:'Compare places',value:type,options:[['CSD','Cities / municipalities'],['CD','Census divisions'],['CMACA','Metro / agglomeration'],['ER','Economic regions'],['POPCNTR','Population centres']]},
    {key:'minpop',label:'Minimum population',value:o.minpop??'0',options:[['0','All sizes'],['1000','1,000'],['10000','10,000'],['100000','100,000']]},
    {key:'sort',label:'Sort',value:o.sort??'population',options:[['population','Population · largest first'],['name','Name · A–Z']]}],ctx.update);
  notice(root,'A municipality and a metropolitan area are different populations. Selecting population centres identifies concentrated settlements; it does not classify entire municipalities as rural or urban. Census 2021 boundaries are used throughout.');
  let places=(await geographies(type)).filter(g=>matchesProvince(g,ctx.province)&&g.population>=Number(o.minpop??0));
  if(!root.isConnected)return;
  if(type==='CSD'){
    const types=[...new Set(places.map(g=>g.municipalType).filter(Boolean))].sort();
    controls(root,[{key:'placetype',label:'Municipal type',value:o.placetype??'',options:[['','All municipal types'],...types.map(t=>[t,t])]}],ctx.update);
    if(o.placetype)places=places.filter(g=>g.municipalType===o.placetype);
  }
  places.sort(o.sort==='name'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>(b.population??-1)-(a.population??-1));
  const node=card(root,{title:'Explore communities',subtitle:ctx.provinceName??'All Canada'}),body=document.createElement('div');body.className='explorer';node.append(body);
  const search=document.createElement('input');search.type='search';search.placeholder='Search community name…';search.setAttribute('aria-label','Search communities');body.append(search);
  const result=document.createElement('div');body.append(result);let page=0,version=0;
  async function draw(){
    const v=++version,matched=places.filter(g=>g.name.toLowerCase().includes(search.value.toLowerCase())),slice=matched.slice(page*25,(page+1)*25);
    result.innerHTML=`<p class="footnote">${fmt(matched.length)} places · 25 per page · Population from the live 2021 Census Profile API</p>`;
    const pagination=document.createElement('div');pagination.className='pagination';
    for(const [text,disabled,delta] of [['← Previous',page===0,-1],['Next →',(page+1)*25>=matched.length,1]]){
      const b=document.createElement('button');b.textContent=text;b.className='button subtle';b.disabled=disabled;b.onclick=()=>{page+=delta;draw();};pagination.append(b);
    }result.append(pagination);
    const area=document.createElement('div');result.append(area);loading(area,'Querying indicators for the communities on this page…');
    if(!slice.length){area.innerHTML='<p>No communities match these filters.</p>';return;}
    try {
      const ids=slice.map(g=>g.id).join('+'),chars='1+3+40+2228+2230+226';
      const url=`${CENSUS}/data/DF_${type}/A5.${ids}.1.${chars}.1`;
      const rows=decodeSDMX(await request(url,undefined,'application/vnd.sdmx.data+json;version=1.0'));
      if(v!==version||!root.isConnected)return;
      const byArea=new Map(slice.map(g=>[g.id,new Profile(rows.filter(r=>r.area.id===g.id))]));
      const data=slice.map(g=>{const p=byArea.get(g.id);return [g.name,g.municipalType||type,p.value('1'),p.value('3'),p.value('40'),p.value('2228'),p.value('2230')];});
      area.innerHTML=table(['Community','Type','Population','Growth 2016–21 (%)','Median age','Participation (%)','Unemployment (%)'],data.map(r=>r.map((v,i)=>i<2?v:fmt(v,i>2?'ratio':''))));
      area.querySelectorAll('tbody tr').forEach((tr,i)=>{const cell=tr.firstChild;cell.textContent='';const button=document.createElement('button');button.className='row-link';button.textContent=slice[i].name;button.onclick=()=>ctx.choose(slice[i]);cell.append(button);});
      const b=document.createElement('button');b.className='download';b.textContent='Download this comparison ↓';b.onclick=()=>download('community-comparison.csv',[[url],['Community','Type','Population 2021','Population change 2016–2021 (%)','Median age','Participation (%)','Unemployment (%)'],...data]);area.append(b);
    }catch(e){if(v===version)area.innerHTML=`<p class="error">${esc(e.message)}</p>`;}
  }
  search.oninput=()=>{page=0;draw();};await draw();
  const foot=document.createElement('p');foot.className='source';foot.innerHTML=sourceLink(`${CENSUS}/data/DF_${type}/A5..1.1.1`,'Statistics Canada · Census Profile 2021');node.append(foot);
}
