import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountStorageKey,CloudRevision} from '../lib/account-workspace.ts';

test('guest and two accounts never read the same local workspace',()=>{
  assert.equal(accountStorageKey(null),'wenxu.studio.v1');
  assert.notEqual(accountStorageKey('user-a'),accountStorageKey(null));
  assert.notEqual(accountStorageKey('user-a'),accountStorageKey('user-b'));
});
test('reading a cloud revision never grants permission to overwrite unmerged data',()=>{
  const revision=new CloudRevision();
  assert.throws(()=>revision.expected());
  assert.equal(revision.inspect(3),false);
  assert.throws(()=>revision.expected());
  revision.merged(3);
  assert.equal(revision.expected(),3);
  revision.saved(4);
  assert.equal(revision.expected(),4);
  assert.equal(revision.inspect(5),false);
  assert.throws(()=>revision.expected());
});
test('a new workspace can be saved, and a conflict revokes save permission',()=>{
  const revision=new CloudRevision();
  assert.equal(revision.inspect(0),true);
  assert.equal(revision.expected(),0);
  revision.saved(1);
  assert.equal(revision.inspect(1),true);
  revision.invalidate();
  assert.throws(()=>revision.expected());
});
test('rejects corrupt or unsafe cloud revision values',()=>{
  const revision=new CloudRevision();
  for(const value of [-1,0.5,Number.MAX_SAFE_INTEGER+1,NaN])assert.throws(()=>revision.inspect(value),/版本无效/);
});
