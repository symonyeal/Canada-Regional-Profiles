// Legend: r = synthetic industry row; g = selected geography; m = Census measure; P = synthetic cohort profiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {industryRows,peerIds,MEASURES,MEASURE_IDS,difference,show,standing,rankText,findings,similar,sectorBase,shiftShare,SECTOR_IDS} from '../site/js/regional-model.js';
import {parse,serialize,withGeography,SECTIONS} from '../site/js/state.js';
import {PROFILE_IDS} from '../site/js/census.js';

// A profile from {characteristic: value}; names for sector characteristics.
const profile=(v,names={})=>({value:id=>v[id]??null,name:id=>names[id]??null});

test('rate differences are percentage points; money is a dollar difference; suppression remains missing',()=>{
  const m=MEASURES.find(m=>m.id==='employment'),money=MEASURES.find(m=>m.id==='income');
  assert.equal(difference(m,58.1,60.2),'−2.1 pp');
  assert.equal(difference(m,0,0),'0.0 pp');
  assert.equal(difference(m,null,0),'Not available');
  assert.equal(show(m,null),'Not published');
  assert.equal(difference(money,97000,92000),'+$5,000');
});
test('peers are deduplicated, bounded, same-level and exclude the selected area and Canada',()=>{
  const g={id:'2021A000246',type:'PR'};
  assert.deepEqual(peerIds('2021A000246,2021A000235,2021A000235,2021A000011124,2021A00054611040,2021A000259',g),['2021A000235','2021A000259']);
  const s=parse('?geo=2021A000246&peers=2021A000235,2021A000259&iv=change','#compare');
  assert.deepEqual(parse(serialize(s).split('#')[0],'#compare'),s);
  assert.equal(withGeography(s,{id:'2021A00054611040',type:'CSD'}).t.peers,'');
  assert.equal(parse('?peers=../../x').t.peers,'');
});
test('industry change includes both gains and losses, preserves missing history and separates specialization',()=>{
  const rows=[{code:'1',value:200,absolute:50,lq:1,traded:true},{code:'2',value:300,absolute:-100,lq:2,traded:false},
    {code:'3',value:1000,absolute:null,lq:null,traded:null},{code:'4',value:10,absolute:-10,lq:3,traded:true}];
  assert.deepEqual(industryRows(rows,'largest').map(r=>r.code),['3','2','1','4']);
  assert.deepEqual(industryRows(rows,'change').map(r=>r.code),['1','2','4']);
  assert.deepEqual(industryRows(rows,'specialized').map(r=>r.code),['4','2','1']);
  assert.deepEqual(industryRows(rows,'change','local').map(r=>r.code),['2']);
});
test('legacy sections reach the consolidated view and retain relevant selections',()=>{
  assert.deepEqual(SECTIONS,['overview','industries','compare','detail']);
  assert.equal(parse('','#growing').t.iv,'change');
  assert.equal(parse('?cp=dwelling','#profile').t.dv,'dwelling');
  assert.equal(parse('?cp=dwelling','#profile').section,'detail');
  assert.equal(parse('?cp=economic','#profile').section,'overview');
  assert.equal(parse('?hv=livability','#housing').t.dv,'livability');
  assert.equal(parse('?pv=workforce','#people').t.dv,'workforce');
  assert.equal(parse('','#workforce').t.dv,'workforce');
  assert.equal(parse('','#market').t.map,'market');
  assert.equal(parse('','#logistics').section,'overview');
  assert.equal(parse('','#talent').section,'overview');
});
test('every measure characteristic is requested with the single-area profile',()=>{
  const ids=new Set(PROFILE_IDS);for(const id of [...MEASURE_IDS,...SECTOR_IDS,'2261'])assert.ok(ids.has(id),id);
});
test('standing counts published values only; ties share the better rank and half the mass',()=>{
  assert.deepEqual(standing(3,[1,2,3,3,5,null]),{q:.6,high:2,low:3,n:5});
  assert.equal(rankText(standing(5,[1,2,3,5])),'highest of 4');
  assert.equal(rankText(standing(2,[1,2,3,5])),'2nd lowest of 4');
  assert.equal(rankText(standing(3,[1,2,3,4,5,6,7,8,9,10,11,12].map(x=>-x).concat([3]))),'highest of 13');
  assert.equal(standing(null,[1,2]),null);assert.equal(standing(1,[null]),null);
});
test('the headline keeps the most distinctive measure of each theme, most distinctive first',()=>{
  // Growth is the extreme of its cohort; median age sits at the middle; the other measures are unpublished.
  const p=profile({'3':9,'40':40}),b=profile({'3':5,'40':41});
  const P=[1,2,3,4,9].map((g,i)=>profile({'3':g,'40':[30,35,40,45,50][i]}));
  const F=findings(p,b,P);
  assert.deepEqual(F.rows.map(r=>r.m.id),['growth','age']);
  assert.deepEqual(F.headline.map(r=>r.m.id),['growth']);
  assert.equal(F.headline[0].standing.high,1);assert.equal(F.headline[0].w,5);
  assert.equal(findings(p,b,null).headline[0].d,null);
});
test('national findings rank measures by the provinces’ coefficient of variation',()=>{
  const P=[profile({'3':4,'2229':50}),profile({'3':6,'2229':60}),profile({'3':-2,'2229':55})];
  const F=findings(profile({'3':5,'2229':57}),null,P,{national:true});
  assert.deepEqual(F.headline.map(r=>r.m.id),['growth','employment']);
  assert.equal(F.headline[0].standing,null);
});
test('similar areas: nearest by standardised features, skipping areas that publish too little',()=>{
  const row=(pop,growth,age,emp,inc,rent,deg,imm,ind)=>profile({'1':pop,'3':growth,'40':age,'2229':emp,'229':inc,'1402':rent,'1400':100,'2024':deg,'2014':100,'1515':imm,'1513':100,'1389':ind,'1388':100});
  const P=[row(1000,5,40,60,80000,30,20,10,5),row(1100,5,41,61,82000,31,21,10,5),row(50000,-3,30,40,40000,60,50,40,1),row(1000,null,null,null,null,null,null,null,null)];
  const s=similar(P,0,3);
  assert.deepEqual(s.map(x=>x.j),[1,2]);assert.ok(s[0].distance<s[1].distance);
});
test('sector base: LQ, workers beyond the benchmark share, and the mix difference D',()=>{
  const v={'2261':100},V={'2261':1000};SECTOR_IDS.forEach((id,i)=>{v[id]=i===0?50:i===1?50:0;V[id]=i===0?100:i===1?100:i<10?100:0;});
  const r=sectorBase(profile(v,{'2262':'11 Agriculture'}),profile(V));
  assert.equal(r.rows[0].name,'Agriculture');assert.equal(r.rows[0].lq,5);assert.equal(r.rows[0].excess,40);
  assert.equal(Math.round(r.D*100)/100,.8);
  delete v['2270'];assert.equal(sectorBase(profile(v),profile(V)).D,null);
});
test('shift-share effects add up to each sector’s change; suppressed sectors are unattributed',()=>{
  const rows=[{code:'23',e0:100,e1:130,E0:1000,E1:1200},{code:'62',e0:200,e1:210,E0:2000,E1:2100},{code:'21',e0:null,e1:40,E0:500,E1:500}];
  const F=shiftShare(rows,{e0:330,e1:380,E0:3500,E1:3800});
  for(const r of F.rows.filter(r=>r.change!=null))assert.ok(Math.abs(r.NS+r.IM+r.RS-r.change)<1e-9);
  assert.ok(Math.abs(F.G-300/3500)<1e-12);assert.equal(F.published,2);
  assert.ok(Math.abs(F.NS+F.IM+F.RS+F.unattributed-50)<1e-9);
  assert.equal(F.rows[2].NS,null);
  // Sector 23: G_i = 20 %, g_i = 30 %: RS = 100 × 10 % = 10.
  assert.ok(Math.abs(F.rows[0].RS-10)<1e-9);
});
