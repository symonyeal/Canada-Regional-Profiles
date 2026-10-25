// Industry insights: a banner that opens a full-screen panel with industry selection, trends, benchmarks and location.
import {metadata,geoMember,points,coord,table,catalog,tablePair,businessSlice,units,SourceError} from '../api.js';
import {CANADA,PT,int,compact,fmt,pct,sectorOf,SECTORS,locationQuotient,estimate,ramp} from '../model.js';
import {h,icon,rail,kpiCard,chartCard,exhibitMenu,loading,failure,dataTable} from '../ui.js';
import {spark,lines,columns,barList,legend} from '../charts.js';
import {PRIMARY,COMPARE,MAP_SCALE} from '../palette.js';
import {lifetime,slot} from './common.js';
import {mapPanel,mapTable,areas,shapes,scopeOf,businessBins} from './choropleth.js';

const TABS=[['selection','Industry selection','search'],['trends','Trends','economic'],['benchmarks','Benchmarks','benchmarks'],['location','Location','mapPin']];
const provinceOf=place=>place.id===CANADA.id?CANADA:{id:`2021A0002${String(place.province).split('_')[0]}`,type:'PR',name:PT.find(p=>p[0]===String(place.province).split('_')[0])?.[2]};

// Industries: SEPH 4-digit NAICS members (the industries ranked elsewhere on the page).
let industryList;
const industries=()=>industryList??=metadata('14100202').then(m=>m.dimension[2].member.filter(x=>/^\d{4}$/.test(x.classificationCode??''))
  .map(x=>({code:x.classificationCode,name:x.memberNameEn.replace(/ \[[\d-]+\]$/,''),memberId:x.memberId})).sort((a,b)=>a.name.localeCompare(b.name))).catch(e=>{industryList=null;throw e;});
// The most detailed published member for a NAICS code: the code itself, then 3-digit, then the sector.
function memberFor(dim,code) {
  const by=c=>dim.member.find(x=>(x.classificationCode??'').split('-')[0]===c||(x.classificationCode??'')===c);
  return by(code)??by(code.slice(0,3))??by(sectorOf(code))??dim.member.find(x=>{const [a,b]=(x.classificationCode??'').split('-');return b&&code.slice(0,2)>=a&&code.slice(0,2)<=b;});
}
async function sephSeries(geo,code,n=25) {
  const m=await metadata('14100202'),[gd,ed,nd]=m.dimension,g=geoMember(gd,geo),ind=nd.member.find(x=>x.classificationCode===code);
  if(!g||!ind) throw new SourceError('unsupported','SEPH does not publish this industry for the selected area.');
  const k=coord([g.memberId,1,ind.memberId]),d=await points(m.productId,[k],n);
  return {geoName:g.memberNameEn,values:(d.get(k)??[]).map(p=>({year:Number(p.refPer.slice(0,4)),value:p.value}))};
}
async function series(pid,geo,code,select,n=12) {
  const m=await metadata(pid),dims=m.dimension,g=geoMember(dims[0],geo);if(!g) throw new SourceError('unsupported','This table does not publish the selected area.');
  const ind=memberFor(dims.at(-1),code);if(!ind) throw new SourceError('unsupported','This table does not publish a matching industry.');
  const chosen=[g,...dims.slice(1,-1).map(d=>d.member.find(x=>select.test(x.memberNameEn))??d.member[0]),ind];
  const k=coord(chosen.map(x=>x.memberId)),[d,u]=await Promise.all([points(m.productId,[k],n),units(chosen)]);
  return {geoName:g.memberNameEn,industry:ind.memberNameEn.replace(/ \[[\w-]+\]$/,''),unit:u.unit,metadata:m,
    values:(d.get(k)??[]).map(p=>({year:Number(p.refPer.slice(0,4)),value:p.value==null?null:p.value*u.scale}))};
}

export function insights(el,app) {
  const life=lifetime(el);let overlay=null,opener=null;
  const banner=h('div',{class:'insights-banner'},h('div',{style:{position:'relative',zIndex:1}},
    h('h3',{},'Discover industry insights'),h('p',{},'Employment trends, specialization and business locations for any industry, for the selected area.'),
    h('div',{class:'banner-actions'},h('button',{type:'button',class:'btn light',onclick:e=>open('selection',e.currentTarget,'search')},icon('search',16),'Search for an industry'),
      h('button',{type:'button',class:'btn text',onclick:e=>open('selection',e.currentTarget,'browse')},'Browse all industries',icon('chevronRight',16)))));
  el.append(banner);

  function close() {overlay?.remove();overlay=null;document.body.style.overflow='';app.set('ins','');app.set('inst','trends');opener?.focus();}
  async function open(tab,from,mode='search') {
    opener=from??opener;overlay?.remove();
    const alive=life.next(),place=await app.resolved();if(!alive())return;
    const code=app.state.t.ins,body=h('div',{class:'overlay-body'}),intro=h('div',{class:'overlay-intro'}),main=h('div',{class:'overlay-main'});
    overlay=h('div',{class:'overlay',role:'dialog','aria-modal':'true','aria-label':'Industry insights'},
      h('div',{class:'overlay-bar'},h('button',{type:'button',class:'icon-btn','aria-label':'Back to industry selection',onclick:()=>open('selection')},icon('arrowLeft',20)),
        h('span',{class:'card-sub'},`Industry insights · ${place.name}`),h('button',{type:'button',class:'icon-btn','aria-label':'Close industry insights',onclick:close},icon('close',22))),body);
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();
      if(e.key==='Tab'){const f=[...overlay.querySelectorAll('button,input,select,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&x.offsetParent);if(!f.length)return;
        if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus();}}});
    document.body.append(overlay);document.body.style.overflow='hidden';
    const active=code?tab:'selection';
    body.append(rail(TABS.map(([key,label,i])=>({key,label,icon:i})).filter(t=>code||t.key==='selection'),active,k=>{app.set('inst',k==='selection'?'trends':k);open(k);},'Industry insights sections'),intro,main);
    if(active==='selection'){await selection(intro,main,place,mode,alive);overlay.querySelector('input')?.focus();return;}
    const list=await industries(),ind=list.find(i=>i.code===code);
    if(!ind){app.set('ins','');return open('selection');}
    intro.append(h('h3',{},ind.name),h('p',{},`NAICS ${ind.code} · ${SECTORS[sectorOf(ind.code)]??''}`),
      h('p',{},{trends:`Employment, business counts, output and earnings for this industry. Each exhibit names its own geography: payroll, output and earnings tables are published for provinces and territories, business counts also for metropolitan areas and municipalities.`,
        benchmarks:'How the industry’s share of employment compares across provinces and territories.',
        location:`Where businesses in this industry are located and how large they are.`}[active]));
    ({trends,benchmarks,location})[active](main,place,ind,alive);
    overlay.querySelector('.rail-item[aria-current=true]')?.focus();
  }

  async function selection(intro,main,place,mode,alive) {
    intro.append(h('h3',{},'Choose an industry'),h('p',{},'Search by name or browse by sector. Industries are NAICS 2017 industry groups (four-digit), as published in the Survey of Employment, Payrolls and Hours.'));
    const input=h('input',{type:'search',placeholder:'Search for an industry','aria-label':'Search for an industry'});
    const sector=h('select',{'aria-label':'Sector',class:'field-select'},h('option',{value:''},'All sectors'),...Object.entries(SECTORS).map(([c,n])=>h('option',{value:c},n)));
    const results=h('div',{role:'list'});
    main.append(h('div',{class:'finder'},h('label',{class:'search'},icon('search',18),input),mode==='browse'?h('div',{style:{margin:'16px 0'}},h('label',{class:'field'},h('span',{},'Browse industries'),sector)):null,results));
    loading(results,'Loading industries…');
    let list;try{list=await industries();}catch(e){if(alive())failure(results,e,()=>selection(intro,main,place,mode,alive));return;}
    const draw=()=>{const q=input.value.trim().toLowerCase(),s=sector.value;
      const rows=list.filter(i=>(!q||i.name.toLowerCase().includes(q)||i.code.startsWith(q))&&(!s||sectorOf(i.code)===s));
      results.replaceChildren(...(mode==='search'&&!q&&!s?[h('p',{class:'card-sub',style:{padding:'12px 8px'}},`${list.length} industries. Type to search, or browse all.`)]:
        rows.slice(0,120).map(i=>h('button',{type:'button',class:'industry-row',role:'listitem',onclick:()=>{app.set('ins',i.code);app.set('inst','trends');open('trends');}},
          h('b',{},i.name),h('span',{},`NAICS ${i.code} · ${SECTORS[sectorOf(i.code)]??''}`),icon('chevronRight',16)))),
        rows.length?null:h('p',{class:'card-sub',style:{padding:'12px 8px'}},'No industry matches.'));};
    input.addEventListener('input',draw);sector.addEventListener('change',draw);draw();
  }

  function trends(main,place,ind,alive) {
    const pr=provinceOf(place),cells=[['1 / 5','1 / 3'],['5 / 7','1 / 2'],['5 / 7','2 / 3'],['1 / 4','3 / 4'],['4 / 7','3 / 4']].map(([c,r])=>main.appendChild(h('div',{class:'cell',style:{gridColumn:c,gridRow:r}})));
    slot(cells[0],async t=>{const [a,c]=await Promise.all([sephSeries(pr,ind.code),sephSeries(CANADA,ind.code).catch(()=>null)]);if(!alive())return;
      const years=[...new Set([...a.values,...(c?.values??[])].map(v=>v.year))].sort();
      t.replaceChildren(chartCard({title:'Employment by industry',subtitle:`${ind.name} · payroll employees, annual average · ${a.geoName}`,meta:{source:'Statistics Canada, table 14-10-0202 (SEPH), all employees',url:table('14100202'),geo:a.geoName,period:`${years[0]} to ${years.at(-1)}`,
        notes:pr.id!==place.id?`SEPH is published for provinces and territories; this is ${a.geoName}, not ${place.name}.`:null,
        table:()=>({headers:['Year',a.geoName],rows:a.values.map(v=>[String(v.year),v.value]),numeric:new Set([1]),format:(v,i)=>i?int(v):v})}},
        h('div',{class:'body'},lines({x:years.map(String),series:[{name:a.geoName,values:years.map(y=>a.values.find(v=>v.year===y)?.value??null),color:PRIMARY,fmt:int}],fmt:compact,height:250})),legend([[a.geoName,PRIMARY]])));},{alive,context:'Employment'});
    slot(cells[1],async t=>{const d=await establishments(place,ind.code);if(!alive())return;
      t.replaceChildren(kpiCard({title:'Number of establishments',value:d.current==null?'Not available':int(d.current),sub:`${d.geoName} · ${d.period}${d.previous!=null?` · ${d.previous<=d.current?'+':''}${int(d.current-d.previous)} since ${d.prior}`:''}`,
        meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,universe:'Business locations with employees',table:()=>({headers:['Release','Locations'],rows:[[d.period,d.current],[d.prior??'',d.previous]],numeric:new Set([1]),format:v=>int(v)})}}));},{alive,context:'Establishments'});
    slot(cells[2],async t=>{const d=await establishments(place,ind.code);if(!alive())return;
      t.replaceChildren(kpiCard({title:'Establishment location quotient',value:d.lq==null?'Not available':d.lq.toFixed(2),sub:`${d.geoName} vs Canada · ${d.period}`,
        meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,notes:'Share of the area’s employer locations in this industry divided by the same share for Canada.',table:()=>({headers:['Measure','Value'],rows:[['Location quotient',d.lq]],numeric:new Set([1]),format:v=>v?.toFixed(2)})}}));},{alive,context:'Establishment LQ'});
    slot(cells[3],async t=>{if(pr.id===CANADA.id) throw new SourceError('unsupported','GDP by industry in this table is published for provinces and territories; choose one to see it.');
      const d=await series('36100711',pr,ind.code,/^Current dollars$/,10);if(!alive())return;
      t.replaceChildren(chartCard({title:'GDP by industry ($ millions)',subtitle:`${d.industry} · current dollars · ${d.geoName}`,meta:{source:'Statistics Canada, table 36-10-0711',url:table('36100711'),geo:d.geoName,period:`${d.values[0]?.year} to ${d.values.at(-1)?.year}`,notes:`Most detailed published level for NAICS ${ind.code}: ${d.industry}.`,
        table:()=>({headers:['Year','GDP ($ millions)'],rows:d.values.map(v=>[String(v.year),v.value==null?null:v.value/1e6]),numeric:new Set([1]),format:(v,i)=>i?fmt(Math.round(v)):v})}},
        h('div',{class:'body'},columns({categories:d.values.map(v=>String(v.year)),series:[{name:d.geoName,values:d.values.map(v=>v.value==null?null:v.value/1e6),color:COMPARE}],fmt:v=>`$${int(v)}M`,axisFmt:v=>`$${int(v)}`,height:250}))));},{alive,context:'GDP by industry'});
    slot(cells[4],async t=>{const d=await series('14100204',pr,ind.code,/^(All employees|Including overtime)$/,10);if(!alive())return;
      t.replaceChildren(chartCard({title:'Average weekly earnings',subtitle:`${d.industry} · including overtime · ${d.geoName}`,meta:{source:'Statistics Canada, table 14-10-0204 (SEPH)',url:table('14100204'),geo:d.geoName,period:`${d.values[0]?.year} to ${d.values.at(-1)?.year}`,
        table:()=>({headers:['Year','Average weekly earnings ($)'],rows:d.values.map(v=>[String(v.year),v.value]),numeric:new Set([1]),format:(v,i)=>i?`$${fmt(v)}`:v})}},
        h('div',{class:'body'},lines({x:d.values.map(v=>String(v.year)),series:[{name:d.geoName,values:d.values.map(v=>v.value),color:PRIMARY,fmt:v=>`$${int(v)}`}],fmt:v=>`$${int(v)}`,height:250}))));},{alive,context:'Weekly earnings'});
  }

  function benchmarks(main,place,ind,alive) {
    const cell=main.appendChild(h('div',{class:'span-6'})),note=main.appendChild(h('div',{class:'span-6'}));
    slot(cell,async t=>{
      const m=await metadata('14100202'),[gd,,nd]=m.dimension,agg=nd.member.find(x=>x.classificationCode==='00-91N'),it=nd.member.find(x=>x.classificationCode===ind.code);
      const geos=[CANADA,...PT.map(([c,,n])=>({id:`2021A0002${c}`,type:'PR',name:n}))].map(g=>({g,m:geoMember(gd,g)})).filter(x=>x.m);
      const keys=geos.flatMap(({m:gm})=>[coord([gm.memberId,1,agg.memberId]),coord([gm.memberId,1,it.memberId])]);
      const d=await points(m.productId,keys,1),v=k=>d.get(k)?.at(-1)?.value??null,year=d.get(keys[0])?.at(-1)?.refPer.slice(0,4);
      const ca=geos[0].m,E=v(coord([ca.memberId,1,it.memberId])),T=v(coord([ca.memberId,1,agg.memberId]));
      const rows=geos.slice(1).map(({g,m:gm})=>({label:g.name,lq:locationQuotient(v(coord([gm.memberId,1,it.memberId])),v(coord([gm.memberId,1,agg.memberId])),E,T),jobs:v(coord([gm.memberId,1,it.memberId]))}));
      const pr=provinceOf(place).name;if(!alive())return;
      t.replaceChildren(chartCard({title:'Employment specialization by province and territory',subtitle:`${ind.name} · location quotient, Canada = 1.00 · SEPH ${year}${pr?` · ${pr} highlighted`:''}`,
        meta:{source:'Statistics Canada, table 14-10-0202 (SEPH)',url:table('14100202'),geo:'Provinces and territories',period:year,notes:'LQ: the province’s share of payroll employment in this industry divided by Canada’s share. Suppressed values are not available.',
          table:()=>({headers:['Province or territory','Employees','LQ'],rows:rows.map(r=>[r.label,r.jobs,r.lq==null?null:Math.round(r.lq*100)/100]),numeric:new Set([1,2]),format:(x,i)=>i===2?x.toFixed(2):int(x)})}},
        h('div',{class:'body'},barList(rows.map(r=>({label:r.label===pr?`${r.label} (selected)`:r.label,value:r.lq,text:r.lq==null?'Suppressed':r.lq.toFixed(2),bench:1,benchText:'1.00'})),{benchName:'Canada',size:'sm'}))));
    },{alive,context:'Benchmarks'});
    note.append(h('p',{class:'notice'},'Financial performance benchmarks (profit margins and expense structure by industry) are published by Statistics Canada as downloadable tables rather than through its data service, so they are not shown here.'));
  }

  function location(main,place,ind,alive) {
    const cells=['span-2','span-4'].map(c=>main.appendChild(h('div',{class:c})));
    slot(cells[0],async t=>{const d=await establishments(place,ind.code);if(!alive())return;
      t.replaceChildren(kpiCard({title:'Businesses in industry',value:d.current==null?'Not available':int(d.current),sub:`${d.geoName} · ${d.period}`,
        meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,universe:'Business locations with employees',table:()=>({headers:['Measure','Value'],rows:[['Locations',d.current]],numeric:new Set([1]),format:v=>int(v)})}}));},{alive,context:'Businesses'});
    const mapCell=main.appendChild(h('div',{class:'span-6 map-cell',style:{height:'440px',display:'flex',position:'relative'}}));
    (async()=>{
      const scope=scopeOf(place);if(!scope){mapCell.replaceChildren(h('p',{class:'notice'},'Choose a province or territory to map businesses in this industry by census subdivision.'));return;}
      const panel=mapPanel(mapCell,{unit:'n',label:'Businesses',onopen:id=>{close();app.choose({id,type:'CSD'},'insights');}});mapCell.querySelector('.map-wrap').style.flex='1';
      try {
        const [{metadata:m,subtotal,table:t},{list},d]=await Promise.all([businessBins(true),areas(scope),establishments(place,ind.code)]);
        const it=m.dimension[2].member.find(x=>x.classificationCode===ind.code);if(!it) throw new SourceError('unsupported','The local Business Counts table does not publish this industry.');
        const matched=list.map(g=>({g,mem:geoMember(m.dimension[0],g)})).filter(x=>x.mem);
        const keys=matched.flatMap(({mem})=>[coord([mem.memberId,1,it.memberId]),coord([mem.memberId,1,subtotal.memberId])]);
        const pts=await points(t.productId,keys);if(!alive())return;
        const v=k=>pts.get(k)?.at(-1)?.value??null;
        // A missing series is zero only when the area publishes a classified total (the table omits zero series).
        const matrix=new Map(matched.map(({g,mem})=>{const tot=v(coord([mem.memberId,1,subtotal.memberId])),n=v(coord([mem.memberId,1,it.memberId]));return [g.id,{name:g.name,total:tot,values:[n??(tot!=null?0:null)]}];}));
        const data={spec:{kind:'toggle',ramp:MAP_SCALE,bins:[{id:it.memberId}],unit:'Businesses'},matrix,own:{name:d.geoName,total:null,values:[d.current]}};
        await panel.draw({data,sel:[true],place,group:'businesses',shapes:shapes(scope)});
        mapCell.querySelector('.map-wrap').append(h('div',{class:'map-tools'},exhibitMenu({title:`Businesses in ${ind.name} by census subdivision`,source:`Statistics Canada, ${t.cubeTitleEn}`,url:table(t.productId),
          geo:'Census subdivisions published in the local Business Counts table',period:d.period,notes:'Share: this industry’s locations as a share of all classified employer locations in the area.',table:()=>mapTable(panel.rows)})));
      } catch(e) {if(alive())failure(mapCell,e,null,'Business map unavailable');}
    })();
    slot(cells[1],async t=>{const d=await establishments(place,ind.code);if(!alive())return;
      t.replaceChildren(chartCard({title:'Businesses by number of employees',subtitle:`${ind.name} · ${d.geoName} · ${d.period}`,meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,
        table:()=>({headers:['Employment size','Locations'],rows:d.sizes.map((s,i)=>[s,d.N[i]]),numeric:new Set([1]),format:v=>int(v)})}},
        h('div',{class:'body'},columns({categories:d.sizes.map(s=>s.replace(/ employees$/,'').replace(' to ','-').replace(' and over','+')),series:[{name:d.geoName,values:d.N,color:COMPARE}],fmt:v=>int(v),axisFmt:v=>int(v),height:220}))));},{alive,context:'Size classes'});
  }

  // Business Counts row for the industry: national table for Canada and provinces, local table for CMAs and CSDs.
  const estCache=new Map();
  function establishments(place,code) {
    const key=`${place.id}:${code}`;if(estCache.has(key))return estCache.get(key);
    const p=(async()=>{
      const local=['CSD','CMACA'].includes(place.type),geo=local||place.type==='PR'?place:provinceOf(place),cat=await catalog(),pair=tablePair(cat,local),nat=tablePair(cat,false);
      const level=String(code.length);
      const [cur,prev,ca]=await Promise.all([businessSlice(pair.current,geo,level),pair.previous?businessSlice(pair.previous,geo,level).catch(()=>null):null,businessSlice(nat.current,CANADA,level)]);
      const row=cur.rows.find(r=>r.code===code),before=prev?.rows.find(r=>r.code===code),natRow=ca.rows.find(r=>r.code===code);
      const tot=cur.rows.reduce((s,r)=>s+(r.locations??0),0),natTot=ca.rows.reduce((s,r)=>s+(r.locations??0),0);
      return {geoName:local||place.type==='PR'?place.name:geo.name,table:pair.current,period:pair.current.cubeTitleEn.match(/(June|December) \d{4}$/)[0],prior:pair.previous?.cubeTitleEn.match(/(June|December) \d{4}$/)[0],
        current:row?.locations??null,previous:before?.locations??null,N:row?.N??[],sizes:cur.sizes,lq:locationQuotient(row?.locations??null,tot,natRow?.locations??null,natTot)};
    })();
    estCache.set(key,p);p.catch(()=>estCache.delete(key));return p;
  }

  return {update(changed){
    if(changed.has('refresh'))estCache.clear();
    if((changed.has('geo')||changed.has('refresh'))&&overlay)open(app.state.t.inst);
    if(changed.has('ins')||changed.has('inst')){if(app.state.t.ins)open(app.state.t.inst);else if(overlay)close();}
    if(changed.has('geo')&&!overlay&&app.state.t.ins&&app.state.section==='insights')open(app.state.t.inst);
  }};
}
