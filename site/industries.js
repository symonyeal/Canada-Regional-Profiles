import {CANADA,estimate,rankIndustries,classifyTrade,esc,fmt} from './model.js';
import {catalog,tablePair,businessSlice,request} from './api.js';
import {heading,notice,controls,bars,chart,card,table,sourceLink,download,COLORS,distribution} from './charts.js';
import {grid,censusSource} from './profiles.js';

export async function industryView(root,ctx,view='largest') {
  const o=ctx.options,level=o.level??'4',metric=o.metric??'value',trade=o.trade??'all',count=Number(o.top??15);
  const titles={largest:'Largest industries',growing:'Fastest-growing industries',insights:'Industry insights'};
  heading(root,titles[view],'Business locations and estimated employees by industry. Choose the NAICS detail, measure and traded/local classification.', 'Business Register · live API');
  const ui=controls(root,[{key:'level',label:'NAICS detail',value:level,options:[['2','2-digit · sectors'],['3','3-digit · subsectors'],['4','4-digit · industry groups'],...(['PR'].includes(ctx.geo.type)?[['6','6-digit · industries']]:[])]},
    {key:'measure',label:'Measure',value:o.measure??'employees',options:[['employees','Estimated employees'],['locations','Employer locations']]},
    {key:'trade',label:'Industry scope',value:trade,options:[['all','All industries'],['traded','Traded'],['local','Local']]},
    {key:'top',label:'Show',value:String(count),options:[['15','Top 15'],['30','Top 30'],['10000','All industries']]},
    ...(view==='growing'?[{key:'growth',label:'Growth',value:o.growth??'absolute',options:[['absolute','Absolute change'],['relative','Percentage change']]},
      {key:'minbase',label:'Minimum base employment',value:o.minbase??'20',options:[['0','Any positive base'],['20','20 (draft default)'],['100','100'],['500','500']]}]:[]),
    ...(view==='insights'?[{key:'metric',label:'Rank by',value:metric,options:[['value','Size'],['lq','Specialization (LQ)'],['absolute','Five-year change']]}]:[])],ctx.update);
  notice(root,'Employee estimates use size-class midpoints; each 500+ location is counted at 500. That open class has no finite upper bound. These estimates are not payroll jobs. Traded/local uses the draft’s mapped US classification, not Localintel’s proprietary classification.');
  if(!['PR','CSD','CMACA'].includes(ctx.geo.type)) {
    ui.querySelectorAll('select').forEach(s=>s.disabled=true);
    notice(root,'The Business Counts tables used here do not publish this geographic level. Below is the selected area’s Census resident labour force by sector. Business estimates and five-year business growth are unavailable for this area; no provincial values are substituted.',true);
    const g=grid(root);distribution(g,ctx.p,ctx.b,'2261','Resident labour force by sector',{source:censusSource(ctx),wide:true});return;
  }
  const progress=notice(root,'Discovering releases and querying selected industry series…');
  const tables=await catalog(),local=ctx.geo.type!=='PR',pair=tablePair(tables,local),nationalPair=tablePair(tables,false);
  const [current,national,prior]=await Promise.all([
    businessSlice(pair.current,ctx.geo,level),businessSlice(nationalPair.current,CANADA,level),
    pair.previous?businessSlice(pair.previous,ctx.geo,level).catch(()=>null):null]);
  if(!root.isConnected)return;progress.remove();
  const previous=new Map(prior?.rows.map(r=>[r.code,r])??[]),nationalRows=new Map(national.rows.map(r=>[r.code,r]));
  const employee=o.measure!=='locations',value=r=>employee?estimate(r.N).value:r.locations;
  let rows=current.rows.map(r=>({...r,...estimate(r.N),value:value(r),national:nationalRows.has(r.code)?value(nationalRows.get(r.code)):null,
    previous:previous.has(r.code)?value(previous.get(r.code)):null}));
  const ranking=view==='growing'?(o.growth??'absolute'):view==='insights'?metric:'value';
  rows=rankIndustries(rows,ranking);
  if(trade!=='all') {
    const wait=notice(root,'Calculating traded/local flags using national employment at six-digit NAICS…');
    const [six,rules]=await Promise.all([businessSlice(nationalPair.current,CANADA,'6'),request('classification.json')]);
    if(!root.isConnected)return;wait.remove();
    const weighted=six.rows.map(r=>({code:r.code,value:estimate(r.N).value}));
    rows=rows.filter(r=>classifyTrade(r.code,weighted,rules.codes,rules.traded)===(trade==='traded'));
  }
  if(view==='growing' && ranking==='relative') rows=rows.filter(r=>r.previous>=Number(o.minbase??20)&&r.previous>0);
  const source=`${sourceLink(`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${current.table.productId}01`,current.table.cubeTitleEn)}
    ${prior?` · compared with ${sourceLink(`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${prior.table.productId}01`,prior.table.cubeTitleEn)}`:' · matching baseline unavailable'}.
    ${esc(ctx.geo.name)}. LQ benchmark: Canada, same release and NAICS level. 2017/2022 recoding can prevent comparisons.`;
  const shown=rows.slice(0,count),g=grid(root),label=ranking==='relative'?'Growth (%)':ranking==='absolute'?'Five-year change':ranking==='lq'?'Location quotient':employee?'Estimated employees':'Employer locations';
  if(view==='growing'&&!prior)notice(root,'The matching release five years earlier could not be retrieved. Growth is unavailable; current levels remain available under Largest industries.',true);
  const chartRows=shown.map(r=>({...r,name:`${r.code} · ${r.name}`,value:ranking==='relative'?100*r.relative:r[ranking]}));
  bars(g,{title:`${titles[view]} · ${label.toLowerCase()}`,subtitle:`${ctx.geo.name} · ${current.table.cubeTitleEn} · ${trade} industries`,
    items:chartRows,source,unit:ranking==='relative'?'%':'',wide:true});
  if(view==='insights') {
    const valid=rows.filter(r=>r.value>0&&r.lq!=null);
    chart(g,{title:'Industry specialization and growth',subtitle:'Bubble area: current size. LQ above 1: larger share than Canada. Growth can be negative.',
      source,wide:true,headers:['Industry','Five-year change (%)','LQ','Current size'],rows:valid.map(r=>[r.name,r.relative==null?null:100*r.relative,r.lq,r.value]),
      data:[{type:'scatter',mode:'markers',x:valid.map(r=>r.relative==null?null:100*r.relative),y:valid.map(r=>r.lq),text:valid.map(r=>r.name),
        marker:{size:valid.map(r=>r.value),sizemode:'area',sizeref:2*Math.max(...valid.map(r=>r.value),1)/(65**2),sizemin:4,color:COLORS[0],opacity:.7},
        hovertemplate:'%{text}<br>Growth %{x:.1f}%<br>LQ %{y:.2f}<extra></extra>'}],
      layout:{xaxis:{title:{text:'Five-year change (%)'}},yaxis:{title:{text:'Location quotient (Canada = 1)'}},
        shapes:[{type:'line',xref:'paper',x0:0,x1:1,y0:1,y1:1,line:{dash:'dot',color:'#b6bdb8'}}]}});
    const tree=shown.filter(r=>r.value>0);
    chart(g,{title:'Industry composition',subtitle:'Area represents selected measure; only displayed industries are included.',source,wide:true,
      headers:['Industry','Current size'],rows:tree.map(r=>[r.name,r.value]),
      data:[{type:'treemap',labels:tree.map(r=>r.name),parents:tree.map(()=>''),values:tree.map(r=>r.value),textinfo:'label+percent entry',marker:{colors:tree.map((_,i)=>COLORS[i%COLORS.length])}}],
      layout:{height:450,margin:{t:20,b:15,l:15,r:15}}});
  }
  const detail=card(g,{title:'Industry detail and estimate bounds',wide:true}),body=document.createElement('div');body.className='source-table';
  const headers=['NAICS','Industry','Locations',employee?'Estimated employees':'Locations','Lower bound','Upper bound','Baseline','Change','Growth (%)','LQ'];
  const values=rows.map(r=>[r.code,r.name,r.locations,r.value,employee?r.lower:null,employee?r.upper:null,r.previous,r.absolute,r.relative==null?null:100*r.relative,r.lq]);
  body.innerHTML=table(headers,values.map(row=>row.map((v,i)=>i<2?v:v==null?(i===5&&employee?'Unbounded / missing':'Not available'):fmt(v,i>=8?'ratio':''))));
  const button=document.createElement('button');button.className='download';button.textContent='Download all filtered industries ↓';
  button.onclick=()=>download('industries.csv',[[ctx.geo.name],[current.table.cubeTitleEn],[prior?.table.cubeTitleEn??'Baseline unavailable'],headers,...values]);
  body.append(button);detail.append(body);
  if(rows.length===0)notice(root,'No published industries meet these filters. Lower the minimum baseline or change the industry scope.');
}
