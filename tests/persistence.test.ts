import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkspace } from '../lib/persistence.ts';
import { createProject, addVersion } from '../lib/studio.ts';
test('loads unfinished answers and edited versions without changing their state', () => {
  const p = addVersion(createProject('code', 'advanced', '应用'), { prompt: '提示词', summary: '摘要', assumptions: [], conflicts: [], constraints: ['离线'] });
  p.stage = 'questions'; p.questions = [{ id: 'q1', text: '哪个平台？', hint: '电脑或手机', options: ['电脑'] }]; p.answers = { q1: '电脑' };
  const raw = JSON.stringify({ projects: [p], active: p.id });
  assert.deepEqual(parseWorkspace(raw)?.projects[0], p); assert.equal(parseWorkspace(null), null);
});
test('rejects corrupted nested data before rendering and leaves raw data unchanged', () => {
  const p = createProject('code', 'advanced', '应用');
  for (const patch of [{ versions: [null] }, { questions: [{ id: 'q1', text: null, options: {} }] }, { answers: 'invalid' }, { mode: 'unknown' }]) {
    const raw = JSON.stringify({ projects: [{ ...p, ...patch }], active: p.id });
    assert.throws(() => parseWorkspace(raw));
    assert.equal(JSON.parse(raw).active, p.id);
  }
});
test('migrates legacy projects without fabricating answers or generated-original provenance',()=>{
  const p=addVersion(createProject('code','beginner','旧项目'),{prompt:'旧提示词',summary:'摘要',constraints:[],assumptions:[],conflicts:[]});
  const legacy=JSON.parse(JSON.stringify(p));delete legacy.requirements;delete legacy.rounds;
  for(const v of legacy.versions){delete v.generatedPrompt;delete v.roundId;delete v.roundIds;delete v.requirementsSnapshot;}
  const migrated=parseWorkspace(JSON.stringify({projects:[legacy],active:p.id}))!.projects[0];
  assert.deepEqual(migrated.requirements,[]);assert.deepEqual(migrated.rounds,[]);
  assert.equal(migrated.versions[0].generatedPrompt,undefined);assert.equal(migrated.draft,'旧提示词');
});
test('does not discard new requirement snapshots and round provenance on reload',()=>{
  const p=addVersion(createProject('image','beginner','角色图'),{prompt:'新提示词',summary:'摘要',constraints:['红色外套'],assumptions:[],conflicts:[]});
  assert.deepEqual(parseWorkspace(JSON.stringify({projects:[p],active:p.id}))!.projects[0],JSON.parse(JSON.stringify(p)));
});
