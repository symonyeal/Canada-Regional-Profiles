import {CANADA,estimate,rankIndustries,classifyTrade,esc,fmt} from './model.js';
import {catalog,tablePair,businessSlice,request,seph} from './api.js';
import {heading,notice,controls,bars,chart,card,table,sourceLink,download,COLORS,distribution} from './charts.js';
import {grid,censusSource} from './profiles.js';

export async function industryView(root,ctx,view='largest') {
  const o=ctx.options,sephMode=(o.measure??(ctx.geo.type==='PR'?'seph':'employees'))==='seph',level=sephMode&&o.level==='6'?'4':o.level??'4',metric=o.metric??'value',trade=o.trade??'all',count=Number(o.top??20);
  const titles={largest:'Largest industries',growing:'Fastest-growing industries',insights:'Industry insights'};
  heading(root,titles[view],'Published industry employment, five-year growth and specialization. SEPH is the source recovered from the reference; Business Register estimates remain a separate option.', 'Statistics Canada · live API');
  const ui=controls(root,[{key:'level',label:'NAICS detail',value:level,options:[['2','2-digit · sectors'],['3','3-digit · subsectors'],['4','4-digit · industry groups'],...(!sephMode&&['PR'].includes(ctx.geo.type)?[['6','6-digit · industries']]:[])]},
    {key:'measure',label:'Measure / source',value:sephMode?'seph':o.measure??'employees',options:[...(ctx.geo.type==='PR'?[['seph','SEPH · published employment']]:[]),['employees','Business Register · estimated employees'],['locations','Business Register · employer locations']]},
    {key:'trade',label:'Industry scope',value:trade,options:[['all','All industries'],['traded','Traded'],['local','Local']]},
    {key:'top',label:'Show',value:String(count),options:[['20','Top 20 · reference'],['15','Top 15'],['30','Top 30'],['10000','All industries']]},
    {key:'display',label:'Display',value:o.display??'reference',options:[['reference','Reference chart'],['bars','Ranked bars'],['list','List']]},
    ...(view==='growing'?[{key:'growth',label:'Growth',value:o.growth??'absolute',options:[['absolute','Absolute change'],['relative','Percentage change']]},
      {key:'minbase',label:'Minimum base employment',value:o.minbase??'20',options:[['0','Any positive base'],['20','20 (draft default)'],['100','100'],['500','500']]}]:[]),
    ...(view==='insights'?[{key:'metric',label:'Rank by',value:metric,options:[['value','Size'],['lq','Specialization (LQ)'],['absolute','Five-year change']]}]:[])],ctx.update);
  notice(root,sephMode?'SEPH reports annual employment of employees, by establishment industry. Suppressed industries are unavailable. LQ uses the published industrial aggregate, including unclassified businesses, as the denominator. Traded/local uses the recovered draft’s mapped US classification.':o.measure==='locations'?'Employer locations count business establishments, not employees. Growth and specialization below use those location counts. Traded/local uses the draft’s mapped US classification.':'Employee estimates use size-class midpoints; each 500+ location is counted at 500, with no finite upper bound. These estimates are not payroll jobs. Traded/local uses the draft’s mapped US classification.');
  if(!['PR','CSD','CMACA'].includes(ctx.geo.type)) {
    ui.querySelectorAll('select').forEach(s=>s.disabled=true);
    notice(root,'The Business Counts tables used here do not publish this geographic level. Below is the selected area’s Census resident labour force by sector. Business estimates and five-year business growth are unavailable for this area; no provincial values are substituted.',true);
    const g=grid(root);distribution(g,ctx.p,ctx.b,'2261','Resident labour force by sector',{source:censusSource(ctx),wide:true});return;
  }
  const progress=notice(root,'Discovering releases and querying selected industry series…');
  const local=ctx.geo.type!=='PR';
  let pair,nationalPair;
  if(!sephMode||trade!=='all'){
    const tables=await catalog();pair=tablePair(tables,local);nationalPair=tablePair(tables,false);
  }
  const ranking=view==='growing'?(o.growth??'absolute'):view==='insights'?metric:'value';
  let rows,source,currentLabel,priorLabel,hasPrior;
  const employee=sephMode||o.measure!=='locations',quantity=employee?'Employment':'Employer locations';
  if(sephMode) {
    const data=await seph(ctx.geo,level);if(!root.isConnected)return;progress.remove();
    rows=rankIndustries(data.rows.filter(r=>r.value!=null&&r.value>0),ranking,{total:data.total,nationalTotal:data.nationalTotal});
    currentLabel=`SEPH ${data.year}`,priorLabel=`SEPH ${data.year-5}`,hasPrior=true;
    source=`${sourceLink('https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410020201','Statistics Canada · SEPH 14-10-0202')} · All employees, ${data.year}; comparison ${data.year-5}. ${esc(ctx.geo.name)}. LQ denominator: published industrial aggregate [00-91N], Canada benchmark.`;
  } else {
  const [current,national,prior]=await Promise.all([
    businessSlice(pair.current,ctx.geo,level),businessSlice(nationalPair.current,CANADA,level),
    pair.previous?businessSlice(pair.previous,ctx.geo,level).catch(()=>null):null]);
  if(!root.isConnected)return;progress.remove();
  const previous=new Map(prior?.rows.map(r=>[r.code,r])??[]),nationalRows=new Map(national.rows.map(r=>[r.code,r]));
  const value=r=>employee?estimate(r.N).value:r.locations;
  rows=current.rows.map(r=>({...r,...estimate(r.N),value:value(r),national:nationalRows.has(r.code)?value(nationalRows.get(r.code)):null,
    previous:previous.has(r.code)?value(previous.get(r.code)):null}));
  rows=rankIndustries(rows,ranking);
  currentLabel=current.table.cubeTitleEn;priorLabel=prior?.table.cubeTitleEn??'Baseline unavailable';hasPrior=!!prior;
  source=`${sourceLink(`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${current.table.productId}01`,current.table.cubeTitleEn)}
    ${prior?` · compared with ${sourceLink(`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${prior.table.productId}01`,prior.table.cubeTitleEn)}`:' · matching baseline unavailable'}.
    ${esc(ctx.geo.name)}. LQ benchmark: Canada, same release and NAICS level. 2017/2022 recoding can prevent comparisons.`;
  }
  if(trade!=='all') {
    const wait=notice(root,'Calculating traded/local flags using national employment at six-digit NAICS…');
    const [six,rules]=await Promise.all([businessSlice(nationalPair.current,CANADA,'6'),request('classification.json')]);
    if(!root.isConnected)return;wait.remove();
    const weighted=six.rows.map(r=>({code:r.code,value:estimate(r.N).value}));
    rows=rows.filter(r=>classifyTrade(r.code,weighted,rules.codes,rules.traded)===(trade==='traded'));
  }
  if(view==='growing' && ranking==='relative') rows=rows.filter(r=>r.previous>=Number(o.minbase??20)&&r.previous>0);
  const shown=rows.slice(0,count),g=grid(root),label=ranking==='relative'?'Growth (%)':ranking==='absolute'?'Five-year change':ranking==='lq'?'Location quotient':sephMode?'Published employment':employee?'Estimated employees':'Employer locations';
  if(view==='growing'&&!hasPrior)notice(root,'The matching release five years earlier could not be retrieved. Growth is unavailable; current levels remain available under Largest industries.',true);
  const chartRows=shown.map(r=>({...r,name:`${r.code} · ${r.name}`,value:ranking==='relative'?100*r.relative:r[ranking]}));
  if(o.display==='bars')bars(g,{title:`${titles[view]} · ${label.toLowerCase()}`,subtitle:`${ctx.geo.name} · ${currentLabel} · ${trade} industries`,
    items:chartRows,source,unit:ranking==='relative'?'%':'',wide:true});
  const sector=c=>({'31':'31-33','32':'31-33','33':'31-33','44':'44-45','45':'44-45','48':'48-49','49':'48-49'})[c.slice(0,2)]??c.slice(0,2);
  const palette={'11':'#3A9E52','21':'#696969','22':'#BFB028','23':'#BE8417','31-33':'#8769FF','41':'#AB2F62','44-45':'#FE5F4E','48-49':'#63C7B2','51':'#FFEC36','52':'#13DABC','53':'#0D68BF','54':'#BEC0C3','55':'#BE473A','56':'#0DA38C','61':'#FEB11F','62':'#128bff','71':'#E54084','72':'#4ED36E','81':'#564EFE','91':'#7d622e'};
  if((o.display??'reference')==='reference'&&view==='largest') {
    const sectors=[...new Set(shown.map(r=>sector(r.code)))],valid=shown.filter(r=>r.value>0);
    chart(g,{title:`Largest industries · ${quantity.toLowerCase()} by sector`,subtitle:`${ctx.geo.name} · ${currentLabel} · ${trade} · top ${Math.min(count,shown.length)}`,source,wide:true,
      headers:['Industry',quantity,'LQ'],rows:valid.map(r=>[r.name,r.value,r.lq]),
      data:[{type:'treemap',ids:[...sectors.map(s=>'sector-'+s),...valid.map(r=>r.code)],
        labels:[...sectors.map(s=>ctx.p.children('2261').find(c=>c.name.startsWith(s+' '))?.name??s),...valid.map(r=>r.name)],
        parents:[...sectors.map(()=>''),...valid.map(r=>'sector-'+sector(r.code))],values:[...sectors.map(s=>valid.filter(r=>sector(r.code)===s).reduce((a,r)=>a+r.value,0)),...valid.map(r=>r.value)],
        branchvalues:'total',textinfo:'label+value',marker:{colors:[...sectors.map(s=>palette[s]),...valid.map(r=>palette[sector(r.code)])]}}],layout:{height:540,margin:{t:20,l:10,r:10,b:10}}});
  }
  if((o.display??'reference')==='reference'&&view==='growing')chart(g,{title:`Fastest-growing industries · ${quantity.toLowerCase()} and change`,
    subtitle:`${ctx.geo.name} · ${priorLabel} to ${currentLabel}`,source,wide:true,headers:['Industry','Absolute change',`Current ${quantity.toLowerCase()}`],rows:shown.map(r=>[r.name,r.absolute,r.value]),
    data:[{type:'scatter',mode:'markers',x:shown.map(r=>ranking==='relative'?100*r.relative:r.absolute),y:shown.map(r=>r.value),text:shown.map(r=>r.name),
      marker:{color:shown.map(r=>palette[sector(r.code)]),size:shown.map(r=>18+25*Math.sqrt(Math.abs(r.absolute)/Math.max(...shown.map(x=>Math.abs(x.absolute)),1))),opacity:.85},
      hovertemplate:`%{text}<br>Growth %{x:,.1f}<br>${quantity} %{y:,}<extra></extra>`}],layout:{height:520,xaxis:{title:{text:`${quantity} growth${ranking==='relative'?' (%)':''}`},rangeslider:{visible:true,thickness:.07}},yaxis:{title:{text:`Total ${quantity.toLowerCase()}`}}}});
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
  const detail=card(g,{title:sephMode?'Industry employment detail':'Industry detail and estimate bounds',wide:true}),body=document.createElement('div');body.className='source-table';
  const headers=sephMode?['NAICS','Industry','Published employment','Baseline','Change','Growth (%)','LQ']:
    ['NAICS','Industry','Locations',employee?'Estimated employees':'Locations','Lower bound','Upper bound','Baseline','Change','Growth (%)','LQ'];
  const values=rows.map(r=>sephMode?[r.code,r.name,r.value,r.previous,r.absolute,r.relative==null?null:100*r.relative,r.lq]:
    [r.code,r.name,r.locations,r.value,employee?r.lower:null,employee?r.upper:null,r.previous,r.absolute,r.relative==null?null:100*r.relative,r.lq]);
  body.innerHTML=table(headers,values.map(row=>row.map((v,i)=>i<2?v:v==null?(i===5&&employee&&!sephMode?'Unbounded / missing':'Not available'):fmt(v,i>=(sephMode?5:8)?'ratio':''))));
  const button=document.createElement('button');button.className='download';button.textContent='Download all filtered industries ↓';
  button.onclick=()=>download('industries.csv',[[ctx.geo.name],[currentLabel],[priorLabel],headers,...values]);
  body.append(button);detail.append(body);
  if(rows.length===0)notice(root,'No published industries meet these filters. Lower the minimum baseline or change the industry scope.');
}
