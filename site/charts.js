import {esc,fmt,csv} from './model.js';
export const COLORS=['#087e83','#c18a36','#163e38','#86a99b','#847ca3','#c06c53','#4e7593','#a9b757'];
let serial=0;
export function download(name,rows) {
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}));
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function sourceLink(url,label) {return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;}
export function table(headers,rows) {
  return `<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>
    `<tr>${row.map(v=>`<td>${esc(v==null?'Not available':v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export function card(root,{title,subtitle='',wide=false}) {
  const node=document.createElement('article');node.className='card'+(wide?' wide':'');
  node.innerHTML=`<div class="card-head"><div><h3>${esc(title)}</h3>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div>`;
  root.append(node);return node;
}
export function chart(root,{title,subtitle='',data=[],layout={},headers=['Category','Value'],rows=[],source='',wide=false,unit=''}) {
  const node=card(root,{title,subtitle,wide}),el=document.createElement('div');el.className='chart';el.id=`chart-${++serial}`;
  el.setAttribute('role','img');el.setAttribute('aria-label',`${title}. Values available in the data table below.`);node.append(el);
  if(!rows.length || rows.every(r=>r.slice(1).every(v=>v==null))) el.innerHTML='<div class="empty">No published values for this selection. Suppressed observations are not zero.</div>';
  else if(!window.Plotly) el.innerHTML='<div class="empty">The chart library could not load. The data table below remains available.</div>';
  else {
    const narrow=innerWidth<700;
    Plotly.newPlot(el,data,{paper_bgcolor:'#fff',plot_bgcolor:'#fff',colorway:COLORS,
      font:{family:'DM Sans, Segoe UI, sans-serif',size:11,color:'#40584e'},
      margin:{t:20,b:45,l:55,r:25},height:340,showlegend:false,hoverlabel:{font:{size:12}},
      ...layout,xaxis:{gridcolor:'#e8eeea',zerolinecolor:'#cbd6d0',automargin:true,...layout.xaxis},
      yaxis:{gridcolor:'#e8eeea',automargin:true,...layout.yaxis}},
    {responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d'],displayModeBar:!narrow});
  }
  const foot=document.createElement('p');foot.className='source';foot.innerHTML=source;node.append(foot);
  const detail=document.createElement('details');detail.innerHTML=`<summary>View data table &amp; download CSV</summary>${table(headers,rows.map(r=>r.map(v=>typeof v==='number'?fmt(v,unit):v)))}`;
  const button=document.createElement('button');button.className='download';button.textContent='Download these values ↓';
  button.onclick=()=>download(title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv',[[title,subtitle],[source.replace(/<[^>]*>/g,'')],headers,...rows]);
  detail.append(button);node.append(detail);return node;
}
export function bars(root,{title,subtitle='',items,source='',unit='',wide=false,sort=false,comparison=false}) {
  let rows=items.map(x=>[x.name,x.value,...(comparison?[x.benchmark]:[])]);
  if(sort) rows=rows.sort((a,b)=>(b[1]??-Infinity)-(a[1]??-Infinity));
  const reversed=rows.slice().reverse(),hasComparison=comparison&&rows.some(r=>r[2]!=null);
  return chart(root,{title,subtitle,rows,source,wide,unit,headers:['Category','Selected region',...(comparison?['Benchmark']:[])],
    data:[{type:'bar',orientation:'h',y:reversed.map(r=>r[0]),x:reversed.map(r=>r[1]),
      marker:{color:COLORS[0]},name:'Selected region',hovertemplate:`%{y}<br>%{x:,.1f}${unit==='%'?'%':''}<extra></extra>`},
    ...(hasComparison?[{type:'bar',orientation:'h',y:reversed.map(r=>r[0]),x:reversed.map(r=>r[2]),
      marker:{color:COLORS[1]},name:'Benchmark',hovertemplate:`%{y}<br>%{x:,.1f}${unit==='%'?'%':''}<extra>Benchmark</extra>`}]:[])],
    layout:{height:Math.max(310,80+rows.length*(hasComparison?43:29)),barmode:'group',showlegend:hasComparison,
      legend:{orientation:'h',y:1.15},margin:{l:12,r:20,t:30,b:45},
      yaxis:{tickfont:{size:10},tickmode:'array',tickvals:reversed.map(r=>r[0]),
        ticktext:reversed.map(r=>r[0].length>40?r[0].match(/.{1,36}(?:\s|$)|\S+/g)?.join('<br>')??r[0]:r[0])},
      xaxis:{title:{text:unit==='%'?'Share (%)':unit==='$'?'Canadian dollars':'People / observations'}}}});
}
export function distribution(root,p,b,parent,title,{gender='1',share=true,source='',wide=false}={}) {
  const children=p.children(parent),get=(q,id)=>share?q.share(id,String(parent),gender):q.value(id,gender);
  bars(root,{title,subtitle:share?'Share of the stated population; benchmark uses the same denominator.':'Published counts',
    items:children.map(c=>({name:c.name,value:get(p,c.id),benchmark:b?get(b,c.id):null})),source,unit:share?'%':'',wide,comparison:!!b});
}
export function tiles(root,items) {
  const el=document.createElement('div');el.className='tiles';el.innerHTML=items.map(x=>`<div class="tile"><span class="label">${esc(x.label)}</span>
    <strong>${esc(fmt(x.value,x.unit))}</strong><small>${esc(x.note??'')}${x.benchmark!=null?` · Benchmark ${esc(fmt(x.benchmark,x.unit))}`:''}</small></div>`).join('');root.append(el);
}
export function heading(root,title,description,tag='2021 Census · live API') {
  const el=document.createElement('div');el.className='section-head';el.innerHTML=`<div><p class="eyebrow">REGIONAL PROFILE</p><h2>${esc(title)}</h2><p>${esc(description)}</p></div><span class="tag">${esc(tag)}</span>`;root.append(el);
}
export function notice(root,text,warning=false) {const el=document.createElement('div');el.className='notice'+(warning?' warning':'');el.textContent=text;root.append(el);return el;}
export function controls(root,fields,onchange) {
  const el=document.createElement('div');el.className='controls';
  for(const field of fields) {const label=document.createElement('label');label.append(document.createTextNode(field.label));
    const input=document.createElement('select');input.dataset.control=field.key;
    for(const [value,text] of field.options) {const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);}
    input.value=field.value;input.onchange=()=>onchange(field.key,input.value);label.append(input);el.append(label);
  }
  root.append(el);return el;
}
export function loading(root,text='Querying the public source…') {root.innerHTML=`<div class="loading" role="status">${esc(text)}</div>`;}
export function failure(root,error,retry) {
  root.innerHTML=`<div class="error" role="alert"><h3>This source could not supply the selection</h3><p>${esc(error.message)}</p></div>`;
  const b=document.createElement('button');b.className='button';b.textContent='Retry live request';b.onclick=retry;root.firstChild.append(b);
}
