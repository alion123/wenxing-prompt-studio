import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject} from '../lib/studio.ts';
import {canAutoRestoreWorkspace} from '../lib/account-workspace.ts';
test('only an untouched starter workspace is eligible for automatic cloud recovery',()=>{
  const project=createProject('code','beginner','');
  const workspace={projects:[project],active:project.id};
  assert.equal(canAutoRestoreWorkspace(workspace),true);
  assert.equal(canAutoRestoreWorkspace({...workspace,projects:[{...project,goal:'正在输入'}]}),false);
  assert.equal(canAutoRestoreWorkspace({...workspace,projects:[project,createProject('image','beginner','')]}),false);
  assert.equal(canAutoRestoreWorkspace({...workspace,projects:[{...project,type:'image'}]}),false);
});
