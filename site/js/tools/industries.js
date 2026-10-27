// Largest and fast-growing industries: SEPH payroll employment (the reference's source) for Canada and provinces;
// Business Register employee estimates for metropolitan areas and census subdivisions, labelled as estimates.
import {seph,catalog,tablePair,businessSlice,request,table,SourceError} from '../api.js';
import {CANADA,PT,estimate,rankIndustries,tradedShare,sectorOf,SECTORS,int,signed,compact,fmt} from '../model.js';
import {h,optionCard,segmented,chartCard,dataTable,empty,failure,loading,esc,exhibitMenu} from '../ui.js';
import {treemap,barList,bubbles,legend} from '../charts.js';
import {PRIMARY,FILL} from '../palette.js';
import {lifetime} from './common.js';

let rules;
const classification=()=>rules??=request('classification.json').catch(e=>{rules=null;throw e;});
// Traded when at least half of the code's US 2017 six-digit descendants are in Delgado-Porter-Stern traded clusters.
const isTraded=(code,c)=>{const s=tradedShare(code,c.codes,c.traded);return s==null?null:s>=.5;};

const cache=new Map();
async function industryData(place) {
  const key=place.id;if(cache.has(key))return cache.get(key);
  const p=(async()=>{
    const c=await classification();
    if(place.type==='PR'){
      const d=await seph(place,'4'),y=d.year;
      const all=d.rows.map(r=>({...r,traded:isTraded(r.code,c)}));
      const ranked=rankIndustries(all.filter(r=>r.value!=null),'value',{total:d.total,nationalTotal:d.nationalTotal});
      return {rows:ranked,suppressed:all.filter(r=>r.value==null).length,count:all.length,year:y,prior:y-5,measure:'jobs',
        source:{source:'Statistics Canada, table 14-10-0202: Employment by industry, annual (SEPH)',url:table('14100202'),
          universe:'All employees on payrolls, annual average, by establishment industry (NAICS 4-digit)',period:`${y}; growth compares ${y-5} and ${y}`,
          notes:`Location quotient: the area's share of its industrial aggregate [00-91N] divided by Canada's share. Traded/local follows a mapped US cluster classification and is approximate. ${all.filter(r=>r.value==null).length} of ${all.length} industries are suppressed or not published for ${place.name}.`}};
    }
    if(!['CSD','CMACA'].includes(place.type)) throw new SourceError('unsupported',`Industry employment is published for Canada, provinces and territories (SEPH) and as Business Register estimates for metropolitan areas and municipalities. It is not published for ${place.type==='CD'?'census divisions':place.type==='ER'?'economic regions':'population centres'}.`);
    const cat=await catalog(),local=tablePair(cat,true),nat=tablePair(cat,false);
    const [cur,prev,canada]=await Promise.all([businessSlice(local.current,place,'4'),local.previous?businessSlice(local.previous,place,'4').catch(()=>null):null,businessSlice(nat.current,CANADA,'4')]);
    const before=new Map(prev?.rows.map(r=>[r.code,estimate(r.N).value])??[]),ca=new Map(canada.rows.map(r=>[r.code,estimate(r.N).value]));
    const all=cur.rows.map(r=>({code:r.code,name:r.name,value:estimate(r.N).value,previous:before.get(r.code)??null,national:ca.get(r.code)??null,traded:isTraded(r.code,c)}));
    const ranked=rankIndustries(all.filter(r=>r.value!=null),'value',{total:cur.totalEstimate.value,nationalTotal:canada.totalEstimate.value});
    const y=Number(local.current.cubeTitleEn.slice(-4));
    return {rows:ranked,suppressed:all.filter(r=>r.value==null).length,count:all.length,year:y,prior:local.previous?y-5:null,measure:'estimated employees',estimate:true,
      source:{source:`Statistics Canada, ${local.current.cubeTitleEn}${local.previous?` and ${local.previous.cubeTitleEn.match(/(June|December) \d{4}$/)[0]}`:''}`,url:table(local.current.productId),
        universe:'Employer business locations by employment-size class, converted to employees at class midpoints (500 for 500+)',period:local.current.cubeTitleEn.match(/(June|December) \d{4}$/)[0],
        notes:'These are estimates from size classes, not payroll counts. Industries recoded between releases have no growth value. Traded/local is approximate.'}};
  })();
  cache.set(key,p);p.catch(()=>cache.delete(key));return p;
}

const SETS=[['all','All industries','layers'],['traded','Traded industries','globe'],['local','Local industries','home']];
function setText(kind,set,place) {
  const where=place.name;
  if(kind==='largest')return {all:`The largest industries in ${where}, traded and local.`,traded:`The largest traded industries in ${where}: industries that sell products or services across regions or countries.`,local:`The largest local industries in ${where}: industries that mainly sell within the area.`}[set];
  return {all:`The fastest-growing industries in ${where}, traded and local.`,traded:`The fastest-growing traded industries in ${where}: industries that sell products or services across regions or countries.`,local:`The fastest-growing local industries in ${where}: industries that mainly sell within the area.`}[set];
}

function industryTool(kind) {
  return (el,app)=>{
    const life=lifetime(el),setKey=kind==='largest'?'li':'fg',viewKey=kind==='largest'?'liv':'fgv';
    const side=h('div',{class:'industry-side'}),main=h('div',{class:'industry-main'});
    el.append(h('div',{class:'industry'},side,main));
    async function render() {
      const alive=life.next(),place=await app.resolved();if(!alive()||place.id!==app.state.geo.id)return;
      const set=app.state.t[setKey],view=app.state.t[viewKey];
      const title=kind==='largest'?'Largest industries':'Fast-growing industries';
      side.replaceChildren(h('h3',{},title),
        h('p',{class:'side-text'},kind==='largest'?`Industries with the most employees in ${place.name}.`:`Industries adding the most employees in ${place.name}.`),
        h('div',{class:'count-label'},'3 industry sets'),
        h('div',{class:'option-list'},SETS.map(([k,label,icon])=>optionCard({icon,title:label,text:setText(kind,k,place),selected:k===set,onclick:()=>{app.set(setKey,k);render();}}))),
        h('label',{class:'mobile-select'},h('span',{class:'sr'},'Industry set'),h('select',{onchange:e=>{app.set(setKey,e.target.value);render();}},SETS.map(([k,label])=>{const o=new Option(label,k);o.selected=k===set;return o;}))));
      const card=h('section',{class:'card exhibit','aria-label':title});main.replaceChildren(card);loading(card,'Querying industry employment…');
      let d;
      try {d=await industryData(place);} catch(e) {if(!alive())return;
        failure(card,e,()=>{cache.delete(place.id);render();},'Industry employment unavailable');
        const pr=String(place.province).split('_')[0];
        if(e.kind==='unsupported'&&pr)card.querySelector('.state')?.append(h('button',{class:'btn ghost small',type:'button',onclick:()=>app.choose({id:`2021A0002${pr}`,type:'PR'},kind)},`View ${PT.find(p=>p[0]===pr)?.[2]}`));
        return;}
      if(!alive())return;
      let rows=d.rows.filter(r=>set==='all'||(set==='traded'?r.traded===true:r.traded===false));
      if(kind==='growing')rows=rows.filter(r=>r.absolute!=null).sort((a,b)=>b.absolute-a.absolute||a.code.localeCompare(b.code));
      rows=rows.slice(0,20);
      const setLabel=SETS.find(s=>s[0]===set)[1],views=kind==='largest'?[['treemap','Treemap'],['bars','Bars'],['list','List']]:[['chart','Chart'],['list','List']];
      const unit=d.estimate?'estimated employees':'jobs',years=d.prior?`${d.prior}–${d.year}`:`${d.year}`;
      const sub=view==='list'?`${rows.length} industries · ranked by ${kind==='largest'?`number of ${unit}`:`employment growth (${years})`}`
        :kind==='largest'?(view==='bars'?`${rows.length} industries · ranked by number of ${unit}`:`${rows.length} industries · tile area is proportional to ${unit}, grouped by sector`)
        :`${rows.length} industries · bubble area is proportional to ${unit} in ${d.year}`;
      const meta={...d.source,geo:place.name,table:()=>({headers:['Rank','Industry','NAICS',...(kind==='growing'?[`Change ${years}`]:[]),`${d.year} ${unit}`,...(d.prior?[`${d.prior} ${unit}`]:[]),'LQ','Traded/local'],
        rows:rows.map((r,i)=>[i+1,r.name,r.code,...(kind==='growing'?[r.absolute]:[]),r.value,...(d.prior?[r.previous]:[]),r.lq==null?null:Math.round(r.lq*100)/100,r.traded==null?null:r.traded?'Traded':'Local']),
        numeric:new Set([0,3,4,5,6]),format:(v,i)=>typeof v==='number'?(i>=5&&String(v).includes('.')?v.toFixed(2):fmt(v)):v})};
      card.replaceChildren(h('header',{class:'card-head'},h('div',{},h('h4',{},setLabel),h('p',{class:'card-sub'},sub),
          kind==='growing'&&view==='chart'?legend([['Traded',PRIMARY,'dot'],['Local',FILL,'dot']]):null),
        h('div',{class:'exhibit-tools'},segmented(views,view,v=>{app.set(viewKey,v);render();},'Display'),exhibitMenu({title:`${title}: ${setLabel}`,...meta}))),
        h('div',{class:'body'},rows.length?draw(kind,view,rows,d,place):h('div',{class:'state empty'},`No ${setLabel.toLowerCase()} with published values for ${place.name}.`)),
        d.suppressed?h('p',{class:'card-sub',style:{marginTop:'8px'}},`${d.suppressed} of ${d.count} industries are suppressed or not published for ${place.name}; rankings use published values only.`):null);
    }
    return {update(changed){if(['geo','refresh',setKey,viewKey].some(k=>changed.has(k))){if(changed.has('refresh'))cache.clear();render();}}};
  };
}

const lqText=v=>v==null?'–':v.toFixed(2);
function tip(r,d) {
  return `<b>${esc(r.name)}</b> (NAICS ${r.code})<br>${esc(SECTORS[sectorOf(r.code)]??'')}<br>${d.year}: ${int(r.value)} ${d.estimate?'estimated employees':'jobs'}`+
    (d.prior?`<br>${d.prior}: ${r.previous==null?'not published':int(r.previous)}<br>Change: ${signed(r.absolute)}`:'')+`<br>LQ: ${lqText(r.lq)}<br>${r.traded==null?'':r.traded?'Traded':'Local'}`;
}
function draw(kind,view,rows,d,place) {
  if(view==='list'){
    const body=h('tbody',{},rows.map((r,i)=>h('tr',{},h('td',{class:'rank'},i+1),h('th',{scope:'row'},kind==='growing'?h('span',{class:`tl-dot${r.traded?' traded':''}`,'aria-label':r.traded?'Traded':'Local'}):null,r.name),
      h('td',{class:'num'},r.code),...(kind==='growing'?[h('td',{class:'num pos'},signed(r.absolute))]:[]),h('td',{class:`num${kind==='largest'?' pos':''}`},int(r.value)),h('td',{class:'num'},lqText(r.lq)))));
    return h('div',{class:'table-wrap'},h('table',{},h('thead',{},h('tr',{},h('th',{scope:'col'},'#'),h('th',{scope:'col'},'Industry'),h('th',{scope:'col',class:'num'},'NAICS'),
      ...(kind==='growing'?[h('th',{scope:'col',class:'num'},'5-year change')]:[]),h('th',{scope:'col',class:'num'},d.estimate?'Est. employees':'Number of jobs'),h('th',{scope:'col',class:'num'},'LQ'))),body));
  }
  if(kind==='largest'&&view==='bars')return barList(rows.map(r=>({label:r.name,value:r.value,text:`${int(r.value)} ${d.estimate?'est.':'jobs'}`})));
  if(kind==='largest')return treemap(rows.map(r=>({label:r.name,value:r.value,text:int(r.value),group:sectorOf(r.code),groupLabel:SECTORS[sectorOf(r.code)]??sectorOf(r.code),r})),
    {grouped:true,height:'fill',tooltip:it=>tip(it.r,d)});
  return bubbles(rows.map(r=>({x:r.absolute,y:r.value,size:r.value,short:r.name.length>30?`${r.name.slice(0,28).trimEnd()}…`:r.name,label:`${r.name}: ${signed(r.absolute)} since ${d.prior}, ${int(r.value)} in ${d.year}`,
    fill:r.traded?PRIMARY:FILL,stroke:PRIMARY,html:tip(r,d)})),{xLabel:`Employment growth (${d.prior} – ${d.year})`,yLabel:`Total employment (${d.year})`,height:'fill'});
}

export const largest=industryTool('largest');
export const growing=industryTool('growing');
export const industryCache={data:industryData,classification,clear:()=>cache.clear()};
