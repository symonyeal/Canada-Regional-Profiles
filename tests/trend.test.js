// Legend: s = synthetic annual series; Y = common years; m = annual measure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TRENDS,trend,combine,commonYears,parseRange,clampRange,rangeText,change,changeText,latest,calendar} from '../site/js/trend-model.js';
import {parse,serialize,withGeography} from '../site/js/state.js';

const s=(from,values)=>values.map((value,i)=>({year:from+i,value}));

test('annual calendar keeps omitted years, zeros and suppression at their own positions',()=>{
  assert.deepEqual(calendar([{year:2004,value:4},{year:2000,value:0},{year:2002,value:NaN}],[2000,2004]),s(2000,[0,null,null,null,4]));
  assert.deepEqual(calendar([],[2000,2000]),s(2000,[null]));
});

test('common years intersect finite observations, keep interior gaps out, and ignore areas publishing nothing',()=>{
  const a=s(2001,[1,2,3,4,5]),b=s(2003,[7,null,9,10]),none=s(2001,[null,null]);
  assert.deepEqual(commonYears([a,b]),[2003,2005]);
  assert.deepEqual(commonYears([a,b,none,[]]),[2003,2005]);
  assert.deepEqual(commonYears([a]),[2001,2002,2003,2004,2005]);
  assert.deepEqual(commonYears([s(2001,[1]),s(2010,[2])]),[]);
  assert.deepEqual(commonYears([]),[]);
  // Zero is an observation, not a gap.
  assert.deepEqual(commonYears([s(2001,[0,1]),s(2001,[2,0])]),[2001,2002]);
});
test('a requested range snaps to the nearest common years and orders its ends',()=>{
  const Y=[2001,2002,2005,2010];
  assert.deepEqual(clampRange(Y,null),[2001,2010]);
  assert.deepEqual(clampRange(Y,parseRange('1990-2004')),[2001,2005]);
  assert.deepEqual(clampRange(Y,[2010,2002]),[2002,2010]);
  assert.equal(clampRange([],[2001,2002]),null);
  assert.equal(parseRange('2001-25'),null);
  assert.equal(rangeText([2005,2005]),'2005');
});
test('counts change in per cent with a compound annual rate; rates change in points; missing ends stay missing',()=>{
  const k=change(s(2000,[100,null,121]),[2000,2002],'people');
  assert.equal(k.d.toFixed(6),'21.000000');assert.equal(k.rate.toFixed(6),'10.000000');
  assert.equal(changeText('people',k),'+21.0% (+10.0% a year)');
  assert.equal(changeText('%',change(s(2000,[6.5,5.0]),[2000,2001],'%')),'−1.5 pp');
  assert.equal(change(s(2000,[1,null]),[2000,2001],'%').d,null);
  assert.equal(changeText('%',{d:null}),'Not available');
  assert.equal(change(s(2000,[0,5]),[2000,2001],'people').d,null);
});
test('shares and rates divide published terms only',()=>{
  const share=trend('seniors'),rate=trend('immigration');
  assert.equal(combine(share,20,80),25);assert.equal(combine(rate,5,1000),5);
  assert.equal(combine(share,20,null),null);assert.equal(combine(share,null,80),null);assert.equal(combine(share,1,0),null);
  assert.equal(combine(trend('population'),0,undefined),0);
});
test('every annual measure names a table for each level it covers; population covers every Census level but population centres',()=>{
  for(const m of TRENDS)for(const [l,S] of Object.entries(m.source)){assert.ok(['PR','CMACA','CD','CSD','ER'].includes(l));
    for(const src of S)for(const t of [src.x,src.n].filter(Boolean))if(t.oecd)assert.match(t.oecd,/^DSD_REG_\w+@DF_\w+$/);else assert.match(t[0],/^\d{8}$/);}
  // OECD regions exist for Canada, provinces and territories, and census divisions only.
  for(const m of TRENDS.filter(m=>Object.values(m.source).flat().some(s=>s.x.oecd)))assert.ok(Object.keys(m.source).every(l=>['PR','CD'].includes(l)));
  assert.deepEqual(Object.keys(trend('population').source).sort(),['CD','CMACA','CSD','ER','PR']);
  // Economic regions read the 2021-boundary estimates, not the inactive 2016-boundary table.
  assert.equal(trend('population').source.ER[0].x[0],'17100150');
});
test('the annual measure and range are shared in URLs and survive a change of geography',()=>{
  const st=parse('?geo=2021A000246&tm=age&yr=2005-2024','#compare');
  assert.equal(st.t.tm,'age');assert.equal(st.t.yr,'2005-2024');
  assert.deepEqual(parse(serialize(st).split('#')[0],'#compare'),st);
  assert.equal(withGeography(st,{id:'2021A000235',type:'PR'}).t.yr,'2005-2024');
  assert.equal(parse('?tm=nonsense&yr=2005').t.tm,'population');assert.equal(parse('?yr=<x>').t.yr,'');
});
test('a slope fit is the least-squares trend per decade over the finite years in the range',()=>{
  // An exact line x = 5 + 0.03 t with a gap at 2005 has slope 0.3 per decade; endpoints alone would mislead
  // when the last year is an outlier, which the fit absorbs.
  const line=s(2000,[0,1,2,3,4,null,6].map(t=>t==null?null:5+0.03*t));
  assert.equal(change(line,[2000,2006],'°C','slope').d.toFixed(9),'0.300000000');
  assert.equal(changeText('°C',change(line,[2000,2006],'°C','slope')),'+0.30 °C per decade');
  const spike=s(2000,[5,5,5,5,5,5,9]),k=change(spike,[2000,2006],'°C','slope');
  assert.ok(k.d<change(spike,[2000,2006],'°C').d*10/6);
  assert.equal(change(s(2000,[1,2]),[2000,2001],'°C','slope').d,null);
  // Cohort ranks cover the same endpoints; an interior fit cannot substitute for a missing endpoint.
  assert.equal(change(s(2000,[null,1,2,3]),[2000,2003],'°C','slope').d,null);
  assert.equal(change(s(2000,[1,2,3,null]),[2000,2003],'°C','slope').d,null);
});
test('the latest standing compares every area in the selected area’s last year and measures change over at most k years',()=>{
  const m=trend('unemployment'),x=s(2018,[6,7,null,5,4]),b=s(2018,[5,5,5,5]),S=[s(2022,[3]),null,s(2018,[9,9,9,9,9])];
  const r=latest(m,x,b,S);
  assert.deepEqual([r.y,r.y0,r.x,r.w,r.X],[2022,2018,4,null,[3,null,9]]);
  assert.equal(r.change.d,-2);
  // The change starts at the first published year in [y − k, y): a gap at y − k moves it later.
  assert.equal(latest(m,x,null,null,2).y0,2021);
  assert.equal(latest(m,s(2020,[5]),null,null).change,null);
  assert.equal(latest(m,s(2020,[null]),null,null),null);
});
