import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as review from '../lib/step-review.ts';
import {createProject,addVersion,restoreVersion} from '../lib/studio.ts';
import {readBackup} from '../lib/backup.ts';
import {readStudioResponse} from '../lib/api-response.ts';
const generation={prompt:'原提示词',summary:'摘要',constraints:[],assumptions:[],conflicts:[]};
const question={id:'q1',text:'故事的用途和受众？',hint:'',options:[]};
const suggestions=[{id:'q1',hint:'可以选择用途或继续填写',options:['个人阅读','社交平台发布','不确定']}];
test('duplicate options are not treated as distinct concrete suggestions',()=>{
  const p=createProject('copy','beginner','故事');p.questions=[{...question,options:['个人阅读','个人阅读','不确定']}];
  assert.ok(review.suggestionTarget(p));p.questions[0].options=['个人阅读','社交平台发布','不确定'];assert.equal(review.suggestionTarget(p),null);
});
function legacy(){let p=createProject('copy','beginner','机器人故事');p.questions=[question];p.answers={q1:'给朋友看，保留回答'};p=addVersion(p,generation);return p;}
test('legacy recovery fills choices in place without changing answers, progress, feedback, prompt or versions',()=>{
  assert.ok('suggestionTarget' in review,'requires in-place suggestion recovery');
  const p=legacy(),target=review.suggestionTarget(p)!;assert.ok(target);
  const before=structuredClone(p),filled=review.applySuggestions(p,target,suggestions);
  assert.deepEqual({...filled,rounds:before.rounds},before);
  assert.equal(filled.rounds[0].answers[0].answer,before.rounds[0].answers[0].answer);
  assert.deepEqual(review.questionsForReview(filled).questions[0].options,suggestions[0].options);
  assert.equal(review.suggestionTarget(filled),null);
  const imported=readBackup(JSON.stringify({projects:[filled],active:filled.id})).projects[0];
  assert.equal(review.suggestionTarget(imported),null);
  assert.equal(review.editStep(imported,1).answers.q1,'给朋友看，保留回答');
});
test('recovery after entering edit enriches current questions and their source round; stale branch and malformed results cannot apply',()=>{
  assert.ok('suggestionTarget' in review);
  let p=review.editStep(legacy(),1);p.feedback='未提交反馈';p.omissions='未提交补充';
  const target=review.suggestionTarget(p)!;const filled=review.applySuggestions(p,target,suggestions);
  assert.deepEqual(filled.answers,p.answers);assert.equal(filled.feedback,p.feedback);assert.equal(filled.omissions,p.omissions);
  assert.deepEqual(filled.questions[0].options,suggestions[0].options);assert.deepEqual(filled.rounds[0].answers[0].options,suggestions[0].options);
  const before=JSON.stringify(p);assert.throws(()=>review.applySuggestions(p,target,[{...suggestions[0],id:'unknown'}]));assert.equal(JSON.stringify(p),before);
  const first=p.versions[0].id;p=addVersion(p,generation);p=restoreVersion(p,first);
  assert.throws(()=>review.applySuggestions(p,target,suggestions));
});
test('client accepts suggestion metadata only and rejects duplicate or empty choices',async()=>{
  const data=await readStudioResponse(Response.json({suggestions}),'suggestions');assert.deepEqual(data,{suggestions});
  for(const invalid of [[],[...suggestions,...suggestions],[{...suggestions[0],options:['不确定']}]])await assert.rejects(()=>readStudioResponse(Response.json({suggestions:invalid}),'suggestions'));
});
