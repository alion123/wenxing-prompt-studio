import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, addVersion, restoreVersion, makeContext, resumeQuestionRound, answerFor } from '../lib/studio.ts';

const result = (prompt: string) => ({ prompt, summary: '已完善', constraints: ['中文'], assumptions: [], conflicts: [] });
test('two refinement rounds preserve edited preview and serialize unfinished answers', () => {
  let p = createProject('code', 'beginner', '做记账软件');
  p = addVersion(p, result('第一版'));
  p.draft = '手动修改的第一版'; p.feedback = '增加导出'; p.answers = { q1: 'CSV' };
  const saved = JSON.parse(JSON.stringify(p));
  assert.equal(makeContext(saved).currentPrompt, '手动修改的第一版');
  assert.equal(makeContext(saved).answers.q1, 'CSV');
  p = addVersion(saved, result('第二版包含 CSV'));
  p = addVersion(p, result('第三版'));
  assert.equal(p.versions.length, 3);
  assert.equal(p.versions[0].prompt, '手动修改的第一版');
  assert.equal(p.versions[1].prompt, '第二版包含 CSV');
});
test('restoring a version appends history and restores matching constraint state', () => {
  let p = addVersion(createProject('image', 'advanced', '海报'), result('复古海报'));
  const id = p.versions[0].id;
  p = addVersion(p, { ...result('极简海报'), constraints: ['极简'] });
  p = restoreVersion(p, id);
  assert.equal(p.versions.length, 3);
  assert.equal(p.draft, '复古海报');
  assert.deepEqual(makeContext(p).constraints, ['中文']);
});
test('context excludes old raw version histories and retains active state', () => {
  const p = addVersion(createProject('video', 'beginner', '短片'), result('长镜头'));
  p.status = 'completed';
  assert.equal(JSON.parse(JSON.stringify(p)).status, 'completed');
  assert.equal('versions' in makeContext(p), false);
  assert.equal(makeContext(p).goal, '短片');
});
test('returning from setup or refine resumes the exact unanswered round without clearing inputs', () => {
  for (const stage of ['setup', 'refine'] as const) {
    const p = createProject('code', 'beginner', '记账'); p.stage = stage;
    p.questions = [{ id: 'q1', text: '输出格式？', hint: '', options: ['CSV'] }];
    p.answers = { q1: '我想要 CSV' }; p.feedback = '优化导出'; p.omissions = '支持中文';
    const resumed = resumeQuestionRound(p);
    assert.equal(resumed?.stage, 'questions'); assert.deepEqual(resumed?.answers, p.answers);
    assert.deepEqual(resumed?.questions, p.questions); assert.equal(resumed?.omissions, '支持中文');
    assert.equal(resumed?.versions.length, 0);
  }
  assert.equal(resumeQuestionRound(createProject('code', 'beginner', '新项目')), null);
});
test('answer lookup ignores inherited object properties and non-string values', () => {
  const p = createProject('image', 'beginner', '海报');
  assert.equal(answerFor(p, 'constructor'), ''); assert.equal(answerFor(p, 'toString'), '');
  p.answers = { q1: '手动输入' }; assert.equal(answerFor(p, 'q1'), '手动输入');
});
