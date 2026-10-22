import {request} from './api.js';
import {PT} from './model.js';
import {controls,notice,chart,sourceLink} from './charts.js';
export async function climate(root,ctx) {
  const pr=ctx.province||ctx.geo.province||(['CSD','CD','PR'].includes(ctx.geo.type)?ctx.geo.id.slice(9,11):'');
  const abbr=PT.find(x=>x[0]===pr)?.[1];
  if(!abbr){notice(root,'Choose a province or territory to select a weather station. A single station is not a Canadian climate average.');return;}
  const base='https://api.weather.gc.ca/collections/climate-normals';
  async function items(params){
    const features=[];let url=`${base}/items?${new URLSearchParams({f:'json',limit:'10000',PROVINCE_CODE:abbr,...params})}`;
    while(url){const page=await request(url);features.push(...(page.features??[]));url=page.links?.find(l=>l.rel==='next')?.href;}
    return {features};
  }
  const [meta,mean]=await Promise.all([request(`${base}?f=json`),items({NORMAL_ID:'1'})]);
  if(!root.isConnected)return;
  const stations=new Map();for(const f of mean.features??[]){const s=f.properties;if(s.MONTH>=1&&s.MONTH<=12)stations.set(String(s.STN_ID),s.STATION_NAME);}
  const ordered=[...stations].sort((a,b)=>a[1].localeCompare(b[1])),id=stations.has(ctx.options.station)?ctx.options.station:ordered[0]?.[0];
  if(!id){notice(root,'No station normals were returned for this province or territory.',true);return;}
  controls(root,[{key:'station',label:'Climate station',value:id,options:ordered}],ctx.update);
  const period=meta.extent?.temporal?.interval?.[0],periodName=period?`${period[0].slice(0,4)}–${period[1].slice(0,4)}`:meta.title;
  notice(root,`Station: ${stations.get(id)}. Normals period: ${periodName}, as described by the live ECCC collection. This station is selected explicitly and is not an average for ${ctx.geo.name}.`);
  const elements={mean:1,max:5,min:8,rain:52,snow:54,precip:56},values={};
  await Promise.all(Object.entries(elements).map(async([name,normal])=>{
    const d=name==='mean'?mean:await items({STN_ID:id,NORMAL_ID:String(normal)});
    const selected=(d.features??[]).filter(f=>String(f.properties.STN_ID)===id);values[name]=Array.from({length:12},(_,i)=>selected.find(f=>Number(f.properties.MONTH)===i+1)?.properties.VALUE??null);
  }));
  if(!root.isConnected)return;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const source=sourceLink(`${base}?f=json`,`ECCC · ${meta.title} · ${stations.get(id)}`);
  chart(root,{title:'Monthly temperature normals',subtitle:`${stations.get(id)} · ${periodName} · °C`,source,wide:true,
    headers:['Month','Daily mean (°C)','Daily maximum (°C)','Daily minimum (°C)'],rows:months.map((m,i)=>[m,values.mean[i],values.max[i],values.min[i]]),
    data:[['mean','Daily mean','#7d622e'],['max','Daily maximum','#b65d42'],['min','Daily minimum','#527b9e']].map(([key,name,color])=>({type:'scatter',mode:'lines+markers',name,x:months,y:values[key],line:{color},connectgaps:false})),
    layout:{height:320,showlegend:true,legend:{orientation:'h'},yaxis:{title:{text:'Temperature (°C)'}}}});
  chart(root,{title:'Monthly precipitation normals',subtitle:`${stations.get(id)} · ${periodName} · rainfall/precipitation in mm; snowfall in cm`,source,wide:true,
    headers:['Month','Rainfall (mm)','Precipitation (mm)','Snowfall (cm)'],rows:months.map((m,i)=>[m,values.rain[i],values.precip[i],values.snow[i]]),
    data:[{type:'bar',name:'Rainfall (mm)',x:months,y:values.rain,marker:{color:'#7d622e'}},{type:'scatter',mode:'lines+markers',name:'Precipitation (mm)',x:months,y:values.precip,line:{color:'#473729'}},
      {type:'scatter',mode:'lines+markers',name:'Snowfall (cm)',x:months,y:values.snow,yaxis:'y2',line:{color:'#527b9e'}}],
    layout:{height:330,showlegend:true,legend:{orientation:'h'},yaxis:{title:{text:'Millimetres'}},yaxis2:{title:{text:'Snowfall (cm)'},overlaying:'y',side:'right'},margin:{r:60,l:50,t:20,b:60}}});
}
