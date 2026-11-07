import test from 'node:test';
import assert from 'node:assert/strict';
import {lifetime} from '../site/js/ui.js';

test('a tool generation cancels previous leases and deactivation cancels the current generation',()=>{
  const owner=new EventTarget(),el={isConnected:true,closest:()=>owner};
  const life=lifetime(el),old=life.next();
  assert.equal(old(),true);
  const current=life.next();
  assert.equal(old(),false);assert.equal(old.signal.aborted,true);assert.equal(current(),true);
  owner.dispatchEvent(new Event('deactivate'));
  assert.equal(current(),false);assert.equal(current.signal.aborted,true);
  const resumed=life.next();assert.equal(resumed(),true);assert.equal(resumed.signal.aborted,false);
  el.isConnected=false;assert.equal(resumed(),false);
});
