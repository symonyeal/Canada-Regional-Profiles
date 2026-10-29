// DOM components shared by every tool. Components return elements; callers own their state.
import {ICONS} from './icons.js';
import {csv,int} from './model.js';
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
export function icon(name,size=18,cls='icon') {
  const el=svg('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.75,
    'stroke-linecap':'round','stroke-linejoin':'round',class:cls,'aria-hidden':'true',focusable:'false'});
  for(const [t,a] of ICONS[name]??[])el.append(svg(t,a));
  return el;
}
let uid=0;
export const nextId=prefix=>`${prefix}-${++uid}`;

// ---------- feedback states ----------
export function loading(el,text='Loading public data…') {el.replaceChildren(h('div',{class:'state loading',role:'status'},h('span',{class:'spinner','aria-hidden':'true'}),text));}
export function empty(el,text) {el.replaceChildren(h('div',{class:'state empty'},text));}
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
export function download(name,rows) {
  const a=h('a',{href:URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'})),download:name});
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
// data: {headers, rows, numeric:Set of column indices, format(v,col)}; sortable when sort is true.
export function dataTable({headers,rows,numeric=new Set(),format=v=>v,caption,sort=true}) {
  let key=null,dir=1;
  const body=h('tbody');
  const ths=headers.map((label,i)=>h('th',{scope:'col',class:numeric.has(i)?'num':null,'aria-sort':'none'},
    sort?h('button',{type:'button',class:'sort',onclick:()=>{dir=key===i?-dir:(numeric.has(i)?-1:1);key=i;draw();}},label,h('span',{class:'sort-mark','aria-hidden':'true'})):label));
  const draw=()=>{
    const ordered=key==null?rows:rows.slice().sort((a,b)=>{const x=a[key],y=b[key];
      if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return (typeof x==='number'?x-y:String(x).localeCompare(String(y)))*dir;});
    ths.forEach((th,i)=>th.setAttribute('aria-sort',key===i?(dir>0?'ascending':'descending'):'none'));
    body.replaceChildren(...ordered.map(r=>h('tr',{},r.map((v,i)=>h(i===0?'th':'td',{class:numeric.has(i)?'num':null,...(i===0?{scope:'row'}:{})},v==null?'Not available':format(v,i))))));
  };
  draw();
  return h('div',{class:'table-wrap'},h('table',{},caption?h('caption',{},caption):null,h('thead',{},h('tr',{},ths)),body));
}

// ---------- menus and controls ----------
// items: [{label, icon, action}]. Opens below the button; Escape and outside clicks close it.
export function menu(items,label='More options') {
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
export function sourceBlock(meta) {
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
export function optionCard({icon:name,title,text,selected,onclick}) {
  return h('button',{type:'button',class:'option-card','aria-pressed':String(!!selected),onclick},
    h('span',{class:'option-head'},h('span',{class:'option-icon'},icon(name,16)),h('span',{class:'option-title'},title)),
    text?h('span',{class:'option-text'},text):null);
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
export function card(cls,...children) {return h('section',{class:`card ${cls??''}`},...children);}
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
export const countLabel=(v,unit)=>v==null?'Not available':`${int(v)}${unit?` ${unit}`:''}`;
