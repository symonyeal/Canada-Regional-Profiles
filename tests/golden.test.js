// Golden numbers: adapters and models run on the recorded responses in tests/fixtures (see record.mjs), so each
// published figure below is computed from committed inputs. Raw inputs were checked by hand against the files:
// Manitoba median age 38.4 and Canada 41.6 (Census), payroll jobs 583,533 (2015) and 629,191 (2025) in Manitoba and
// 15,546,233 and 17,917,814 in Canada (table 14-10-0202, aggregate [11-91N]).
import test from 'node:test';
import assert from 'node:assert/strict';
import {censusMany,sephSectors,sephAt} from '../site/js/api.js';
import {MEASURE_IDS,measure,standing,similar,findings,shiftShare} from '../site/js/regional-model.js';
import {CANADA,PT,provinceGeo} from '../site/js/model.js';
import {clearCache} from '../site/js/transport.js';
import {replay} from './fixtures/replay.mjs';

const MB=provinceGeo('46'),areas=PT.map(([c])=>provinceGeo(c)),close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
const real=globalThis.fetch;
test.before(()=>{globalThis.fetch=replay();clearCache();});
test.after(()=>{globalThis.fetch=real;clearCache();});

test('Census cohort: Manitoba among the thirteen provinces and territories',async()=>{
  const P=await censusMany('PR',[CANADA.id,...areas.map(a=>a.id)],MEASURE_IDS),X=areas.map(a=>P.get(a.id)),i=areas.findIndex(a=>a.id===MB.id),C=P.get(CANADA.id);
  const age=measure('age'),un=measure('unemployment'),inc=measure('income'),rent=measure('renters');
  assert.equal(age.of(X[i]),38.4);assert.equal(age.of(C),41.6);
  assert.deepEqual(standing(age.of(X[i]),X.map(p=>age.of(p))),{q:6/26,high:10,low:3,n:13});
  assert.equal(un.of(X[i]),8.3);assert.equal(inc.of(X[i]),79500);assert.equal(inc.of(C),84000);
  assert.deepEqual(standing(inc.of(X[i]),X.map(p=>inc.of(p))),{q:11/26,high:8,low:6,n:13});
  close(rent.of(X[i]),30.207217380393974);close(rent.of(C),33.072033134520865);
  const s=similar(X,i,3);
  assert.deepEqual(s.map(r=>areas[r.j].name),['Saskatchewan','Alberta','Quebec']);
  close(s[0].distance,0.38896276250763134);close(s[2].distance,0.5948451897839133);
  const f=findings(X[i],C,X).headline;
  assert.deepEqual(f.map(r=>r.m.id),['recent','unemployment','age','commuters','lowincome','burden']);
  close(f[0].x,4.465320516988797);close(f[0].d,5/13);
});

test('shift-share on recorded payroll jobs: Manitoba 2015 to 2025',async()=>{
  const s=sephAt(await sephSectors(MB),2015,2025),r=shiftShare(s.rows,s.agg);
  assert.deepEqual(s.agg,{e0:583533,e1:629191,E0:15546233,E1:17917814});
  assert.equal(r.change,45658);assert.equal(r.published,17);
  close(r.G,0.15255020299772948);close(r.NS,89018.07760587407);close(r.IM,6038.888315322265);close(r.RS,-47114.49850989483);
  close(r.NS+r.IM+r.RS+r.unattributed,r.change);
});
