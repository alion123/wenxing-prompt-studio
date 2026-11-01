import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject} from '../lib/studio.ts';
import {delegateUnresolved,delegateAnswer,DELEGATE_ANSWER} from '../lib/delegation.ts';
test('delegation fills unresolved questions without changing concrete answers or the original project',()=>{
  const p=createProject('video','beginner','10秒工厂视频');
  p.questions=[1,2,3].map(i=>({id:`q${i}`,text:'问题',hint:'',options:[]}));p.answers={q1:'不确定',q2:'只拍设备，不要人物'};
  const result=delegateUnresolved(p);
  assert.equal(result.q1,DELEGATE_ANSWER);assert.equal(result.q3,DELEGATE_ANSWER);assert.equal(result.q2,p.answers.q2);
  assert.equal(p.answers.q1,'不确定');assert.equal(p.answers.q3,undefined);
});
test('per-question delegation preserves concrete facts, is idempotent and never truncates a full answer',()=>{
  const text='只拍设备，不要人物；镜头风格没想好';
  const answer=delegateAnswer(text);assert.ok(answer.startsWith(text));assert.ok(answer.includes(DELEGATE_ANSWER));
  assert.equal(delegateAnswer(answer),answer);assert.throws(()=>delegateAnswer('中'.repeat(4000)));
});
