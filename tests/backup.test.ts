import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject,addVersion} from '../lib/studio.ts';
import {readBackup,mergeBackup} from '../lib/backup.ts';
test('backup merge skips identical projects and preserves changed same-ID projects as independent copies',()=>{
  const p=addVersion(createProject('code','beginner','应用'),{prompt:'原稿',summary:'摘要',constraints:[],assumptions:[],conflicts:[]});
  const current={projects:[p],active:p.id};
  const same=mergeBackup(current,readBackup(JSON.stringify(current)));assert.equal(same.projects.length,1);assert.equal(same.added,0);
  const imported=structuredClone(p);imported.draft='导入的编辑稿';imported.answers={q1:'未提交回答'};
  const result=mergeBackup(current,readBackup(JSON.stringify({projects:[imported],active:p.id})));
  assert.equal(result.projects.length,2);assert.equal(result.projects[1].draft,'原稿');
  assert.equal(result.projects[0].draft,'导入的编辑稿');assert.notEqual(result.projects[0].id,p.id);
  assert.equal(result.projects[0].versions[0].generatedPrompt,'原稿');assert.equal(result.projects[0].answers.q1,'未提交回答');
  assert.equal(current.projects.length,1);
  const again=mergeBackup(result,readBackup(JSON.stringify({projects:[imported],active:p.id})));
  assert.equal(again.projects.length,2);assert.equal(again.skipped,1);
});
test('bad backups, duplicate IDs, missing preview history and oversized content are rejected before merging',()=>{
  const p=createProject('code','beginner','应用');
  for(const raw of ['no json','{}',JSON.stringify({projects:[p,p],active:p.id}),JSON.stringify({projects:[{...p,stage:'preview'}],active:p.id}),' '.repeat(10_500_000)])assert.throws(()=>readBackup(raw));
});
test('broken historical references and duplicate snapshot entries are rejected, while valid restored branches import',()=>{
  const g={prompt:'稿件',summary:'摘要',constraints:['离线运行'],assumptions:[],conflicts:[]};
  const p=addVersion(addVersion(createProject('code','beginner','应用'),g),g);
  const badRef=structuredClone(p);badRef.versions[0].roundIds=['missing-round'];
  const badSnapshot=structuredClone(p);badSnapshot.versions[0].requirementsSnapshot!.push(badSnapshot.versions[0].requirementsSnapshot![0]);
  for(const project of [badRef,badSnapshot])assert.throws(()=>readBackup(JSON.stringify({projects:[project],active:project.id})));
});
