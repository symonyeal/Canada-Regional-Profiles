import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeSDMX, memoRequest, tablePair, geoMember} from '../site/js/api.js';
import {completeSum,estimate, locationQuotient, change, Profile, rankIndustries, csv, matchesProvince, tradedShare, classifyTrade, validGeographyId, reconcileCounts, fmt, jenks, binCounts} from '../site/js/model.js';

test('group totals require every published component, including genuine zeros',()=>{
  assert.equal(completeSum([0,6,3]),9);
  assert.equal(completeSum([0,null]),null);
  assert.equal(completeSum([6,undefined]),null);
  assert.equal(completeSum([]),null);
});

const fixture = () => ({data: {structure: {dimensions: {series: [
  {id:'REF_AREA',values:[{id:'geo',name:'A place'}]},
  {id:'CHARACTERISTIC',values:[{id:'1',name:'Population',order:0},{id:'2',name:'Suppressed',parent:'1',order:1}]},
  {id:'GENDER',values:[{id:'1',name:'Total'}]},
  {id:'STATISTIC',values:[{id:'1',name:'Counts'}]},
], observation:[{id:'TIME_PERIOD',values:[{id:'2021'}]}]},attributes:{series:[],observation:[]}},
dataSets:[{series:{'0:0:0:0':{observations:{0:['123']}},'0:1:0:0':{observations:{0:['']}}}}]}});

test('SDMX keys use published dimension order; empty observations stay missing', () => {
  const rows=decodeSDMX(fixture());
  assert.equal(rows[0].area.id,'geo'); assert.equal(rows[0].value,123);
  assert.equal(rows[0].time,'2021'); assert.equal(rows[1].value,null);
  assert.equal(rows[1].characteristic.parent,'1');
});
test('missing or malformed upstream payload fails instead of becoming a zero-data profile', () => {
  assert.throws(()=>decodeSDMX({error:'unavailable'}),/SDMX/);
});
test('profile shares use the specified denominator and preserve suppression', () => {
  const p=new Profile(decodeSDMX(fixture()));
  assert.equal(p.value('1'),123); assert.equal(p.value('2'),null);
  assert.equal(p.share('2','1'),null); assert.equal(p.children('1').length,1);
});
test('midpoints and infinite upper bound preserve the original Python estimator', () => {
  assert.deepEqual(estimate([1,1,1,1,1,1,1,0]),{value:632,lower:386,upper:878});
  assert.deepEqual(estimate([0,0,0,0,0,0,0,2]),{value:1000,lower:1000,upper:null});
  assert.equal(estimate([1,null,0,0,0,0,0,0]).value,null);
});
test('growth never divides by zero or ranks missing history as zero growth', () => {
  assert.deepEqual(change(20,10),{absolute:10,relative:1});
  assert.deepEqual(change(20,0),{absolute:20,relative:null});
  assert.deepEqual(change(20,null),{absolute:null,relative:null});
});
test('location quotient uses totals across the complete same-level partition', () => {
  assert.equal(locationQuotient(20,100,100,1000),2);
  assert.equal(locationQuotient(20,100,0,1000),null);
  const rows=[{code:'11',value:20,national:100},{code:'21',value:80,national:900}];
  const ranked=rankIndustries(rows,'lq'); assert.equal(ranked[0].code,'11'); assert.equal(ranked[0].lq,2);
});
test('table discovery pairs the same month and geographic family five years apart', () => {
  const catalog=[
    {productId:1,cubeTitleEn:'Canadian Business Counts, with employees, June 2026',releaseTime:'2026-08-01'},
    {productId:2,cubeTitleEn:'Canadian Business Counts, with employees, June 2021',releaseTime:'2021-08-01'},
    {productId:3,cubeTitleEn:'Canadian Business Counts, with employees, December 2021',releaseTime:'2022-02-01'},
    {productId:4,cubeTitleEn:'Canadian Business Counts, with employees, census metropolitan areas and census subdivisions, June 2026',releaseTime:'2026-08-01'},
  ];
  assert.deepEqual(tablePair(catalog,false),{current:catalog[0],previous:catalog[1]});
  assert.equal(tablePair(catalog,true).previous,null);
});
test('geographic matching uses classification codes, not ambiguous city names', () => {
  const dim={member:[{memberId:2,memberNameEn:'London',classificationCode:'3539036'},
    {memberId:3,memberNameEn:'London',classificationCode:'555'}]};
  assert.equal(geoMember(dim,{id:'2021A00053539036',type:'CSD'}).memberId,2);
  assert.equal(geoMember(dim,{id:'2021A00054611040',type:'CSD'}),null);
  assert.equal(matchesProvince({id:'2021A00053539036',type:'CSD'},'35'),true);
  assert.equal(matchesProvince({id:'2021S0503535',province:'35',type:'CMACA'},'35'),true);
});
test('CSV guards spreadsheet formulas and correctly quotes delimiters', () => {
  assert.equal(csv([['name','value'],['=cmd','a,b'],['a"b',null]]),
    '\ufeff"name","value"\r\n"\'=cmd","a,b"\r\n"a""b",""');
});
test('concurrent requests share a promise; failures are evicted so retry can succeed', async () => {
  let n=0; const cache=new Map(); const f=async()=>{n++; return 9;};
  const a=await Promise.all([memoRequest(cache,'a',f),memoRequest(cache,'a',f)]);
  assert.deepEqual(a,[9,9]); assert.equal(n,1);
  await assert.rejects(memoRequest(cache,'b',async()=>{throw Error('offline');}));
  assert.equal(await memoRequest(cache,'b',f),9);
});
test('traded classification uses longest matching prefix and national employment weights',()=>{
  const codes=['111111','111121','112111'],traded=['111111','112111'];
  assert.equal(tradedShare('111110',codes,traded),1);
  assert.equal(tradedShare('111199',codes,traded),.5);
  assert.equal(classifyTrade('11',[{code:'111111',value:10},{code:'111121',value:90},{code:'112111',value:0}],codes,traded),false);
  assert.equal(classifyTrade('11',[{code:'111111',value:90},{code:'111121',value:10}],codes,traded),true);
});
test('shared links accept official six-digit provincial identifiers as well as municipal DGUIDs',()=>{
  assert.equal(validGeographyId('2021A000246'),true);
  assert.equal(validGeographyId('2021A000011124'),true);
  assert.equal(validGeographyId('2021A00054611040'),true);
  assert.equal(validGeographyId('../bad'),false);
});
test('sparse Business Register zero series are inferred only when published totals reconcile',()=>{
  const rows=reconcileCounts([{total:15,N:[9,4,1,null,1,null,null,null]},
    {total:5,N:[2,null,null,null,null,null,null,null]}],[]);
  assert.deepEqual(rows[0].N,[9,4,1,0,1,0,0,0]);
  assert.equal(rows[1].N[1],null);
  assert.equal(estimate(rows[0].N).value,139.5);
});
test('size-class subtotals can establish zero rows without treating unreconciled missing values as zero',()=>{
  const rows=reconcileCounts([{total:3,N:[3,null,null,null,null,null,null,null]},
    {total:null,N:[null,null,null,null,null,null,null,null]}],[3,0,0,0,0,0,0,0]);
  assert.deepEqual(rows[1].N,[0,0,0,0,0,0,0,0]);assert.equal(rows[1].locations,0);
});
test('cross-border metro areas appear in both constituent provinces',()=>{
  const g={id:'2021S0503505',type:'CMACA',province:'35_24'};
  assert.equal(matchesProvince(g,'35'),true);assert.equal(matchesProvince(g,'24'),true);assert.equal(matchesProvince(g,'46'),false);
});
test('published decimal values are not rounded into zero in full-profile tables',()=>{
  assert.equal(fmt(.04),'0.04');assert.equal(fmt(-1.7),'-1.7');
});
test('map filters preserve unknown cells and sum one selected dimension',()=>{
  assert.deepEqual(binCounts([2,3,5],[false,true,true]),{total:10,target:8});
  assert.deepEqual(binCounts([2,null,5],[true,true,false]),{total:null,target:null});
});
test('natural-break classes cover finite values and cap classes to distinct values',()=>{
  assert.deepEqual(jenks([1,1,1,null],6),[1,1]);
  const b=jenks([1,2,3,100,101,102],2);assert.equal(b[0],1);assert.equal(b.at(-1),102);assert.equal(b.length,3);
});
