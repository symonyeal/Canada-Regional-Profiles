import {psis,request} from './api.js';
import {heading,controls,bars,chart,notice,sourceLink,COLORS,distribution} from './charts.js';
import {grid,censusSource} from './profiles.js';
import {campusMap} from './campus.js';
import {completeSum} from './model.js';

export async function talent(root,ctx) {
  const o=ctx.options;
  heading(root,'Talent pipeline','Public university and college enrolments by institution and field of study. Local Census education provides a separate view of qualifications held by residents.', 'PSIS · live API');
  notice(root,'PSIS enrolments count registrations, not unique people, graduates or forecast workers. Institution locations and provincial totals describe the school, not a city’s residents. Counts are rounded; suppressed fields stay missing.');
  const [data,rules]=await Promise.all([psis(ctx.geo,{institution:o.institution??'',kind:Number(o.kind??1),status:Number(o.student??1),registration:Number(o.registration??1),gender:Number(o.psisgender??1)}),request('classification.json')]);
  if(!root.isConnected)return;
  controls(root,[{key:'institution',label:'Institution / scope',value:o.institution??'',options:[['',`${data.region} · all institutions`],...data.institutions.map(i=>[String(i.memberId),i.memberNameEn])]},
    {key:'talentgroup',label:'Field grouping',value:o.talentgroup??'primary',options:[['primary','CIP primary groupings · reference'],['detailed','CIP two-digit series']]},
    {key:'kind',label:'Institution type',value:o.kind??'1',options:[['1','All institutions'],['2','University'],['3','College']]},
    {key:'student',label:'Student status',value:o.student??'1',options:[['1','All students'],['2','Canadian students'],['3','International students']]},
    {key:'registration',label:'Registration',value:o.registration??'1',options:[['1','All registrations'],['2','Full time'],['3','Part time']]},
    {key:'psisgender',label:'Gender',value:o.psisgender??'1',options:[['1','All genders'],['2','Man'],['3','Woman']]}],ctx.update);
  if(ctx.geo.type!=='PR')notice(root,`Institution scope: ${data.geoName}. The selected local geography remains ${ctx.geo.name}; PSIS does not publish a municipal total here. Resident qualifications below are local Census data.`);
  if((o.talentgroup??'primary')==='primary') {
    const grouped=new Map();for(const f of data.fields){if(f.code==='30.')continue;const rule=rules.cip?.[f.code];if(!rule)continue;
      if(!grouped.has(rule.group))grouped.set(rule.group,{id:rule.group,name:rule.name,parts:[]});grouped.get(rule.group).parts.push(f);}
    data.fields=[...grouped.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(group=>{
      const years=[...new Set(group.parts.flatMap(f=>f.series.map(s=>s.refPer)))];
      return {...group,series:years.map(y=>{const parts=group.parts.map(f=>f.series.find(s=>s.refPer===y)),present=parts.filter(s=>s?.value!=null);
        return {...present[0],refPer:y,value:completeSum(parts.map(s=>s?.value))};})};});
    notice(root,'Primary groupings sum the published CIP components, splitting interdisciplinary series 30 by its subseries. A group is unavailable when any component is missing or suppressed. Rounded components need not sum to the independently published total.');
  }else data.fields=data.fields.filter(f=>/^\d{2}\.$/.test(f.code));
  if(o.program&&!data.fields.some(f=>String(f.id)===o.program))o.program='';
  const years=[...new Set([...data.totalSeries,...data.fields.flatMap(f=>f.series)].map(s=>s.refPer))].sort(),latest=years.at(-1);
  const schoolYears=new Map([...data.totalSeries,...data.fields.flatMap(f=>f.series)].map(s=>[s.refPer,s.refPer2?`${s.refPer.slice(0,4)}/${s.refPer2.slice(2,4)}`:s.refPer.slice(0,4)]));
  const source=`${sourceLink('https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3710027701','Statistics Canada · PSIS 37-10-0277-01')} · ${data.geoName} · ${schoolYears.get(latest)??'No period published'}.`;
  const items=data.fields.map(f=>({name:f.name,value:f.series.find(s=>s.refPer===latest)?.value??null}));
  controls(root,[{key:'program',label:'Map enrolment program',value:o.program??'',options:[['','All programs'],...data.fields.map(f=>[String(f.id),f.name])]}],ctx.update);
  notice(root,`Published total enrolments, ${schoolYears.get(latest)??latest}: ${data.totalSeries.find(s=>s.refPer===latest)?.value?.toLocaleString('en-CA')??'not available'}. ${data.geoName}.`);
  const g=grid(root);
  bars(g,{title:'Enrolments by field of study',subtitle:`${data.geoName} · latest published period ${schoolYears.get(latest)??'unavailable'}`,items,source,sort:true});
  const campuses=campusMap(g,ctx,data,latest).catch(e=>{if(root.isConnected)notice(g,e.message,true);});
  const fields=data.fields.filter(f=>f.series.some(s=>s.value>0));
  chart(g,{title:'Enrolments over time by field',subtitle:'Select a field in the legend to isolate it. Missing observations are gaps.',source,wide:true,
    headers:['School year',...fields.map(f=>f.name)],rows:years.map(y=>[schoolYears.get(y),...fields.map(f=>f.series.find(s=>s.refPer===y)?.value??null)]),
    data:fields.map((f,i)=>({type:'scatter',mode:'lines+markers',name:f.name,x:years.map(y=>schoolYears.get(y)),y:years.map(y=>f.series.find(s=>s.refPer===y)?.value??null),
      line:{color:COLORS[i%COLORS.length]},visible:i<6?true:'legendonly',connectgaps:false})),layout:{height:540,showlegend:true,
      legend:{orientation:'h',y:-.2,font:{size:9}},margin:{l:65,r:20,t:20,b:150},yaxis:{title:{text:'Enrolments'}}}});
  distribution(g,ctx.p,ctx.b,'2014','Resident educational attainment · age 25–64',{source:censusSource(ctx),wide:true});
  distribution(g,ctx.p,ctx.b,'2093','Resident major field of study · age 25–64',{source:censusSource(ctx),wide:true});
  await campuses;
}
