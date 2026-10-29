// DOM components shared by every tool. Components return elements; callers own their state.
import {csv} from './model.js';
import {MESSAGES} from './transport.js';

const SVGNS='http://www.w3.org/2000/svg';
export function h(tag,props={},...children) {
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(props??{})) {
    if(v==null||v===false) continue;
    if(k==='class') el.className=v;
    else if(k==='style'&&typeof v==='object') for(const [p,x] of Object.entries(v))p.startsWith('--')?el.style.setProperty(p,x):el.style[p]=x;
    else if(k.startsWith('on')) el.addEventListener(k.slice(2),v);
    else if(k==='dataset') Object.assign(el.dataset,v);
    else if(k==='html') el.innerHTML=v;
    else el.setAttribute(k,v===true?'':v);
  }
  el.append(...children.flat(Infinity).filter(c=>c!=null&&c!==false).map(c=>c instanceof Node?c:document.createTextNode(String(c))));
  return el;
}
export function svg(tag,attrs={},...children) {
  const el=document.createElementNS(SVGNS,tag);
  for(const [k,v] of Object.entries(attrs))if(v!=null)el.setAttribute(k,v);
  el.append(...children.flat(Infinity).filter(c=>c!=null&&c!==false).map(c=>c instanceof Node?c:document.createTextNode(String(c))));
  return el;
}
export function icon(name,size=18) {
  const el=svg('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.75,
    'stroke-linecap':'round','stroke-linejoin':'round',class:'icon','aria-hidden':'true',focusable:'false'});
  for(const [t,a] of ICONS[name]??[])el.append(svg(t,a));
  return el;
}

// ---------- feedback states ----------
export function loading(el,text='Loading public data…') {el.replaceChildren(h('div',{class:'state loading',role:'status'},h('span',{class:'spinner','aria-hidden':'true'}),text));}
export function failure(el,error,retry,context='') {
  const kind=error?.kind,message=error?.message||MESSAGES[kind]||'The source could not supply this exhibit.';
  el.replaceChildren(h('div',{class:'state failure',role:'alert'},icon('alert',18),
    h('div',{},h('strong',{},context||'Data unavailable'),h('p',{},message),
      retry&&kind!=='unsupported'&&kind!=='empty'?h('button',{class:'btn ghost',type:'button',onclick:retry},icon('refresh',15),'Retry'):null)));
}

// ---------- tooltip ----------
let tip;
export function showTip(event,html) {
  tip??=document.body.appendChild(h('div',{class:'tooltip',role:'tooltip'}));
  tip.innerHTML=html;tip.hidden=false;
  const pad=12,r=tip.getBoundingClientRect(),x=event.clientX,y=event.clientY;
  tip.style.left=`${Math.min(innerWidth-r.width-8,Math.max(8,x+pad))}px`;
  tip.style.top=`${y+pad+r.height>innerHeight?y-r.height-pad:y+pad}px`;
}
export function hideTip() {if(tip)tip.hidden=true;}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- dialog ----------
export function dialog(title,content) {
  const opener=document.activeElement;
  const close=()=>{d.close();d.remove();opener?.focus?.();};
  const d=h('dialog',{class:'dialog','aria-label':title},
    h('div',{class:'dialog-head'},h('h3',{},title),h('button',{class:'icon-btn',type:'button','aria-label':'Close',onclick:close},icon('close',18))),
    h('div',{class:'dialog-body'},content));
  d.addEventListener('cancel',e=>{e.preventDefault();close();});
  d.addEventListener('click',e=>{if(e.target===d)close();});
  document.body.append(d);d.showModal();return d;
}

// ---------- tables and export ----------
function download(name,rows) {
  const a=h('a',{href:URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'})),download:name});
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
// Sortable table; numeric identifies numeric columns, format(v,col) supplies the displayed value.
export function dataTable({headers,rows,numeric=new Set(),format=v=>v}) {
  let key=null,dir=1;
  const body=h('tbody');
  const ths=headers.map((label,i)=>h('th',{scope:'col',class:numeric.has(i)?'num':null,'aria-sort':'none'},
    h('button',{type:'button',class:'sort',onclick:()=>{dir=key===i?-dir:(numeric.has(i)?-1:1);key=i;draw();}},label,h('span',{class:'sort-mark','aria-hidden':'true'}))));
  const draw=()=>{
    const ordered=key==null?rows:rows.slice().sort((a,b)=>{const x=a[key],y=b[key];
      if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return (typeof x==='number'?x-y:String(x).localeCompare(String(y)))*dir;});
    ths.forEach((th,i)=>th.setAttribute('aria-sort',key===i?(dir>0?'ascending':'descending'):'none'));
    body.replaceChildren(...ordered.map(r=>h('tr',{},r.map((v,i)=>h(i===0?'th':'td',{class:numeric.has(i)?'num':null,...(i===0?{scope:'row'}:{})},v==null?'Not available':format(v,i))))));
  };
  draw();
  return h('div',{class:'table-wrap'},h('table',{},h('thead',{},h('tr',{},ths)),body));
}

// ---------- menus and controls ----------
// Async search with keyboard selection. load(query) returns rows; describe(row) gives [label, detail].
// A new search or close invalidates pending results; loading rows cannot select an old match.
export function combobox(input,list,{load,choose,describe,pending,empty,error}) {
  let rows=[],active=-1,version=0;
  const id=i=>`${list.id}-opt-${i}`;
  const close=()=>{version++;rows=[];list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
  const pick=i=>{const row=rows[i];if(row){close();choose(row);}};
  async function search() {
    const v=++version;rows=[];active=-1;list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
    list.replaceChildren(h('li',{class:'note'},pending));
    try {
      const found=await load(input.value.trim().toLowerCase());if(v!==version)return;if(!found){close();return;}rows=found;
      list.replaceChildren(...(rows.length?rows.map((row,i)=>{const [label,detail]=describe(row);
        return h('li',{id:id(i),role:'option','aria-selected':'false',onmousedown:e=>{e.preventDefault();pick(i);}},h('span',{},label),h('small',{},detail));
      }):[h('li',{class:'note'},empty)]));
    } catch(e){if(v===version)list.replaceChildren(h('li',{class:'note'},`${error}: ${e.message}`));}
  }
  const highlight=i=>{if(!rows.length)return;active=i;[...list.children].forEach((li,j)=>li.setAttribute('aria-selected',String(j===i)));
    input.setAttribute('aria-activedescendant',id(i));list.children[i]?.scrollIntoView({block:'nearest'});};
  input.addEventListener('input',search);input.addEventListener('focus',search);input.addEventListener('blur',()=>setTimeout(close,120));
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)search();else highlight(Math.min(rows.length-1,active+1));}
    else if(e.key==='ArrowUp'){e.preventDefault();highlight(Math.max(0,active-1));}
    else if(e.key==='Enter'){e.preventDefault();pick(active>=0?active:0);}
    else if(e.key==='Escape'){close();e.stopPropagation();}
  });
  return search;
}

// items: [{label, icon, action}]. Opens below the button; Escape and outside clicks close it.
function menu(items,label='More options') {
  const list=h('div',{class:'menu',role:'menu',hidden:true});
  const button=h('button',{class:'icon-btn kebab',type:'button','aria-label':label,'aria-haspopup':'menu','aria-expanded':'false'},icon('more',18));
  const close=()=>{list.hidden=true;button.setAttribute('aria-expanded','false');document.removeEventListener('click',outside,true);};
  const outside=e=>{if(!wrap.contains(e.target))close();};
  for(const it of items)list.append(h('button',{type:'button',role:'menuitem',class:'menu-item',onclick:()=>{close();it.action();}},icon(it.icon??'info',15),it.label));
  button.onclick=()=>{if(!list.hidden)return close();list.hidden=false;button.setAttribute('aria-expanded','true');list.querySelector('button')?.focus();document.addEventListener('click',outside,true);};
  list.addEventListener('keydown',e=>{const b=[...list.querySelectorAll('button')],i=b.indexOf(document.activeElement);
    if(e.key==='Escape'){close();button.focus();}if(e.key==='ArrowDown'){e.preventDefault();b[(i+1)%b.length].focus();}if(e.key==='ArrowUp'){e.preventDefault();b[(i-1+b.length)%b.length].focus();}});
  const wrap=h('div',{class:'menu-wrap'},button,list);return wrap;
}
// The standard chart menu: data table, CSV and source details for one exhibit.
export function exhibitMenu(meta) {
  return menu([
    {label:'View data table',icon:'table',action:()=>dialog(meta.title,h('div',{},sourceBlock(meta),dataTable(meta.table())))},
    {label:'Download CSV',icon:'download',action:()=>{const t=meta.table();download(`${meta.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`,
      [[meta.title],[`Geography: ${meta.geo??''}`],[`Period: ${meta.period??''}`],[`Source: ${meta.source??''}`],...(meta.universe?[[`Universe: ${meta.universe}`]]:[]),[`Retrieved: ${new Date().toISOString()}`],[],t.headers,...t.rows]);}},
    {label:'Source and definitions',icon:'info',action:()=>dialog(meta.title,sourceBlock(meta))},
  ],`Options for ${meta.title}`);
}
function sourceBlock(meta) {
  return h('dl',{class:'source-block'},
    ...[['Source',meta.url?h('a',{href:meta.url,target:'_blank',rel:'noopener'},meta.source,' ',icon('external',13)):meta.source],
      ['Geography',meta.geo],['Period',meta.period],['Universe',meta.universe],['Notes',meta.notes],['Retrieved',new Date().toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'})]]
      .filter(([,v])=>v).flatMap(([k,v])=>[h('dt',{},k),h('dd',{},v)]));
}
export function segmented(options,value,onchange,label) {
  const el=h('div',{class:'segmented',role:'group','aria-label':label});
  for(const [v,text] of options)el.append(h('button',{type:'button','aria-pressed':String(v===value),onclick:()=>{if(v!==value)onchange(v);}},text));
  return el;
}
export function rail(items,active,onchange,label) {
  const nav=h('nav',{class:'rail','aria-label':label});
  for(const it of items)nav.append(h('button',{type:'button',class:'rail-item','aria-current':it.key===active?'true':null,onclick:()=>onchange(it.key)},icon(it.icon,22),h('span',{},it.label)));
  return nav;
}
export function toggle(label,checked,onchange) {
  return h('button',{type:'button',role:'switch',class:'switch-row','aria-checked':String(checked),onclick:e=>onchange(e.currentTarget.getAttribute('aria-checked')!=='true')},
    h('span',{class:'switch-label'},label),h('span',{class:'switch','aria-hidden':'true'}));
}
// Dual-thumb slider over n ordered bins: two native range inputs, so keyboard and screen readers work unchanged.
export function rangeSlider({n,lo,hi,label,ends,describe,onchange}) {
  const a=h('input',{type:'range',min:0,max:n-1,step:1,value:lo,'aria-label':`${label}: lower bin`});
  const b=h('input',{type:'range',min:0,max:n-1,step:1,value:hi,'aria-label':`${label}: upper bin`});
  const fill=h('span',{class:'range-fill'}),out=h('output',{class:'range-value'});
  const draw=()=>{const x=Math.min(+a.value,+b.value),y=Math.max(+a.value,+b.value);
    fill.style.left=`${100*x/(n-1)}%`;fill.style.width=`${100*(y-x)/(n-1)}%`;out.textContent=describe(x,y);
    a.setAttribute('aria-valuetext',describe(x,x));b.setAttribute('aria-valuetext',describe(y,y));return [x,y];};
  const commit=()=>onchange(...draw());
  for(const i of [a,b]){i.addEventListener('input',draw);i.addEventListener('change',commit);}
  draw();
  return {out,el:h('div',{class:'range'},h('div',{class:'range-track'},fill,a,b),h('div',{class:'range-ends'},h('span',{},ends[0]),h('span',{},ends[1])))};
}

// ---------- cards ----------
export function chartCard({title,subtitle,meta,cls=''},...body) {
  return h('section',{class:`card chart-card ${cls}`,'aria-label':title},
    h('header',{class:'card-head'},h('div',{},h('h4',{},title),subtitle?h('p',{class:'card-sub'},subtitle):null),meta?exhibitMenu({title,...meta}):null),
    ...body);
}
export function kpiCard({title,value,sub,spark,meta}) {
  return h('section',{class:'card kpi','aria-label':title},
    h('header',{class:'card-head'},h('h4',{},title),meta?exhibitMenu({title,...meta}):null),
    h('div',{class:'kpi-value'},value),sub?h('div',{class:'kpi-sub'},sub):null,spark??null);
}

// Lucide icons v0.460.0, ISC licence (https://lucide.dev/license). Each entry lists the SVG child elements of a 24x24 icon.
const ICONS={"economic":[["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16"}],["path",{"d":"m19 9-5 5-4-4-3 3"}]],"resident":[["path",{"d":"M18 20a6 6 0 0 0-12 0"}],["circle",{"cx":"12","cy":"10","r":"4"}],["circle",{"cx":"12","cy":"12","r":"10"}]],"household":[["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{"cx":"9","cy":"7","r":"4"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["path",{"d":"M16 3.13a4 4 0 0 1 0 7.75"}]],"dwelling":[["path",{"d":"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"}],["path",{"d":"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"}]],"workforce":[["path",{"d":"M18 21a8 8 0 0 0-16 0"}],["circle",{"cx":"10","cy":"8","r":"5"}],["path",{"d":"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"}]],"livability":[["circle",{"cx":"12","cy":"12","r":"4"}],["path",{"d":"M12 2v2"}],["path",{"d":"M12 20v2"}],["path",{"d":"m4.93 4.93 1.41 1.41"}],["path",{"d":"m17.66 17.66 1.41 1.41"}],["path",{"d":"M2 12h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"m6.34 17.66-1.41 1.41"}],["path",{"d":"m19.07 4.93-1.41 1.41"}]],"search":[["circle",{"cx":"11","cy":"11","r":"8"}],["path",{"d":"m21 21-4.3-4.3"}]],"chevronRight":[["path",{"d":"m9 18 6-6-6-6"}]],"more":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"12","cy":"5","r":"1"}],["circle",{"cx":"12","cy":"19","r":"1"}]],"plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"minus":[["path",{"d":"M5 12h14"}]],"download":[["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["polyline",{"points":"7 10 12 15 17 10"}],["line",{"x1":"12","x2":"12","y1":"15","y2":"3"}]],"table":[["path",{"d":"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"}]],"info":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],"close":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"mapPin":[["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]],"dollar":[["line",{"x1":"12","x2":"12","y1":"2","y2":"22"}],["path",{"d":"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"}]],"user":[["path",{"d":"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"}],["circle",{"cx":"12","cy":"7","r":"4"}]],"clock":[["circle",{"cx":"12","cy":"12","r":"10"}],["polyline",{"points":"12 6 12 12 16 14"}]],"building":[["rect",{"width":"16","height":"20","x":"4","y":"2","rx":"2","ry":"2"}],["path",{"d":"M9 22v-4h6v4"}],["path",{"d":"M8 6h.01"}],["path",{"d":"M16 6h.01"}],["path",{"d":"M12 6h.01"}],["path",{"d":"M12 10h.01"}],["path",{"d":"M12 14h.01"}],["path",{"d":"M16 10h.01"}],["path",{"d":"M16 14h.01"}],["path",{"d":"M8 10h.01"}],["path",{"d":"M8 14h.01"}]],"key":[["path",{"d":"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{"cx":"16.5","cy":"7.5","r":".5","fill":"currentColor"}]],"bed":[["path",{"d":"M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"}],["path",{"d":"M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"}],["path",{"d":"M12 4v6"}],["path",{"d":"M2 18h20"}]],"store":[["path",{"d":"m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"}],["path",{"d":"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"}],["path",{"d":"M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"}],["path",{"d":"M2 7h20"}],["path",{"d":"M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"}]],"maximize":[["polyline",{"points":"15 3 21 3 21 9"}],["polyline",{"points":"9 21 3 21 3 15"}],["line",{"x1":"21","x2":"14","y1":"3","y2":"10"}],["line",{"x1":"3","x2":"10","y1":"21","y2":"14"}]],"refresh":[["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]],"link":[["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]],"alert":[["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]],"arrowLeft":[["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],"external":[["path",{"d":"M15 3h6v6"}],["path",{"d":"M10 14 21 3"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]],"list":[["path",{"d":"M3 12h.01"}],["path",{"d":"M3 18h.01"}],["path",{"d":"M3 6h.01"}],["path",{"d":"M8 12h13"}],["path",{"d":"M8 18h13"}],["path",{"d":"M8 6h13"}]],"benchmarks":[["circle",{"cx":"7.5","cy":"7.5","r":".5","fill":"currentColor"}],["circle",{"cx":"18.5","cy":"5.5","r":".5","fill":"currentColor"}],["circle",{"cx":"11.5","cy":"11.5","r":".5","fill":"currentColor"}],["circle",{"cx":"7.5","cy":"16.5","r":".5","fill":"currentColor"}],["circle",{"cx":"17.5","cy":"14.5","r":".5","fill":"currentColor"}],["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16"}]]};
ICONS.home=ICONS.dwelling;

// A generation counter per tool: work started for an older selection never draws.
export function lifetime(el) {
  let gen=0;
  return {next(){const g=++gen;return ()=>g===gen&&el.isConnected;}};
}
// Run fn(el) into its own element with loading and retry states; one slot failing never blocks another.
export function slot(el,fn,{text,context,alive=()=>true}={}) {
  // Unpublished combinations are a normal state, shown plainly; other failures get the error state and Retry.
  const run=async()=>{loading(el,text);try{await fn(el);}catch(e){if(!alive()||!el.isConnected)return;
    if(e?.kind==='unsupported')el.replaceChildren(h('section',{class:'card unpublished'},h('h4',{},context??'Not published'),h('p',{class:'card-sub'},e.message)));
    else {console.warn(context??'slot',e);failure(el,e,run,context);}}};
  run();return el;
}
