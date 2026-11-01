import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uncertainQuestionNumbers,generationErrorMessage} from '../lib/answer-guidance.ts';
import {createProject} from '../lib/studio.ts';

function project(){
  const p=createProject('video','beginner','做一个10秒的工厂流程视频');
  p.questions=[1,2,3].map(i=>({id:`q${i}`,text:`问题${i}`,hint:'',options:[]}));
  return p;
}

test('uncertainty guidance identifies undecided answers without treating concrete qualifications as missing',()=>{
  const p=project();
  p.answers={q1:' 不确定 ',q2:'不确定，请你给一个通用示例',q3:'风格不确定，但以机器为主，展示质检和包装'};
  assert.deepEqual(uncertainQuestionNumbers(p),[1,2]);
  p.answers={q1:'暂时没想好',q2:'你来决定',q3:''};
  assert.deepEqual(uncertainQuestionNumbers(p),[1,2]);
  p.questions[0].id='constructor';p.answers={q2:'已经确定只拍机器'};
  assert.deepEqual(uncertainQuestionNumbers(p),[]);
});

test('incomplete generation with several uncertain answers preserves the reason and suggests the relevant questions',()=>{
  const p=project();p.answers={q1:'不确定',q2:'以设备为主',q3:'不知道'};
  const message=generationErrorMessage('insufficient_detail','缺少有效分镜。',p);
  assert.ok(message.startsWith('缺少有效分镜。'));
  assert.match(message,/第 1、3 题/);
  assert.match(message,/10秒.*工厂/);
  assert.match(message,/保留/);
  assert.notEqual(generationErrorMessage('invalid_response','模型结果无效。',p),'模型结果无效。');
});

test('service failures and sufficiently concrete answers do not blame uncertainty',()=>{
  const p=project();p.answers={q1:'不确定',q2:'不确定'};
  for(const code of ['provider','timeout','not_configured','missing_requirements',undefined]){
    assert.equal(generationErrorMessage(code,'原始错误',p),'原始错误');
  }
  p.answers={q1:'面向客户',q2:'风格还不确定，但展示工厂的机器和产品'};
  assert.equal(generationErrorMessage('insufficient_detail','原始错误',p),'原始错误');
});
