// Industry detail: selection, trends, benchmarks and business locations.
import {industryList,sephSeries,industrySeries,table,businessIndustry,industryShares,industryMap} from '../api.js';
import {SourceError} from '../transport.js';
import {CANADA,parentProvince,provinceOf,int,compact,fmt,sectorOf,SECTORS,PRIMARY,COMPARE,MAP_SCALE} from '../model.js';
import {h,icon,rail,kpiCard,chartCard,exhibitMenu,loading,failure,lifetime,slot} from '../ui.js';
import {lines,columns,barList,legend} from '../charts.js';
import {mapPanel,mapTable} from './choropleth.js';
import {shapes,mapLibrary} from '../geo.js';

const TABS=[['selection','Industry selection','search'],['trends','Trends','economic'],['benchmarks','Benchmarks','benchmarks'],['location','Location','mapPin']];

export function insights(el,app) {
  const life=lifetime(el);let overlay=null,opener=null;
  function close() {overlay?.remove();overlay=null;document.body.style.overflow='';app.set('ins','');app.set('inst','trends');opener?.focus();}
  async function open(tab,from) {
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
    if(active==='selection'){await selection(intro,main,alive);overlay.querySelector('input')?.focus();return;}
    const list=await industryList(),ind=list.find(i=>i.code===code);
    if(!ind){app.set('ins','');return open('selection');}
    intro.append(h('h3',{},ind.name),h('p',{},`NAICS ${ind.code} · ${SECTORS[sectorOf(ind.code)]??''}`),
      h('p',{},{trends:`Employment, business counts, output and earnings for this industry. Each exhibit names its own geography: payroll, output and earnings tables are published for provinces and territories, business counts also for metropolitan areas and municipalities.`,
        benchmarks:'How the industry’s share of employment compares across provinces and territories.',
        location:`Where businesses in this industry are located and how large they are.`}[active]));
    ({trends,benchmarks,location})[active](main,place,ind,alive);
    overlay.querySelector('.rail-item[aria-current=true]')?.focus();
  }

  async function selection(intro,main,alive) {
    intro.append(h('h3',{},'Choose an industry'),h('p',{},'Search by name or browse by sector. Industries are NAICS 2017 industry groups (four-digit), as published in the Survey of Employment, Payrolls and Hours.'));
    const input=h('input',{type:'search',placeholder:'Search for an industry','aria-label':'Search for an industry'});
    const results=h('div',{role:'list'});
    main.append(h('div',{class:'finder'},h('label',{class:'search'},icon('search',18),input),results));
    loading(results,'Loading industries…');
    let list;try{list=await industryList();}catch(e){if(alive())failure(results,e,()=>selection(intro,main,alive));return;}
    const draw=()=>{const q=input.value.trim().toLowerCase();
      const rows=list.filter(i=>(!q||i.name.toLowerCase().includes(q)||i.code.startsWith(q)));
      results.replaceChildren(...(!q?[h('p',{class:'card-sub',style:{padding:'12px 8px'}},`${list.length} industries. Type to search, or browse all.`)]:
        rows.slice(0,120).map(i=>h('button',{type:'button',class:'industry-row',role:'listitem',onclick:()=>{app.set('ins',i.code);app.set('inst','trends');open('trends');}},
          h('b',{},i.name),h('span',{},`NAICS ${i.code} · ${SECTORS[sectorOf(i.code)]??''}`),icon('chevronRight',16)))),
        rows.length?null:h('p',{class:'card-sub',style:{padding:'12px 8px'}},'No industry matches.'));};
    input.addEventListener('input',draw);draw();
  }

  function trends(main,place,ind,alive) {
    const pr=parentProvince(place),cells=[['1 / 5','1 / 3'],['5 / 7','1 / 2'],['5 / 7','2 / 3'],['1 / 4','3 / 4'],['4 / 7','3 / 4']].map(([c,r])=>main.appendChild(h('div',{class:'cell',style:{gridColumn:c,gridRow:r}})));
    slot(cells[0],async t=>{const [a,c]=await Promise.all([sephSeries(pr,ind.code),sephSeries(CANADA,ind.code).catch(()=>null)]);if(!alive())return;
      const years=[...new Set([...a.values,...(c?.values??[])].map(v=>v.year))].sort();
      t.replaceChildren(chartCard({title:'Employment by industry',subtitle:`${ind.name} · payroll employees, annual average · ${a.geoName}`,meta:{source:'Statistics Canada, table 14-10-0202 (SEPH), all employees',url:table('14100202'),geo:a.geoName,period:`${years[0]} to ${years.at(-1)}`,
        notes:pr.id!==place.id?`SEPH is published for provinces and territories; this is ${a.geoName}, not ${place.name}.`:null,
        table:()=>({headers:['Year',a.geoName],rows:a.values.map(v=>[String(v.year),v.value]),numeric:new Set([1]),format:(v,i)=>i?int(v):v})}},
        h('div',{class:'body'},lines({x:years.map(String),series:[{name:a.geoName,values:years.map(y=>a.values.find(v=>v.year===y)?.value??null),color:PRIMARY,fmt:int}],fmt:compact,height:250})),legend([[a.geoName,PRIMARY]])));},{alive,context:'Employment'});
    slot(cells[1],async t=>{const d=await businessIndustry(place,ind.code);if(!alive())return;
      t.replaceChildren(kpiCard({title:'Number of establishments',value:d.current==null?'Not available':int(d.current),sub:`${d.geoName} · ${d.period}${d.previous!=null?` · ${d.previous<=d.current?'+':''}${int(d.current-d.previous)} since ${d.prior}`:''}`,
        meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,universe:'Business locations with employees',table:()=>({headers:['Release','Locations'],rows:[[d.period,d.current],[d.prior??'',d.previous]],numeric:new Set([1]),format:v=>int(v)})}}));},{alive,context:'Establishments'});
    slot(cells[2],async t=>{const d=await businessIndustry(place,ind.code);if(!alive())return;
      t.replaceChildren(kpiCard({title:'Establishment location quotient',value:d.lq==null?'Not available':d.lq.toFixed(2),sub:`${d.geoName} vs Canada · ${d.period}`,
        meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,notes:'Share of the area’s employer locations in this industry divided by the same share for Canada.',table:()=>({headers:['Measure','Value'],rows:[['Location quotient',d.lq]],numeric:new Set([1]),format:v=>v?.toFixed(2)})}}));},{alive,context:'Establishment LQ'});
    slot(cells[3],async t=>{if(pr.id===CANADA.id) throw new SourceError('unsupported','GDP by industry in this table is published for provinces and territories; choose one to see it.');
      const d=await industrySeries('36100711',pr,ind.code,/^Current dollars$/,10);if(!alive())return;
      t.replaceChildren(chartCard({title:'GDP by industry ($ millions)',subtitle:`${d.industry} · current dollars · ${d.geoName}`,meta:{source:'Statistics Canada, table 36-10-0711',url:table('36100711'),geo:d.geoName,period:`${d.values[0]?.year} to ${d.values.at(-1)?.year}`,notes:`Most detailed published level for NAICS ${ind.code}: ${d.industry}.`,
        table:()=>({headers:['Year','GDP ($ millions)'],rows:d.values.map(v=>[String(v.year),v.value==null?null:v.value/1e6]),numeric:new Set([1]),format:(v,i)=>i?fmt(Math.round(v)):v})}},
        h('div',{class:'body'},columns({categories:d.values.map(v=>String(v.year)),series:[{name:d.geoName,values:d.values.map(v=>v.value==null?null:v.value/1e6),color:COMPARE}],fmt:v=>`$${int(v)}M`,axisFmt:v=>`$${int(v)}`,height:250}))));},{alive,context:'GDP by industry'});
    slot(cells[4],async t=>{const d=await industrySeries('14100204',pr,ind.code,/^(All employees|Including overtime)$/,10);if(!alive())return;
      t.replaceChildren(chartCard({title:'Average weekly earnings',subtitle:`${d.industry} · including overtime · ${d.geoName}`,meta:{source:'Statistics Canada, table 14-10-0204 (SEPH)',url:table('14100204'),geo:d.geoName,period:`${d.values[0]?.year} to ${d.values.at(-1)?.year}`,
        table:()=>({headers:['Year','Average weekly earnings ($)'],rows:d.values.map(v=>[String(v.year),v.value]),numeric:new Set([1]),format:(v,i)=>i?`$${fmt(v)}`:v})}},
        h('div',{class:'body'},lines({x:d.values.map(v=>String(v.year)),series:[{name:d.geoName,values:d.values.map(v=>v.value),color:PRIMARY,fmt:v=>`$${int(v)}`}],fmt:v=>`$${int(v)}`,height:250}))));},{alive,context:'Weekly earnings'});
  }

  function benchmarks(main,place,ind,alive) {
    const cell=main.appendChild(h('div',{class:'span-6'})),note=main.appendChild(h('div',{class:'span-6'}));
    slot(cell,async t=>{
      const {year,rows}=await industryShares(ind.code),pr=parentProvince(place).name;if(!alive())return;
      t.replaceChildren(chartCard({title:'Employment specialization by province and territory',subtitle:`${ind.name} · location quotient, Canada = 1.00 · SEPH ${year}${pr?` · ${pr} highlighted`:''}`,
        meta:{source:'Statistics Canada, table 14-10-0202 (SEPH)',url:table('14100202'),geo:'Provinces and territories',period:year,notes:'LQ: the province’s share of payroll employment in this industry divided by Canada’s share. Suppressed values are not available.',
          table:()=>({headers:['Province or territory','Employees','LQ'],rows:rows.map(r=>[r.name,r.jobs,r.lq==null?null:Math.round(r.lq*100)/100]),numeric:new Set([1,2]),format:(x,i)=>i===2?x.toFixed(2):int(x)})}},
        h('div',{class:'body'},barList(rows.map(r=>({label:r.name===pr?`${r.name} (selected)`:r.name,value:r.lq,text:r.lq==null?'Suppressed':r.lq.toFixed(2),bench:1,benchText:'1.00'})),{benchName:'Canada',size:'sm'}))));
    },{alive,context:'Benchmarks'});
    note.append(h('p',{class:'notice'},'Financial performance benchmarks (profit margins and expense structure by industry) are published by Statistics Canada as downloadable tables rather than through its data service, so they are not shown here.'));
  }

  function location(main,place,ind,alive) {
    const cells=['span-2','span-4'].map(c=>main.appendChild(h('div',{class:c})));
    slot(cells[0],async t=>{const d=await businessIndustry(place,ind.code);if(!alive())return;
      t.replaceChildren(kpiCard({title:'Businesses in industry',value:d.current==null?'Not available':int(d.current),sub:`${d.geoName} · ${d.period}`,
        meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,universe:'Business locations with employees',table:()=>({headers:['Measure','Value'],rows:[['Locations',d.current]],numeric:new Set([1]),format:v=>int(v)})}}));},{alive,context:'Businesses'});
    const mapCell=main.appendChild(h('div',{class:'span-6 map-cell',style:{height:'440px',display:'flex',position:'relative'}}));
    (async()=>{
      const scope=provinceOf(place);if(!scope){mapCell.replaceChildren(h('p',{class:'notice'},'Choose a province or territory to map businesses in this industry by census subdivision.'));return;}
      // A failed load leaves the map notice; the card and data table still draw.
      try {await mapLibrary();} catch {}
      if(!alive())return;
      const panel=mapPanel(mapCell,{unit:'n',label:'Businesses',onopen:id=>{close();app.choose({id,type:'CSD'},'industries');}});mapCell.querySelector('.map-wrap').style.flex='1';
      try {
        const [{table:t,matrix,bins},d]=await Promise.all([industryMap(scope,ind.code),businessIndustry(place,ind.code)]);if(!alive())return;
        const data={spec:{kind:'toggle',ramp:MAP_SCALE,bins,unit:'Businesses'},matrix,own:{name:d.geoName,total:null,values:[d.current]}};
        await panel.draw({data,sel:[true],place,group:'businesses',shapes:shapes(scope)});
        mapCell.querySelector('.map-wrap').append(h('div',{class:'map-tools'},exhibitMenu({title:`Businesses in ${ind.name} by census subdivision`,source:`Statistics Canada, ${t.cubeTitleEn}`,url:table(t.productId),
          geo:'Census subdivisions published in the local Business Counts table',period:d.period,notes:'Share: this industry’s locations as a share of all classified employer locations in the area.',table:()=>mapTable(panel.rows)})));
      } catch(e) {if(alive())failure(mapCell,e,null,'Business map unavailable');}
    })();
    slot(cells[1],async t=>{const d=await businessIndustry(place,ind.code);if(!alive())return;
      t.replaceChildren(chartCard({title:'Businesses by number of employees',subtitle:`${ind.name} · ${d.geoName} · ${d.period}`,meta:{source:`Statistics Canada, ${d.table.cubeTitleEn}`,url:table(d.table.productId),geo:d.geoName,period:d.period,
        table:()=>({headers:['Employment size','Locations'],rows:d.sizes.map((s,i)=>[s,d.N[i]]),numeric:new Set([1]),format:v=>int(v)})}},
        h('div',{class:'body'},columns({categories:d.sizes.map(s=>s.replace(/ employees$/,'').replace(' to ','-').replace(' and over','+')),series:[{name:d.geoName,values:d.N,color:COMPARE}],fmt:v=>int(v),axisFmt:v=>int(v),height:220}))));},{alive,context:'Size classes'});
  }

  return {open(code,from,tab='trends'){app.set('ins',code);app.set('inst',tab);open(code?tab:'selection',from);},destroy:close,update(changed){
    if((changed.has('geo')||changed.has('refresh'))&&overlay)open(app.state.t.inst);
    if(changed.has('ins')||changed.has('inst')){if(app.state.t.ins)open(app.state.t.inst);else if(overlay)close();}
    if(changed.has('geo')&&!overlay&&app.state.t.ins&&app.state.section==='industries')open(app.state.t.inst);
  }};
}
