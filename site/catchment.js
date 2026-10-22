import {request,decodeSDMX,geographies,CENSUS,catalog,tablePair,metadata,geoMember,points,coord} from './api.js';
import {Profile,matchesProvince,esc,fmt} from './model.js';
import {formRequest} from './maps.js';
import {heading,controls,notice,card,tiles,table,download,sourceLink} from './charts.js';
export function binCounts(values,on) {
  const total=values.some(v=>v==null)?null:values.reduce((s,v)=>s+v,0),selected=values.filter((_,i)=>on[i]);
  return {total,target:selected.some(v=>v==null)?null:selected.reduce((s,v)=>s+v,0)};
}
export function jenks(values,k=6) {
  const x=values.filter(v=>v!=null&&Number.isFinite(v)).sort((a,b)=>a-b),n=x.length;
  if(!n)return [];k=Math.min(k,new Set(x).size);if(k<2)return [x[0],x.at(-1)];
  const L=Array.from({length:n+1},()=>Array(k+1).fill(0)),V=Array.from({length:n+1},()=>Array(k+1).fill(Infinity));
  for(let j=1;j<=k;j++){L[1][j]=1;V[1][j]=0;}
  for(let l=2;l<=n;l++){let s1=0,s2=0,w=0,v=0;
    for(let m=1;m<=l;m++){const i=l-m+1,value=x[i-1];s2+=value*value;s1+=value;w++;v=s2-s1*s1/w;
      if(i!==1)for(let j=2;j<=k;j++)if(V[l][j]>=v+V[i-1][j-1]){L[l][j]=i;V[l][j]=v+V[i-1][j-1];}}
    L[l][1]=1;V[l][1]=v;
  }
  const b=Array(k+1);b[k]=x.at(-1);b[0]=x[0];
  for(let j=k,c=n;j>=2;j--){b[j-1]=x[L[c][j]-2];c=L[c][j]-1;}return b;
}
const GROUPS={consumers:[['150','Individual income'],['age5','Individual age'],['246','Household income'],['100','Household type']],
  dwellings:[['1426','Construction period'],['41','Structure type'],['1400','Tenure'],['1407','Bedrooms']],
  businesses:[['biz-sector','Industry'],['biz-size','Employment size']],workforce:[['2014','Education'],['2248','Occupation'],['2261','Industry']]};
async function spatialScope(type,province) {
  const base='https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer',features=[];
  for(let offset=0;offset<10000;offset+=500){const d=await formRequest(`${base}/${type==='PR'?0:9}/query`,
    {where:province?`PRUID='${province}'`:'1=1',outFields:'*',returnGeometry:'true',outSR:'4326',maxAllowableOffset:'.012',
      resultOffset:String(offset),resultRecordCount:'500',orderByFields:'OBJECTID',f:'geojson'});
    features.push(...d.features);if(d.features.length<500)break;}
  return {type:'FeatureCollection',features};
}
async function censusMatrix(areas,bins,type) {
  const grouped=new Map(areas.map(g=>[g.id,[]])),chunks=[];
  for(let i=0;i<areas.length;i+=50)chunks.push(areas.slice(i,i+50));
  let next=0;
  await Promise.all(Array.from({length:Math.min(4,chunks.length)},async()=>{
    for(;;){const i=next++;if(i>=chunks.length)return;const ids=chunks[i].map(g=>g.id).join('+');
      const rows=decodeSDMX(await request(`${CENSUS}/data/DF_${type}/A5.${ids}.1.${bins.map(b=>b.id).join('+')}.1`,undefined,'application/vnd.sdmx.data+json;version=1.0'));
      for(const r of rows)grouped.get(r.area.id)?.push(r);}
  }));
  return new Map([...grouped].map(([id,rows])=>{const p=new Profile(rows);return [id,bins.map(b=>p.value(b.id))];}));
}
async function businessMatrix(areas,dimension,type) {
  const pair=tablePair(await catalog(),type!=='PR'),m=await metadata(pair.current.productId),[gd,sd,nd]=m.dimension;
  const bins=dimension==='biz-sector'?nd.member.filter(x=>/^\d{2}(?:-\d{2})?$/.test(x.classificationCode??'')).map(x=>({...x,id:String(x.memberId),name:x.memberNameEn})):
    sd.member.filter(x=>x.parentMemberId!=null).map(x=>({...x,id:String(x.memberId),name:x.memberNameEn}));
  const matched=areas.map(g=>({g,member:geoMember(gd,g)})).filter(x=>x.member);
  const subtotal=dimension==='biz-sector'?nd.member.find(x=>x.classificationCode==='3')?.memberId:1;
  const key=(member,b)=>dimension==='biz-sector'?coord([member,1,Number(b.id)]):coord([member,Number(b.id),1]);
  const keys=matched.flatMap(x=>[...bins.map(b=>key(x.member.memberId,b)),coord([x.member.memberId,1,subtotal])]);
  const data=await points(m.productId,keys),get=k=>data.get(k)?.at(-1)?.value??null;
  const matrix=new Map(matched.map(({g,member})=>{let values=bins.map(b=>get(key(member.memberId,b)));
    const total=get(coord([member.memberId,1,subtotal]));if(total!=null&&values.reduce((s,v)=>s+(v??0),0)===total)values=values.map(v=>v??0);
    return [g.id,values];}));
  return {bins,matrix,source:sourceLink(`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${m.productId}01`,m.cubeTitleEn)};
}
export async function catchment(root,ctx,workforce=false) {
  const o=ctx.options,mode=workforce?'workforce':o.marketmode??'consumers',dimension=GROUPS[mode].some(x=>x[0]===o.mapdim)?o.mapdim:GROUPS[mode][0][0];
  heading(root,workforce?'Workforce catchment':'Target markets',`Choose published Census bins and map their counts or shares. Study area: ${ctx.provinceName??'Canada (province/territory level)'}.`, 'Live choropleth · natural breaks');
  controls(root,[...(!workforce?[{key:'marketmode',label:'Target population',value:mode,options:[['consumers','Local consumers'],['dwellings','Local dwellings'],['businesses','Local businesses']]}]:[]),
    {key:'mapdim',label:'Filter dimension',value:dimension,options:GROUPS[mode]}],ctx.update);
  notice(root,'The map sums bins from the active dimension, as in the recovered reference. Selecting income and age does not create an unpublished joint income-by-age count. A province selection maps its municipalities; Canada maps provinces/territories. Missing bins remain unavailable.');
  const type=ctx.province?'CSD':'PR';
  const areas=(await geographies(type)).filter(g=>g.id!=='2021A000011124'&&matchesProvince(g,ctx.province));
  let bins,matrix,source;
  if(mode==='businesses')({bins,matrix,source}=await businessMatrix(areas,dimension,type));
  else {bins=dimension==='age5'?ctx.p.children('9').concat(ctx.p.children('13'),ctx.p.children('24')):ctx.p.children(dimension);
    matrix=await censusMatrix(areas,bins,type);source=sourceLink(`${CENSUS}/data/DF_${type}`,'Statistics Canada · Census Profile 2021');}
  if(!root.isConnected)return;
  let polygons;
  try{polygons=await spatialScope(type,ctx.province);}catch(e){
    if(root.isConnected)notice(root,'Boundary service unavailable: '+e.message+' The published values, filters and downloads remain available below.',true);
  }
  if(!root.isConnected)return;
  const saved=o.mapbins?.split(','),selected=bins.map((b,i)=>saved?saved.includes(b.id):dimension==='150'?i>=3&&i<=6:true);let percent=o.mapunit==='%';
  const kpis=document.createElement('div');root.append(kpis);
  const node=card(root,{title:`${mode==='workforce'?'Workforce':mode==='consumers'?'Consumers':mode==='dwellings'?'Dwellings':'Businesses'} by ${type==='PR'?'province / territory':'municipality'}`}),bar=document.createElement('div');bar.className='map-toolbar';node.append(bar);
  const checkboxes=document.createElement('div');checkboxes.className='map-bins';bar.append(checkboxes);
  bins.forEach((b,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=selected[i];
    input.onchange=()=>{selected[i]=input.checked;ctx.persist('mapbins',bins.filter((_,j)=>selected[j]).map(x=>x.id).join(','));draw();};label.append(input,document.createTextNode(b.name));checkboxes.append(label);});
  const toggle=document.createElement('button');toggle.className='button subtle';bar.append(toggle);toggle.onclick=()=>{percent=!percent;ctx.persist('mapunit',percent?'%':'#');draw();};
  const mapElement=document.createElement('div');mapElement.className='map';node.append(mapElement);
  const detail=document.createElement('details');detail.className='explorer';detail.innerHTML='<summary>View mapped values and download CSV</summary>';node.append(detail);
  const rowsElement=document.createElement('div');detail.append(rowsElement);let map,layer,legend;
  if(window.L){map=L.map(mapElement,{scrollWheelZoom:false}).setView([57,-98],3);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);ctx.cleanup(()=>map.remove());}
  else mapElement.innerHTML='<p class="empty">Map library unavailable. Values remain in the table.</p>';
  const colors=['#FFFFB2','#FED976','#FEB24C','#FD8D3C','#F03B20','#BD0026'];
  function draw(){
    const values=areas.map(g=>{const counts=binCounts(matrix.get(g.id)??bins.map(()=>null),selected);return {...g,...counts,value:percent?(counts.total>0&&counts.target!=null?100*counts.target/counts.total:null):counts.target};});
    const available=values.filter(v=>v.total!=null&&v.target!=null),lookup=new Map(values.map(v=>[v.id,v])),breaks=jenks(values.map(v=>v.value));
    kpis.replaceChildren();tiles(kpis,[{label:'Total · fully published areas',value:available.reduce((s,v)=>s+v.total,0),note:'Active dimension only'},
      {label:'Target · fully published areas',value:available.reduce((s,v)=>s+v.target,0),note:'Selected bins'},
      {label:'Areas with complete observations',value:available.length,note:`Of ${areas.length} areas`},
      {label:'Areas with missing observations',value:areas.length-available.length,note:'Excluded from complete-area totals'}]);
    toggle.textContent=percent?'Showing % · switch to counts':'Showing counts · switch to %';
    const color=v=>{if(v==null)return '#cfd4d0';let i=1;while(i<breaks.length-1&&v>breaks[i])i++;return colors[Math.round((i-1)*5/Math.max(1,breaks.length-2))];};
    if(map&&polygons){if(layer)map.removeLayer(layer);layer=L.geoJSON(polygons,{style:f=>({color:'#fff',weight:.7,fillOpacity:.8,fillColor:color(lookup.get(f.properties.DGUID)?.value)}),
      onEachFeature:(f,l)=>{const row=lookup.get(f.properties.DGUID);if(row){l.bindPopup(`<b>${esc(row.name)}</b><br>${esc(fmt(row.value,percent?'%':''))}`);l.on('click',()=>ctx.choose(row));}}}).addTo(map);
      if(ctx.province&&layer.getBounds().isValid())map.fitBounds(layer.getBounds(),{padding:[12,12]});
      if(legend)legend.remove();legend=L.control({position:'bottomright'});legend.onAdd=()=>{const div=L.DomUtil.create('div','map-legend');
        div.innerHTML='<b>Natural breaks</b>'+breaks.slice(1).map((b,i)=>`<div><i style="background:${color(b)}"></i>${esc(fmt(breaks[i],percent?'%':''))} – ${esc(fmt(b,percent?'%':''))}</div>`).join('')+'<div><i style="background:#cfd4d0"></i>Not available</div>';return div;};legend.addTo(map);}
    const rows=values.map(v=>[v.name,v.total,v.target,v.value]);rowsElement.innerHTML=table(['Area','Total','Target',percent?'Share (%)':'Target count'],rows.map(r=>r.map((v,i)=>i?fmt(v):v)));
    const button=document.createElement('button');button.className='download';button.textContent='Download mapped values ↓';button.onclick=()=>download('target-market.csv',[[ctx.provinceName??'Canada'],['Dimension',dimension],['Selected bins',bins.filter((_,i)=>selected[i]).map(b=>b.name).join('; ')],['Area','Total','Target',percent?'Share (%)':'Target count'],...rows]);rowsElement.append(button);
  }draw();
  const foot=document.createElement('p');foot.className='source';foot.innerHTML=source+' · 2021 official Census boundaries · OpenStreetMap basemap. Natural breaks use up to six classes.';node.append(foot);
}
