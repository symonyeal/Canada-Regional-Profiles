// Exhibits drawn at their measured size. Each returns an element; a ResizeObserver redraws it on resize.
import {h,svg,showTip,hideTip,esc} from './ui.js';
import {niceTicks,luminance,int,compact,pct,PRIMARY,COMPARE,FILL} from './model.js';

// Redraw draw(width,height) into el whenever its box changes; disconnects when el leaves the document.
function responsive(el,draw) {
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
      s.append(svg('rect',{x:i*bw+bw*.18,y:H-bh,width:bw*.64,height:bh,rx:2,fill:PRIMARY}));});}
    else{const X=i=>i/(n-1)*w,Y=x=>H-4-(x-lo)/span*(H*.55);
      const segs=[];let cur=[];v.forEach((x,i)=>{if(x==null){if(cur.length)segs.push(cur);cur=[];}else cur.push([X(i),Y(x)]);});if(cur.length)segs.push(cur);
      for(const seg of segs){const d=seg.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
        s.append(svg('path',{d:`${d}L${seg.at(-1)[0]},${H}L${seg[0][0]},${H}Z`,fill:FILL}),svg('path',{d,fill:'none',stroke:PRIMARY,'stroke-width':1.5}));}}
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
      h('div',{class:'bar-track'},h('span',{class:'bar-fill',style:{width:`${w}%`,...(it.color?{background:it.color}:{})}}),b==null?null:h('span',{class:'bench-tick',style:{left:`${b}%`}})));
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
    for(const t of ticks){const y=T+ph-t/top*ph;s.append(svg('line',{x1:L,x2:w-R,y1:y,y2:y,stroke:'#e2e7df'}),svg('text',{x:L-8,y:y+4,'text-anchor':'end',class:'axis'},axisFmt(t)));}
    const gw=pw/categories.length,bw=Math.min(28,gw*.8/series.length);
    categories.forEach((c,i)=>{
      const x0=L+i*gw+(gw-bw*series.length-4*(series.length-1))/2;
      series.forEach((sr,j)=>{const v=sr.values[i];if(v==null)return;const bh=v/top*ph;
        const r=svg('rect',{x:x0+j*(bw+4),y:T+ph-bh,width:bw,height:bh,fill:sr.color,rx:2,tabindex:0,'aria-label':`${c}, ${sr.name}: ${fmt(v)}`});
        tipOn(r,`<b>${esc(c)}</b><br>${esc(sr.name)}: ${esc(fmt(v))}`);s.append(r);});
      const lx=L+i*gw+gw/2,show=turn||categories.length<=6||i%2===0||i===categories.length-1;
      if(show)s.append(turn?svg('text',{x:lx,y:T+ph+14,'text-anchor':'end',transform:`rotate(-32 ${lx} ${T+ph+14})`,class:'axis'},c):svg('text',{x:lx,y:T+ph+18,'text-anchor':'middle',class:'axis'},c));
    });
    s.append(svg('line',{x1:L,x2:w-R,y1:T+ph,y2:T+ph,stroke:'#c7d1c7'}));
    el.replaceChildren(s);
  });
}

// ---------- 100% stacked bars (household size, tenure) ----------
export function stacked(rows,categories,colors) {
  return h('div',{class:'stacked'},rows.map(r=>{
    const total=r.values.every(Number.isFinite)?r.values.reduce((a,b)=>a+b,0):null;
    return h('div',{class:'stack-row'},h('div',{class:'stack-label'},r.label),
      total?h('div',{class:'stack-bar'},r.values.map((v,i)=>{const p=100*v/total,seg=h('span',{class:'stack-seg',tabindex:0,
        style:{width:`${p}%`,background:colors[i],color:luminance(colors[i])>.179?'#000':'#fff'},'aria-label':`${r.label}, ${categories[i]}: ${pct(p)}`},p>=7?pct(p):'');
        tipOn(seg,`<b>${esc(r.label)}</b><br>${esc(categories[i])}: ${pct(p)}`);return seg;})):h('div',{class:'stack-bar missing'},'Not available'));
  }));
}

// ---------- line and column series ----------
// series: [{name, values, color, fmt?, width?, markers?}], drawn in order; markers: false draws a context line.
export function lines({x,series,fmt=compact,height=260,markers=true}) {
  const el=h('div',{class:'chart-svg',style:{height:`${height}px`},role:'img','aria-label':series.map(s=>`${s.name}: ${x.map((t,i)=>`${t} ${s.values[i]==null?'Not available':(s.fmt??fmt)(s.values[i])}`).join(', ')}`).join('. ')});
  return responsive(el,(w,H)=>{
    const vals=series.flatMap(s=>s.values).filter(Number.isFinite);if(!vals.length){el.replaceChildren();return;}
    const yt=niceTicks(Math.min(0,...vals),Math.max(...vals),4),L=Math.max(54,Math.min(112,Math.max(...yt.map(v=>fmt(v).length))*7+12)),R=16,T=10,B=26,pw=w-L-R,ph=H-T-B,n=x.length;
    const X=i=>L+(n<2?pw/2:i/(n-1)*pw),Y=v=>T+ph-(v-yt[0])/(yt.at(-1)-yt[0])*ph,s=svg('svg',{width:w,height:H});
    for(const t of yt)s.append(svg('line',{x1:L,x2:w-R,y1:Y(t),y2:Y(t),stroke:'#e2e7df'}),svg('text',{x:L-8,y:Y(t)+4,'text-anchor':'end',class:'axis'},fmt(t)));
    const step=Math.ceil(n/Math.max(2,Math.floor(pw/56)));x.forEach((t,i)=>{if(i%step===0&&n-1-i>=step/2||i===n-1)s.append(svg('text',{x:X(i),y:H-6,'text-anchor':'middle',class:'axis'},t));});
    for(const sr of series){let d='';sr.values.forEach((v,i)=>{if(v==null){d+=' ';return;}d+=`${d&&!d.endsWith(' ')?'L':'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`;});
      const path=svg('path',{d:d.replace(/ /g,''),fill:'none',stroke:sr.color,'stroke-width':sr.width??2});s.append(path);
      if(sr.markers===false){tipOn(path,`<b>${esc(sr.name)}</b>`);continue;}
      if(markers)sr.values.forEach((v,i)=>{if(v==null)return;const c=svg('circle',{cx:X(i),cy:Y(v),r:3.5,fill:'#fff',stroke:sr.color,'stroke-width':1.6,tabindex:0,'aria-label':`${sr.name} ${x[i]}: ${(sr.fmt??fmt)(v)}`});
        tipOn(c,`<b>${esc(sr.name)}</b><br>${esc(x[i])}: ${esc(sr.fmt?.(v)??fmt(v))}`);s.append(c);});}
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

// ---------- strip: one measure across a cohort ----------
// X: cohort values (faint dots); x: the selected area (filled dot); w: the benchmark (copper rule). The axis spans
// the cohort's 2nd to 98th percentiles widened to x and w, so one outlier does not flatten the rest; dots beyond it
// sit at the ends; the labels under it give the axis ends.
export function strip({X,x,w,format}) {
  const Y=X.filter(Number.isFinite).sort((a,b)=>a-b),at=t=>Y[Math.min(Y.length-1,Math.floor(t*Y.length))];
  const V=[...(Y.length?[at(.02),at(.98)]:[]),x,w].filter(Number.isFinite),lo=Math.min(...V),hi=Math.max(...V);
  const plot=h('div',{class:'strip-plot'});
  responsive(plot,width=>{
    const H=30,pad=7,S=v=>pad+(Math.min(hi,Math.max(lo,v))-lo)/((hi-lo)||1)*(width-2*pad),s=svg('svg',{width,height:H});
    s.append(svg('line',{x1:pad,x2:width-pad,y1:H/2,y2:H/2,stroke:'#c7d1c7'}));
    for(const v of Y)s.append(svg('circle',{cx:S(v),cy:H/2,r:3.5,fill:PRIMARY,'fill-opacity':.16}));
    if(Number.isFinite(w))s.append(svg('line',{x1:S(w),x2:S(w),y1:4,y2:H-4,stroke:COMPARE,'stroke-width':2}));
    if(Number.isFinite(x))s.append(svg('circle',{cx:S(x),cy:H/2,r:6.5,fill:PRIMARY,stroke:'#fff','stroke-width':2}));
    plot.replaceChildren(s);
  });
  return h('div',{class:'strip','aria-hidden':'true'},plot,V.length?h('div',{class:'strip-ends'},h('span',{},format(lo)),h('span',{},format(hi))):null);
}
