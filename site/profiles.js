import {esc,fmt} from './model.js';
import {populationSeries,labourRates,annualSeries} from './api.js';
import {catchment} from './catchment.js';
import {climate} from './climate.js';
import {heading,tiles,distribution,chart,bars,controls,notice,sourceLink,card,table,download,COLORS} from './charts.js';
export const genderOptions=[['1','All genders'],['2','Men+'],['3','Women+']];
export function censusSource(ctx) {
  return `${sourceLink(ctx.p.url,'Statistics Canada · Census Profile 2021')} · ${esc(ctx.geo.name)}; benchmark: ${esc(ctx.b.area.name)}.
    Income: 2020 dollars. Random rounding and suppression apply. Retrieved ${esc(new Date().toLocaleDateString('en-CA'))}.`;
}
export function grid(root) {const el=document.createElement('div');el.className='grid';root.append(el);return el;}
const metric=(p,id,label,unit='',b)=>({label,value:p.value(id),unit,benchmark:b?.value(id),note:'2021 Census'});
export async function community(root,ctx) {
  const {p,b}=ctx,source=censusSource(ctx);
  heading(root,'Community profile','Population, households, homes and languages, at the geography you selected.');
  const dashboard=ctx.options.dashboard??'economic';
  controls(root,[{key:'dashboard',label:'Dashboard',value:dashboard,options:[['economic','Economic'],['resident','Resident'],['household','Household'],['dwelling','Dwelling'],['workforce','Workforce'],['livability','Livability'],['overview','All demographic charts']]}],ctx.update);
  if(dashboard!=='overview'){await communityDashboard(root,ctx,dashboard);return;}
  tiles(root,[metric(p,'1','Residents','',b),metric(p,'3','Population change, 2016–2021','%',b),
    metric(p,'40','Median age','years',b),metric(p,'5','Occupied private dwellings','',b)]);
  const g=grid(root);
  const age=p.children('9').concat(p.children('13'),p.children('24').filter(x=>x.id!=='29'),p.children('29'));
  const men=age.map(c=>p.value(c.id,'2')),women=age.map(c=>p.value(c.id,'3'));
  chart(g,{title:'Population by age and gender',subtitle:'Published Men+ and Women+ categories; counts, not percentages.',
    source,headers:['Age','Men+','Women+'],rows:age.map((c,i)=>[c.name,men[i],women[i]]),
    data:[{type:'bar',orientation:'h',name:'Men+',y:age.map(c=>c.name),x:men.map(v=>v==null?null:-v),
      customdata:men,marker:{color:COLORS[0]},hovertemplate:'%{y}<br>Men+: %{customdata:,}<extra></extra>'},
    {type:'bar',orientation:'h',name:'Women+',y:age.map(c=>c.name),x:women,marker:{color:COLORS[1]},hovertemplate:'%{y}<br>Women+: %{x:,}<extra></extra>'}],
    layout:{height:560,barmode:'relative',showlegend:true,legend:{orientation:'h'},xaxis:{title:{text:'People (Men+ left · Women+ right)'}},margin:{l:75,r:20,t:20,b:65}}});
  distribution(g,p,b,'41','Housing types',{source});
  distribution(g,p,b,'50','Household size',{source});
  distribution(g,p,b,'1400','Housing tenure',{source});
  distribution(g,p,b,'369','Knowledge of official languages',{source});
  distribution(g,p,b,'1513','Immigration status',{source});
  distribution(g,p,b,'1388','Indigenous identity',{source});
  distribution(g,p,b,'100','Household composition',{source});
  const trend=card(g,{title:'Quarterly population estimates',subtitle:'Canada and provinces/territories only. Census counts above use a different reference date.',wide:true});
  if(ctx.geo.type==='PR') {
    try {const series=await populationSeries(ctx.geo);if(!root.isConnected)return;
      const target=document.createElement('div');trend.append(target);
      chart(target,{title:'Population over time',subtitle:ctx.geo.name,source:sourceLink('https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901','Statistics Canada · 17-10-0009-01'),
        headers:['Quarter','Residents'],rows:series.map(s=>[s.refPer,s.value]),
        data:[{type:'scatter',mode:'lines+markers',x:series.map(s=>s.refPer),y:series.map(s=>s.value),line:{color:COLORS[0],width:3},fill:'tozeroy',fillcolor:'#e8f1ed'}],layout:{yaxis:{rangemode:'normal'}}});
    } catch(e) {notice(trend,e.message,true);}
  } else notice(trend,'Quarterly estimates are not published for this local geography in table 17-10-0009. The local Census population is shown above.');
}
export async function workforce(root,ctx) {
  const {p,b,options:o}=ctx,gid=o.gender??'1',source=censusSource(ctx);
  heading(root,'Workforce advantages','Labour-market participation, occupations, education and commuting. Census industry counts describe the resident labour force, including unemployed people.');
  controls(root,[{key:'workview',label:'View',value:o.workview??'indicators',options:[['indicators','Indicators · reference charts'],['detailed','Detailed indicators'],['catchment','Catchment']]}],ctx.update);
  if(o.workview==='catchment'){await catchment(root,ctx,true);return;}
  controls(root,[{key:'gender',label:'Gender',value:gid,options:genderOptions}],ctx.update);
  tiles(root,[{label:'Participation rate',value:p.value('2228',gid),unit:'%',benchmark:b.value('2228',gid),note:'Population aged 15+ · 2021'},
    {label:'Employment rate',value:p.value('2229',gid),unit:'%',benchmark:b.value('2229',gid),note:'Population aged 15+ · 2021'},
    {label:'Unemployment rate',value:p.value('2230',gid),unit:'%',benchmark:b.value('2230',gid),note:'Labour force aged 15+ · 2021'},
    {label:'Resident labour force',value:p.value('2224',gid),note:'People aged 15+ · 2021'}]);
  const g=grid(root),opts={source,gender:gid};
  referenceIndicators(g,ctx,gid);
  if((o.workview??'indicators')==='indicators')return;
  distribution(g,p,b,'2248','Occupations · NOC 2021',{...opts,wide:true});
  distribution(g,p,b,'2261','Industries of the resident labour force',{...opts,wide:true});
  distribution(g,p,b,'1998','Highest education · age 15+ ',opts);
  distribution(g,p,b,'2014','Highest education · age 25–64',opts);
  distribution(g,p,b,'2239','Employee and self-employed workers',opts);
  distribution(g,p,b,'2240','Permanent and temporary employees',opts);
  distribution(g,p,b,'2593','Place of work',opts);
  distribution(g,p,b,'2603','Mode of commuting',opts);
  distribution(g,p,b,'2611','Commuting duration',opts);
  distribution(g,p,b,'2598','Commuting destination',opts);
  distribution(g,p,b,'2233','Full-year and other work activity',opts);
  distribution(g,p,b,'1969','Five-year mobility',opts);
  const live=card(g,{title:'Recent Labour Force Survey rates',subtitle:'A separate, more recent series. Census indicators above retain their 2021 reference period.',wide:true});
  if(ctx.geo.type==='PR') {
    try {
      const data=await labourRates(ctx.geo,gid,o.workage??'1',o.seasonal);if(!root.isConnected)return;
      controls(live,[{key:'workage',label:'LFS age group',value:o.workage??'1',options:data.ages.map(a=>[String(a.memberId),a.memberNameEn])},
        {key:'seasonal',label:'LFS adjustment',value:data.adjusted,options:[['1','Seasonally adjusted'],['2','Unadjusted']]}],ctx.update);
      const years=[...new Set(data.series.flatMap(s=>s.points.map(p=>p.refPer)))].sort();
      chart(live,{title:'Monthly labour-market rates',subtitle:`${ctx.geo.name} · ${data.territory?'three-month moving average':'monthly'} · ${data.adjusted==='1'?'seasonally adjusted':'unadjusted'}`,
        source:sourceLink(`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${data.pid}01`,data.metadata.cubeTitleEn),unit:'%',
        headers:['Period',...data.series.map(s=>s.name)],rows:years.map(y=>[y,...data.series.map(s=>s.points.find(p=>p.refPer===y)?.value??null)]),
        data:data.series.map((s,i)=>({type:'scatter',mode:'lines',name:s.name,x:years,y:years.map(y=>s.points.find(p=>p.refPer===y)?.value??null),line:{color:COLORS[i],width:2.5},connectgaps:false})),
        layout:{showlegend:true,legend:{orientation:'h',y:1.15},yaxis:{title:{text:'Rate (%)'}}}});
    } catch(e){notice(live,e.message,true);}
  } else notice(live,'This live Labour Force Survey adapter publishes Canada and provinces/territories. The local Census rates above are the selected area’s published values.');
}
export async function market(root,ctx) {
  controls(root,[{key:'marketview',label:'View',value:ctx.options.marketview??'map',options:[['map','Target-market map'],['profile','Income and housing profile']]}],ctx.update);
  if((ctx.options.marketview??'map')==='map'){await catchment(root,ctx);return;}
  const {p,b}=ctx,source=censusSource(ctx),g=(()=>{
    heading(root,'Market advantages','Household purchasing power, housing costs and the composition of the local consumer market. Income refers to 2020; housing and population refer to the 2021 Census.');
    const id=re=>p.find(re)?.id;
    tiles(root,[metric(p,id(/^Median total income of household.*2020/),'Median household income','$',b),
      metric(p,id(/^Median after-tax income of household.*2020/),'Median after-tax household income','$',b),
      metric(p,'56','Average household size','ratio',b),metric(p,'5','Occupied private dwellings','',b)]);return grid(root);
  })();
  distribution(g,p,b,'246','Household total income',{source,wide:true});
  distribution(g,p,b,'267','Household after-tax income',{source,wide:true});
  distribution(g,p,b,'1451','Housing cost burden',{source});
  distribution(g,p,b,'1423','Housing suitability',{source});
  distribution(g,p,b,'1407','Bedrooms per dwelling',{source});
  distribution(g,p,b,'1435','Dwelling condition',{source});
  distribution(g,p,b,'1426','Period of construction',{source});
  distribution(g,p,b,'1442','Age of household maintainer',{source});
  distribution(g,p,b,'1960','One-year mobility',{source});
  distribution(g,p,b,'1508','Citizenship',{source});
  const ids=[...p.chars.values()].filter(c=>/^Median monthly shelter costs|^Median value of dwellings/.test(c.name));
  bars(g,{title:'Housing costs and values',subtitle:'Published medians; owner and tenant universes differ.',source,unit:'$',wide:true,comparison:true,
    items:ids.map(c=>({name:c.name,value:p.value(c.id),benchmark:b.value(c.id)}))});
}
export function referenceIndicators(root,ctx,gender='1') {
  const p=ctx.p,source=censusSource(ctx),get=id=>p.value(id,gender),total=get('2014'),sum=(a,b)=>a==null||b==null?null:a+b;
  const values=[['Postsecondary certificate, diploma or degree',get('2017')],['Bachelor’s degree or higher',get('2024')],
    ['Master’s degree or higher',sum(get('2028'),get('2029'))],['Other above bachelor’s degree',sum(get('2026'),get('2027'))]];
  for(const [name,value] of values){const share=total>0&&value!=null?100*value/total:null;
    chart(root,{title:name,subtitle:`Population aged 25–64 · Census 2021 · ${genderOptions.find(x=>x[0]===gender)?.[1]}`,source,unit:'%',headers:['Credential','Share (%)'],rows:[[name,share]],
      data:[{type:'pie',hole:.72,values:share==null?[]:[share,100-share],labels:[name,'Other'],marker:{colors:['#473729','#e8e7e4']},textinfo:'none',sort:false,direction:'clockwise'}],
      layout:{height:250,margin:{t:15,b:15,l:15,r:15},annotations:[{text:share==null?'Not available':fmt(share,'%'),showarrow:false,font:{size:28,color:'#473729'}}]}});
  }
  const sectors=p.children('2261'),sectorColors=['#3A9E52','#696969','#BFB028','#BE8417','#8769FF','#AB2F62','#FE5F4E','#63C7B2','#FFEC36','#13DABC','#0D68BF','#BEC0C3','#BE473A','#0DA38C','#FEB11F','#128bff','#E54084','#4ED36E','#564EFE','#7d622e'];
  chart(root,{title:'Residents’ industry of employment',subtitle:'Resident labour force aged 15+, including unemployed people; Census NAICS sectors.',source,wide:true,
    headers:['Industry','Resident labour force'],rows:sectors.map(c=>[c.name,get(c.id)]),
    data:[{type:'treemap',labels:sectors.map(c=>c.name.replace(/^[\d-]+ /,'')),parents:sectors.map(()=>''),values:sectors.map(c=>get(c.id)),marker:{colors:sectorColors},textinfo:'label+value'}],
    layout:{height:420,margin:{t:15,b:15,l:15,r:15}}});
  const occupations=p.children('2248').map(c=>({name:c.name,value:get(c.id)})).filter(c=>c.value!=null).sort((a,b)=>b.value-a.value).slice(0,5);
  bars(root,{title:'Top occupations',subtitle:'Resident labour force aged 15+ · NOC 2021 broad categories',items:occupations,source,wide:true});
}
async function communityDashboard(root,ctx,dashboard) {
  const {p,b}=ctx,source=censusSource(ctx);
  if(dashboard==='workforce'){referenceIndicators(grid(root),ctx);return;}
  if(dashboard==='household'){
    tiles(root,[metric(p,'229','Median household income · 2020','$',b),metric(p,'56','Average household size','ratio',b),metric(p,'50','Private households','',b)]);
    const g=grid(root);distribution(g,p,b,'246','Household income distribution',{source});distribution(g,p,b,'50','Household size distribution',{source});return;
  }
  if(dashboard==='dwelling'){
    tiles(root,[metric(p,'4','Private dwellings','',b),metric(p,'5','Occupied private dwellings','',b),{label:'Home ownership',value:p.share('1401','1400'),unit:'%',note:'Private households · 2021'}]);
    const g=grid(root);distribution(g,p,b,'1400','Home ownership and tenure',{source});distribution(g,p,b,'1426','Construction period',{source});distribution(g,p,b,'41','Dwelling type',{source,wide:true});return;
  }
  if(dashboard==='livability'){
    tiles(root,[metric(p,'1473','Average monthly owner shelter costs','$',b),metric(p,'1481','Average monthly renter shelter costs','$',b)]);
    const g=grid(root);distribution(g,p,b,'2603','Commuting mode',{source});distribution(g,p,b,'2611','Commuting time',{source});
    await climate(g,ctx);return;
  }
  if(dashboard==='resident'){
    tiles(root,[metric(p,'1','Residents · 2021','',b),metric(p,'113','Median individual income · 2020','$',b),metric(p,'40','Median age','years',b)]);
    const g=grid(root);distribution(g,p,b,'8','Age distribution',{source});distribution(g,p,b,'150','Individual income distribution',{source,wide:true});return;
  }
  tiles(root,[metric(p,'2228','Participation rate · Census 2021','%',b),metric(p,'1','Residents · Census 2021','',b),metric(p,'229','Median household income · 2020','$',b),metric(p,'2230','Unemployment rate · Census 2021','%',b)]);
  const g=grid(root);
  const series=ctx.geo.type==='PR'?[['14100464',{'Labour force characteristics':/^Participation rate$/},'Annual labour force participation','%'],
    ['14100464',{'Labour force characteristics':/^Unemployment rate$/},'Annual unemployment rate','%'],
    ['14100464',{'Labour force characteristics':/^Employment$/},'Annual employment',''],
    ['17100005',{'Gender':/^Total - gender$/,'Age group':/^All ages$/},'Population on July 1',''],
    ['11100009',{'Family characteristics':/^Median total income, all families$/},'Median total income of census families','$']]:
    ctx.geo.type==='CSD'?[['17100155',{},'Annual municipal population estimates','']]:[];
  await Promise.all(series.map(async([pid,selector,title,unit])=>{
    const node=document.createElement('div');g.append(node);
    try{const d=await annualSeries(ctx.geo,pid,selector);if(!root.isConnected)return;
      const values=d.values,latest=values.at(-1);chart(node,{title,subtitle:`${ctx.geo.name} · latest ${latest?.refPer.slice(0,4)??'unavailable'}: ${fmt(latest?.value,unit)}`,
        unit,source:sourceLink(`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${pid}01`,d.metadata.cubeTitleEn),headers:['Year',title],rows:values.map(v=>[v.refPer.slice(0,4),v.value]),
        data:[{type:'scatter',mode:'lines+markers',x:values.map(v=>v.refPer.slice(0,4)),y:values.map(v=>v.value),line:{color:'#7d622e',width:3},connectgaps:false}],layout:{height:285}});
    }catch(e){notice(node,`${title}: ${e.message}`,true);}
  }));
  distribution(g,p,b,'246','Household income distribution · 2020',{source,wide:true});referenceIndicators(g,ctx);
}
export async function profileBrowser(root,ctx) {
  const {p,options:o}=ctx,source=censusSource(ctx);
  heading(root,'All profile characteristics','Search every published Census Profile characteristic, including its official definition, population group and source note.');
  const topics=[...new Set([...p.chars.values()].map(c=>c.topic).filter(Boolean))].sort();
  controls(root,[{key:'topic',label:'Topic',value:o.topic??'',options:[['','All topics'],...topics.map(t=>[t,t])]},
    {key:'gender',label:'Gender',value:o.gender??'1',options:genderOptions}],ctx.update);
  const wrapper=card(root,{title:'Published characteristics'}),body=document.createElement('div');body.className='explorer';wrapper.append(body);
  const input=document.createElement('input');input.type='search';input.placeholder='Search population, income, occupation, language…';input.setAttribute('aria-label','Search profile characteristics');body.append(input);
  const result=document.createElement('div');body.append(result);
  function draw(){
    const rows=[...p.chars.values()].filter(c=>(!o.topic||c.topic===o.topic)&&c.name.toLowerCase().includes(input.value.toLowerCase())).sort((a,b)=>a.order-b.order);
    result.innerHTML=`<p class="footnote">${fmt(rows.length)} characteristics. Counts, dollars and rates retain their published units in the characteristic name.</p>`+
      table(['Characteristic / universe','Selected region','Benchmark'],rows.map(c=>[c.name,fmt(p.value(c.id,o.gender??'1')),fmt(ctx.b.value(c.id,o.gender??'1'))]));
    const button=document.createElement('button');button.className='download';button.textContent='Download selected characteristics ↓';button.onclick=()=>download('census-profile.csv',[
      ['Geography',ctx.geo.name],['Benchmark',ctx.b.area.name],['Period','2021; income 2020'],['Source',p.url],
      ['ID','Characteristic','Selected region','Benchmark','Topic','Source note'],...rows.map(c=>[c.id,c.name,p.value(c.id,o.gender??'1'),ctx.b.value(c.id,o.gender??'1'),c.topic,c.notes])]);result.append(button);
  }
  input.oninput=draw;draw();const f=document.createElement('p');f.className='source';f.innerHTML=source;wrapper.append(f);
}
