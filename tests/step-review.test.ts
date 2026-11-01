import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject,addVersion,restoreVersion} from '../lib/studio.ts';
import {questionsForReview,canEditStep,editStep} from '../lib/step-review.ts';
import {parseWorkspace} from '../lib/persistence.ts';
import {readBackup} from '../lib/backup.ts';
const generation={prompt:'已生成的提示词',summary:'摘要',constraints:[],assumptions:[],conflicts:[]};
test('step review recovers the active branch raw answers without changing project progress',()=>{
  let p=createProject('code','beginner','记账应用');
  p.questions=[{id:'q1',text:'用途是什么？',hint:'用途',options:['个人']}];p.answers={q1:'原始回答'};p.feedback='原始反馈';p.omissions='原始补充';
  p=addVersion(p,generation);const first=p.versions[0].id;
  p.questions=[{id:'q2',text:'第二轮？',hint:'',options:[]}];p.answers={q2:'新回答'};p=addVersion(p,generation);p=restoreVersion(p,first);
  const before=JSON.stringify(p),review=questionsForReview(p);
  assert.equal(review.questions[0].text,'用途是什么？');assert.equal(review.answers.q1,'原始回答');assert.equal(review.feedback,'原始反馈');
  assert.equal(JSON.stringify(p),before);
});
test('stopping into an earlier step preserves draft, versions and concrete pending answers',()=>{
  let p=addVersion(createProject('video','beginner','短片'),generation);
  p.questions=[{id:'q1',text:'用途？',hint:'',options:[]}];p.answers={q1:'客户宣传'};
  const edited=editStep(p,0);assert.equal(edited.stage,'setup');assert.equal(edited.draft,p.draft);assert.deepEqual(edited.answers,p.answers);assert.deepEqual(edited.versions,p.versions);
  const questions=editStep(edited,1);assert.equal(questions.stage,'questions');assert.equal(questions.answers.q1,'客户宣传');
});
test('future steps do not invent a preview or completion; reopening a completed draft is explicit',()=>{
  const fresh=createProject('image','beginner','海报');
  assert.equal(canEditStep(fresh,0),true);for(const step of [1,2,3] as const)assert.equal(canEditStep(fresh,step),false);
  assert.deepEqual(editStep(fresh,3),fresh);
  const done=addVersion(fresh,generation);done.status='completed';
  const edited=editStep(done,3);assert.equal(edited.stage,'preview');assert.equal(edited.status,'draft');assert.equal(done.status,'completed');
});
test('refinement review includes previous answers but editing refinement does not resubmit the historical round',()=>{
  let p=createProject('code','beginner','应用');p.questions=[{id:'q1',text:'用途？',hint:'',options:[]}];p.answers={q1:'离线使用'};
  p=addVersion(p,generation);p.stage='refine';p.feedback='补充导出功能';
  const review=questionsForReview(p);assert.equal(review.answers.q1,'离线使用');assert.equal(review.feedback,'补充导出功能');
  const edited=editStep(p,1);assert.equal(edited.stage,'refine');assert.deepEqual(edited.questions,[]);assert.equal(edited.feedback,p.feedback);
});
test('unsent refinement survives editing other steps, including intentionally cleared fields',()=>{
  for(const target of [0,2] as const)for(const feedback of ['新的未提交反馈','']){
    let p=createProject('code','beginner','应用');p.feedback='上轮旧反馈';p.omissions='上轮旧补充';p=addVersion(p,generation);
    p.stage='refine';p.feedback=feedback;p.omissions='新的未提交补充';
    const other=editStep(p,target),review=questionsForReview(other),back=editStep(other,1);
    assert.equal(review.feedback,feedback);assert.equal(review.omissions,'新的未提交补充');
    assert.equal(back.stage,'refine');assert.equal(back.feedback,feedback);assert.equal(back.omissions,'新的未提交补充');assert.deepEqual(back.questions,[]);
  }
});
test('returning to edit keeps original suggestions and hints after generation, reload, backup and branch restore',()=>{
  let p=createProject('image','beginner','角色立绘');
  const original={id:'q1',text:'画面气质？',hint:'选择想呈现的感觉，也可以自行补充。',options:['清新自然','沉稳大气','不确定']};
  p.questions=[structuredClone(original)];p.answers={q1:'清新自然，保留手写补充'};
  const source=p.questions[0];p=addVersion(p,generation);const first=p.versions[0].id;
  source.options.push('后来改动的选项');
  // Snapshot owns its options even if the source question is later mutated.
  assert.deepEqual(p.rounds[0].answers[0].options,original.options);
  p.questions=[{id:'q1',text:'第二轮构图？',hint:'第二轮说明',options:['近景','远景']}];p.answers={q1:'近景'};
  p=addVersion(p,generation);
  p=readBackup(JSON.stringify({projects:[p],active:p.id})).projects[0];
  assert.deepEqual(questionsForReview(p).questions[0].options,['近景','远景']);
  p=restoreVersion(p,first);
  p=parseWorkspace(JSON.stringify({projects:[p],active:p.id}))!.projects[0];
  const edited=editStep(p,1);
  assert.deepEqual(edited.questions,[original]);assert.equal(edited.answers.q1,'清新自然，保留手写补充');
  edited.questions[0].options.push('新选项');
  assert.deepEqual(p.rounds[0].answers[0].options,original.options);
});
test('legacy round without saved suggestions remains editable with an honest recovery hint and uncertainty option',()=>{
  let p=createProject('code','beginner','旧项目');p.questions=[{id:'q1',text:'主要功能？',hint:'说明',options:['记录']}];p.answers={q1:'记录，按月查看'};p=addVersion(p,generation);
  const raw=JSON.parse(JSON.stringify({projects:[p],active:p.id}));
  delete raw.projects[0].rounds[0].answers[0].hint;delete raw.projects[0].rounds[0].answers[0].options;
  p=readBackup(JSON.stringify(raw)).projects[0];
  const edited=editStep(p,1);
  assert.equal(edited.answers.q1,'记录，按月查看');assert.match(edited.questions[0].hint,/旧记录.*未保存.*建议选项/);
  assert.ok(edited.questions[0].options.some(o=>o.includes('不确定')));
});
