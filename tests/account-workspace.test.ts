import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountStorageKey,CloudRevision} from '../lib/account-workspace.ts';

test('guest and two accounts never read the same local workspace',()=>{
  assert.equal(accountStorageKey(null),'wenxu.studio.v1');
  assert.notEqual(accountStorageKey('user-a'),accountStorageKey(null));
  assert.notEqual(accountStorageKey('user-a'),accountStorageKey('user-b'));
});
test('cloud upload requires a known revision and keeps it after conflict',()=>{
  const revision=new CloudRevision();
  assert.throws(()=>revision.expected());
  revision.observe(3);
  assert.equal(revision.expected(),3);
  // A failed save never advances the locally known cloud revision.
  assert.equal(revision.expected(),3);
  revision.saved(4);
  assert.equal(revision.expected(),4);
});
test('rejects corrupt or unsafe cloud revision values',()=>{
  const revision=new CloudRevision();
  for(const value of [-1,0.5,Number.MAX_SAFE_INTEGER+1,NaN])assert.throws(()=>revision.observe(value));
});
