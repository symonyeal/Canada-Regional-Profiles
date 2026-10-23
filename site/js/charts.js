// Exhibits drawn at their measured size. Each returns an element; a ResizeObserver redraws it on resize.
import {h,svg,showTip,hideTip,esc} from './ui.js';
import {niceTicks,squarify,ramp,luminance,int,compact,pct} from './model.js';

export const BROWN='#473729',GOLD='#7d622e',FILL='#f4ebe4',TRACK='#f2f4f7',INK='#0f1622',MUTED='#667085';
export const BROWNS=['#473729','#6b5a4b','#8b7e72','#a99f95','#c6beb5','#ded5cc','#f1e9e2'];

// Redraw draw(width,height) into el whenever its box changes; disconnects when el leaves the document.
export function responsive(el,draw) {
  let w=0,hgt=0;
  const ro=new ResizeObserver(([e])=>{
    if(!el.isConnected){ro.disconnect();return;}
    const {width,height}=e.contentRect;if(Math.abs(width-w)<1&&Math.abs(height-hgt)<1)return;w=width;hgt=height;
    if(width>0)draw(width,height);
  });
  ro.observe(el);return el;
}
const tipOn=(node,html)=>{node.addEventListener('pointermove',e=>showTip(e,html));node.addEventListener('pointerleave',hideTip);
  node.addEventListener('focus',()=>{const r=node.getBoundingClientRect();showTip({clientX:r.left+r.width/2,clientY:r.top},html);});node.addEventListener('blur',hideTip);};

// ---------- KPI sparklines ----------
export function spark(values,kind='area') {
  const el=h('div',{class:'spark','aria-hidden':'true'});
  return responsive(el,(w)=>{
    const H=44,v=values.map(p=>p.value),fin=v.filter(Number.isFinite);el.replaceChildren();if(fin.length<2)return;
    const lo=Math.min(...fin),hi=Math.max(...fin),span=hi-lo||1,n=v.length,s=svg('svg',{width:w,height:H,viewBox:`0 0 ${w} ${H}`});
    if(kind==='bars'){const bw=w/n,base=lo-span*.6;v.forEach((x,i)=>{if(x==null)return;const bh=Math.max(2,(x-base)/(hi-base)*(H-2));
      s.append(svg('rect',{x:i*bw+bw*.18,y:H-bh,width:bw*.64,height:bh,rx:2,fill:BROWN}));});}
    else{const X=i=>i/(n-1)*w,Y=x=>H-4-(x-lo)/span*(H*.55);
      const segs=[];let cur=[];v.forEach((x,i)=>{if(x==null){if(cur.length)segs.push(cur);cur=[];}else cur.push([X(i),Y(x)]);});if(cur.length)segs.push(cur);
      for(const seg of segs){const d=seg.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
        s.append(svg('path',{d:`${d}L${seg.at(-1)[0]},${H}L${seg[0][0]},${H}Z`,fill:FILL}),svg('path',{d,fill:'none',stroke:BROWN,'stroke-width':1.5}));}}
    el.append(s);
  });
}

// ---------- bar list (reference "inverted-bar") ----------
// items: [{label, value, text, bench, benchText}]; values share one scale from 0 to max.
export function barList(items,{max,benchName,size='md'}={}) {
  const top=max??(Math.max(...items.flatMap(i=>[i.value,i.bench]).filter(Number.isFinite),0)||1);
  return h('div',{class:`bar-list ${size}`,role:'list'},items.map(it=>{
    const w=it.value==null?0:Math.max(0,100*it.value/top),b=it.bench==null?null:Math.min(100,100*it.bench/top);
    const row=h('div',{class:'bar-row',role:'listitem',tabindex:0,'aria-label':`${it.label}: ${it.text??'Not available'}${it.benchText?`; ${benchName}: ${it.benchText}`:''}`},
      h('div',{class:'bar-head'},h('span',{class:'bar-label'},it.label),h('span',{class:'bar-value'},it.text??'Not available')),
      h('div',{class:'bar-track'},h('span',{class:'bar-fill',style:{width:`${w}%`}}),b==null?null:h('span',{class:'bench-tick',style:{left:`${b}%`}})));
    tipOn(row,`<b>${esc(it.label)}</b><br>${esc(it.text??'Not available')}${it.benchText?`<br>${esc(benchName)}: ${esc(it.benchText)}`:''}`);
    return row;
  }));
}
export function legend(items) {
  return h('div',{class:'legend'},items.map(([label,color,kind])=>h('span',{class:'legend-item'},h('i',{class:kind??'swatch',style:{'--c':color}}),label)));
}

// ---------- grouped columns ----------
// categories: labels; series: [{name, values, color}]; fmt formats axis and tooltip values.
export function columns({categories,series,fmt=v=>pct(v),axisFmt=fmt,height=320,rotate=false}) {
  const el=h('div',{class:'chart-svg',style:{height:`${height}px`},role:'img','aria-label':series.map(s=>`${s.name}: `+categories.map((c,i)=>`${c} ${fmt(s.values[i])}`).join(', ')).join('. ')});
  return responsive(el,(w,H)=>{
    const vals=series.flatMap(s=>s.values).filter(Number.isFinite),ticks=niceTicks(0,Math.max(...vals,0)||1,5),top=ticks.at(-1);
    // Rotate category labels when the widest label would not fit its column.
    const turn=rotate||Math.max(...categories.map(c=>c.length))*6.2>(w-54)/categories.length;
    const L=46,R=8,T=10,B=turn?62:30,pw=w-L-R,ph=H-T-B,s=svg('svg',{width:w,height:H});
    for(const t of ticks){const y=T+ph-t/top*ph;s.append(svg('line',{x1:L,x2:w-R,y1:y,y2:y,stroke:'#eaecf0'}),svg('text',{x:L-8,y:y+4,'text-anchor':'end',class:'axis'},axisFmt(t)));}
    const gw=pw/categories.length,bw=Math.min(28,gw*.8/series.length);
    categories.forEach((c,i)=>{
      const x0=L+i*gw+(gw-bw*series.length-4*(series.length-1))/2;
      series.forEach((sr,j)=>{const v=sr.values[i];if(v==null)return;const bh=v/top*ph;
        const r=svg('rect',{x:x0+j*(bw+4),y:T+ph-bh,width:bw,height:bh,fill:sr.color,rx:2,tabindex:0,'aria-label':`${c}, ${sr.name}: ${fmt(v)}`});
        tipOn(r,`<b>${esc(c)}</b><br>${esc(sr.name)}: ${esc(fmt(v))}`);s.append(r);});
      const lx=L+i*gw+gw/2,show=turn||categories.length<=6||i%2===0||i===categories.length-1;
      if(show)s.append(turn?svg('text',{x:lx,y:T+ph+14,'text-anchor':'end',transform:`rotate(-32 ${lx} ${T+ph+14})`,class:'axis'},c):svg('text',{x:lx,y:T+ph+18,'text-anchor':'middle',class:'axis'},c));
    });
    s.append(svg('line',{x1:L,x2:w-R,y1:T+ph,y2:T+ph,stroke:'#d0d5dd'}));
    el.replaceChildren(s);
  });
}

// ---------- 100% stacked bars (household size, tenure) ----------
export function stacked(rows,categories,colors) {
  return h('div',{class:'stacked'},rows.map(r=>{
    const total=r.values.every(Number.isFinite)?r.values.reduce((a,b)=>a+b,0):null;
    return h('div',{class:'stack-row'},h('div',{class:'stack-label'},r.label),
      total?h('div',{class:'stack-bar'},r.values.map((v,i)=>{const p=100*v/total,seg=h('span',{class:'stack-seg',tabindex:0,
        style:{width:`${p}%`,background:colors[i],color:luminance(colors[i])>.35?INK:'#fff'},'aria-label':`${r.label}, ${categories[i]}: ${pct(p)}`},p>=7?pct(p):'');
        tipOn(seg,`<b>${esc(r.label)}</b><br>${esc(categories[i])}: ${pct(p)}`);return seg;})):h('div',{class:'stack-bar missing'},'Not available'));
  }));
}

// ---------- treemap ----------
// items: [{label, value, text, group, groupLabel}]; grouped: tiles nest in labelled group blocks.
export function treemap(items,{grouped=false,height=560,tooltip=it=>`<b>${esc(it.label)}</b><br>${esc(it.text)}`}={}) {
  const el=h('div',{class:'treemap',style:{height:height==='fill'?'100%':`${height}px`},role:'list','aria-label':'Treemap'});
  const data=items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value);
  return responsive(el,(w,H)=>{
    el.replaceChildren();const gap=4;
    const tile=(it,r,color)=>{if(r.w<2||r.h<2)return;const t=h('div',{class:'tile',role:'listitem',tabindex:0,'aria-label':`${it.label}: ${it.text}`,
      style:{left:`${r.x+gap/2}px`,top:`${r.y+gap/2}px`,width:`${r.w-gap}px`,height:`${r.h-gap}px`,background:color,color:luminance(color)>.3?INK:'#fff'}},
      r.w>44&&r.h>30?[h('span',{class:'tile-label'},it.label),h('span',{class:'tile-value'},it.text)]:null);tipOn(t,tooltip(it));el.append(t);};
    if(!grouped){const colors=ramp(BROWNS,Math.max(2,data.length));squarify(data.map(d=>d.value),0,0,w,H).forEach((r,i)=>tile(data[i],r,colors[i]));return;}
    const groups=[...data.reduce((m,d)=>m.set(d.group,[...(m.get(d.group)??[]),d]),new Map())].map(([g,list])=>({g,list,label:list[0].groupLabel,value:list.reduce((s,d)=>s+d.value,0)}))
      .sort((a,b)=>b.value-a.value),colors=ramp(BROWNS.slice(0,6),Math.max(2,groups.length));
    squarify(groups.map(g=>g.value),0,0,w,H).forEach((r,gi)=>{
      const g=groups[gi],head=r.h>60&&r.w>60?18:0;
      if(head)el.append(h('div',{class:'group-label',style:{left:`${r.x+2}px`,top:`${r.y}px`,width:`${r.w-4}px`}},g.label));
      squarify(g.list.map(d=>d.value),r.x,r.y+head,r.w,r.h-head).forEach((c,i)=>tile(g.list[i],c,colors[gi]));
    });
  });
}

// ---------- bubble chart with drag-to-zoom ----------
// points: [{x, y, size, label, fill, stroke, html}]
export function bubbles(points,{xLabel,yLabel,height=470,xFmt=compact,yFmt=compact,sizeFactor=25}) {
  const el=h('div',{class:'chart-svg bubbles',style:{height:height==='fill'?'100%':`${height}px`},role:'img','aria-label':`${points.length} industries plotted by ${xLabel} and ${yLabel}. The list view gives every value.`});
  let view=null;const reset=h('button',{type:'button',class:'btn ghost small zoom-reset',hidden:true,onclick:()=>{view=null;reset.hidden=true;redraw();}},'Reset zoom');
  const wrap=h('div',{class:'bubble-wrap'},el,reset);let redraw=()=>{};
  responsive(el,(w,H)=>{redraw=()=>{
    const pts=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));el.replaceChildren();if(!pts.length)return;
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),[x0,x1]=view?.x??[Math.min(0,...xs),Math.max(...xs)*1.1],[y0,y1]=view?.y??[0,Math.max(...ys)*1.18];
    const xt=niceTicks(x0,x1,7),yt=niceTicks(y0,y1,5),L=60,R=16,T=12,B=50,pw=w-L-R,ph=H-T-B;
    const X=v=>L+(v-xt[0])/(xt.at(-1)-xt[0])*pw,Y=v=>T+ph-(v-yt[0])/(yt.at(-1)-yt[0])*ph;
    const smax=Math.max(...pts.map(p=>p.size??0),1),rad=p=>Math.max(4,Math.sqrt((p.size??0)/smax)*sizeFactor*Math.min(1,w/700)+4);
    const s=svg('svg',{width:w,height:H});
    for(const t of xt)s.append(svg('line',{x1:X(t),x2:X(t),y1:T,y2:T+ph,stroke:'#f0f1f3'}),svg('text',{x:X(t),y:T+ph+18,'text-anchor':'middle',class:'axis'},xFmt(t)));
    for(const t of yt)s.append(svg('line',{x1:L,x2:w-R,y1:Y(t),y2:Y(t),stroke:'#f0f1f3'}),svg('text',{x:L-8,y:Y(t)+4,'text-anchor':'end',class:'axis'},yFmt(t)));
    s.append(svg('text',{x:L+pw/2,y:H-8,'text-anchor':'middle',class:'axis-title'},xLabel),svg('text',{x:14,y:T+ph/2,'text-anchor':'middle',class:'axis-title',transform:`rotate(-90 14 ${T+ph/2})`},yLabel));
    const clip=svg('clipPath',{id:`clip-${w|0}`},svg('rect',{x:L,y:T,width:pw,height:ph}));s.append(svg('defs',{},clip));
    const g=svg('g',{'clip-path':`url(#clip-${w|0})`});
    for(const p of pts.slice().sort((a,b)=>(b.size??0)-(a.size??0))){const c=svg('circle',{cx:X(p.x),cy:Y(p.y),r:rad(p),fill:p.fill,stroke:p.stroke??'#3b2e23','stroke-width':1.2,'fill-opacity':.92,tabindex:0,'aria-label':p.label});
      tipOn(c,p.html);g.append(c);}
    s.append(g);
    // Drag a rectangle to zoom into the plotted range.
    let start=null;const band=svg('rect',{fill:'rgba(71,55,41,.08)',stroke:BROWN,'stroke-dasharray':'4 3',visibility:'hidden'});s.append(band);
    s.addEventListener('pointerdown',e=>{const b=s.getBoundingClientRect();start=[e.clientX-b.left,e.clientY-b.top];s.setPointerCapture(e.pointerId);});
    s.addEventListener('pointermove',e=>{if(!start)return;const b=s.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
      band.setAttribute('x',Math.min(x,start[0]));band.setAttribute('y',Math.min(y,start[1]));band.setAttribute('width',Math.abs(x-start[0]));band.setAttribute('height',Math.abs(y-start[1]));band.setAttribute('visibility','visible');});
    s.addEventListener('pointerup',e=>{if(!start)return;const b=s.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,[sx,sy]=start;start=null;band.setAttribute('visibility','hidden');
      if(Math.abs(x-sx)<12||Math.abs(y-sy)<12)return;
      const vx=[Math.min(x,sx),Math.max(x,sx)].map(px=>xt[0]+(px-L)/pw*(xt.at(-1)-xt[0])),vy=[Math.max(y,sy),Math.min(y,sy)].map(py=>yt[0]+(T+ph-py)/ph*(yt.at(-1)-yt[0]));
      view={x:vx,y:vy};reset.hidden=false;redraw();});
    el.append(s);
  };redraw();});
  return wrap;
}

// ---------- line and column series ----------
export function lines({x,series,fmt=compact,height=260,markers=true}) {
  const el=h('div',{class:'chart-svg',style:{height:`${height}px`},role:'img','aria-label':series.map(s=>`${s.name}: ${x.map((t,i)=>`${t} ${fmt(s.values[i])}`).join(', ')}`).join('. ')});
  return responsive(el,(w,H)=>{
    const vals=series.flatMap(s=>s.values).filter(Number.isFinite);if(!vals.length){el.replaceChildren();return;}
    const yt=niceTicks(Math.min(0,...vals),Math.max(...vals),4),L=54,R=12,T=10,B=26,pw=w-L-R,ph=H-T-B,n=x.length;
    const X=i=>L+(n<2?pw/2:i/(n-1)*pw),Y=v=>T+ph-(v-yt[0])/(yt.at(-1)-yt[0])*ph,s=svg('svg',{width:w,height:H});
    for(const t of yt)s.append(svg('line',{x1:L,x2:w-R,y1:Y(t),y2:Y(t),stroke:'#eaecf0'}),svg('text',{x:L-8,y:Y(t)+4,'text-anchor':'end',class:'axis'},fmt(t)));
    const step=Math.ceil(n/Math.max(2,Math.floor(pw/56)));x.forEach((t,i)=>{if(i%step===0||i===n-1)s.append(svg('text',{x:X(i),y:H-6,'text-anchor':'middle',class:'axis'},t));});
    for(const sr of series){let d='';sr.values.forEach((v,i)=>{if(v==null){d+=' ';return;}d+=`${d&&!d.endsWith(' ')?'L':'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`;});
      s.append(svg('path',{d:d.replace(/ /g,''),fill:'none',stroke:sr.color,'stroke-width':2}));
      if(markers)sr.values.forEach((v,i)=>{if(v==null)return;const c=svg('circle',{cx:X(i),cy:Y(v),r:3.5,fill:'#fff',stroke:sr.color,'stroke-width':1.6,tabindex:0,'aria-label':`${sr.name} ${x[i]}: ${fmt(v)}`});
        tipOn(c,`<b>${esc(sr.name)}</b><br>${esc(x[i])}: ${esc(sr.fmt?.(v)??fmt(v))}`);s.append(c);});}
    el.replaceChildren(s);
  });
}

// Monthly climate normals: precipitation columns (left axis) with daily high and low lines (right axis).
export function climate({precip,high,low,height=430}) {
  const months=['J','F','M','A','M','J','J','A','S','O','N','D'],names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const el=h('div',{class:'chart-svg',style:{height:`${height}px`},role:'img','aria-label':names.map((m,i)=>`${m}: precipitation ${precip[i]??'n/a'} mm, high ${high[i]??'n/a'} °C, low ${low[i]??'n/a'} °C`).join('; ')});
  return responsive(el,(w,H)=>{
    const pv=precip.filter(Number.isFinite),tv=[...high,...low].filter(Number.isFinite);if(!pv.length&&!tv.length){el.replaceChildren();return;}
    const pt=niceTicks(0,Math.max(...pv,1),4),tt=niceTicks(Math.min(...tv,0),Math.max(...tv,1),4),L=40,R=40,T=10,B=26,pw=w-L-R,ph=H-T-B,gw=pw/12;
    const Yp=v=>T+ph-v/pt.at(-1)*ph,Yt=v=>T+ph-(v-tt[0])/(tt.at(-1)-tt[0])*ph,X=i=>L+gw*i+gw/2,s=svg('svg',{width:w,height:H});
    for(const t of pt)s.append(svg('line',{x1:L,x2:w-R,y1:Yp(t),y2:Yp(t),stroke:'#eaecf0'}),svg('text',{x:L-8,y:Yp(t)+4,'text-anchor':'end',class:'axis'},t));
    for(const t of tt)s.append(svg('text',{x:w-R+8,y:Yt(t)+4,class:'axis'},t));
    precip.forEach((v,i)=>{if(v==null)return;const r=svg('rect',{x:X(i)-gw*.28,y:Yp(v),width:gw*.56,height:T+ph-Yp(v),fill:'#aab9ef',rx:2,tabindex:0,'aria-label':`${names[i]} precipitation ${v} mm`});
      tipOn(r,`<b>${names[i]}</b><br>Precipitation: ${v} mm<br>High: ${high[i]??'n/a'} °C<br>Low: ${low[i]??'n/a'} °C`);s.append(r);});
    for(const [vals,color] of [[high,'#e8b04b'],[low,'#d0632a']]){let d='';vals.forEach((v,i)=>{if(v!=null)d+=`${d?'L':'M'}${X(i)},${Yt(v)}`;});
      s.append(svg('path',{d,fill:'none',stroke:color,'stroke-width':1.8}));vals.forEach((v,i)=>{if(v!=null)s.append(svg('circle',{cx:X(i),cy:Yt(v),r:3,fill:'#fff',stroke:color,'stroke-width':1.5}));});}
    months.forEach((m,i)=>s.append(svg('text',{x:X(i),y:H-6,'text-anchor':'middle',class:'axis'},m)));
    el.replaceChildren(s);
  });
}

// Education levels: share bars on a fixed 0-100% axis with the label inside the track.
export function shareBars(items) {
  return h('div',{class:'share-bars'},items.map(it=>{const row=h('div',{class:'share-row',tabindex:0,'aria-label':`${it.label}: ${pct(it.value)}`},
      h('div',{class:'share-track'},h('span',{class:'share-fill',style:{width:`${it.value??0}%`}}),h('span',{class:'share-label'},it.label)),
      h('span',{class:'share-value'},it.value==null?'n/a':pct(it.value)));tipOn(row,`<b>${esc(it.label)}</b><br>${pct(it.value)} · ${int(it.count)} people`);return row;}),
    h('div',{class:'share-axis','aria-hidden':'true'},['0%','25%','50%','75%','100%'].map(t=>h('span',{},t))));
}
