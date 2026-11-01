import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequestLifecycle} from '../lib/request-lifecycle.ts';

test('cancelling aborts the request and rejects its late result without interfering with a new request',()=>{
  const requests=createRequestLifecycle(),old=requests.begin();
  assert.equal(requests.isCurrent(old),true);
  requests.cancel();assert.equal(old.signal.aborted,true);assert.equal(requests.isCurrent(old),false);
  const fresh=requests.begin();
  assert.equal(requests.finish(old),false);assert.equal(requests.isCurrent(fresh),true);
  assert.equal(requests.finish(fresh),true);assert.equal(requests.isCurrent(fresh),false);
});

test('starting another request invalidates and aborts the previous one',()=>{
  const requests=createRequestLifecycle(),first=requests.begin(),second=requests.begin();
  assert.equal(first.signal.aborted,true);assert.equal(requests.isCurrent(first),false);
  assert.equal(requests.isCurrent(second),true);
});
