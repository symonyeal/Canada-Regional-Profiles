// Legend: r = synthetic industry row; g = selected geography; m = Census measure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {industryRows,peerIds,MEASURES,difference,show} from '../site/js/regional-model.js';
import {parse,serialize,withGeography,SECTIONS} from '../site/js/state.js';

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
  assert.deepEqual(SECTIONS,['overview','people','housing','industries','compare']);
  assert.equal(parse('','#growing').t.iv,'change');
  assert.equal(parse('?cp=dwelling','#profile').t.hv,'dwelling');
  assert.equal(parse('?cp=dwelling','#profile').section,'housing');
  assert.equal(parse('?cp=resident','#profile').section,'people');
  assert.equal(parse('','#workforce').t.pv,'workforce');
  assert.equal(parse('','#market').t.map,'market');
  assert.equal(parse('','#logistics').section,'overview');
});
