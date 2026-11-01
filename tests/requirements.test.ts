import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createProject,addVersion,restoreVersion,makeContext} from '../lib/studio.ts';
import {addRequirement,changeRequirement,validateRequirementUpdates} from '../lib/requirements.ts';
const gen=(prompt='原稿')=>({prompt,summary:'摘要',constraints:['总时长50秒','暗红腰带'],assumptions:['黑发高束'],conflicts:[]});
test('model suggestions remain proposed and rejected requirements cannot resurrect on later rounds',()=>{
  let p=addVersion(createProject('video','beginner','武者短片'),gen());
  assert.equal(p.requirements[0].status,'proposed');assert.equal(p.requirements[0].source,'model');
  const hair=p.requirements.find(x=>x.text==='黑发高束')!;
  p=changeRequirement(p,hair.id,{status:'rejected'});
  p=addVersion(p,gen('第二版'));
  assert.equal(p.requirements.filter(x=>x.text==='黑发高束').length,1);
  assert.equal(p.requirements.find(x=>x.id===hair.id)?.status,'rejected');
  assert.ok(makeContext(p).rejectedRequirements.includes('黑发高束'));
});
test('rounds retain verbatim answers, original generated text and manual edits independently',()=>{
  let p=createProject('code','beginner','记账');
  p.questions=[{id:'q1',text:'导出格式？',hint:'文件类型',options:['CSV']}];p.answers={q1:'CSV，保留中文表头'};p.omissions='不需要联网';
  p=addVersion(p,gen('模型原稿'));p.draft='手动编辑稿';p.feedback='增加筛选';
  p=addVersion(p,gen('优化稿'));
  assert.equal(p.rounds[0].answers[0].answer,'CSV，保留中文表头');
  assert.equal(p.rounds[0].omissions,'不需要联网');assert.equal(p.rounds[1].feedback,'增加筛选');
  assert.equal(p.versions[0].generatedPrompt,'模型原稿');assert.equal(p.versions[0].prompt,'手动编辑稿');
  assert.equal(p.versions[1].parentVersionId,p.versions[0].id);
});
test('restoring a past version restores its requirements and effective rounds without deleting the audit trail',()=>{
  let p=addRequirement(createProject('video','beginner','短片'),'总时长50秒');
  p.feedback='初版要求';p=addVersion(p,gen('50秒版本'));const original=p.versions[0].id;
  const id=p.requirements.find(x=>x.text==='总时长50秒')!.id;
  p.feedback='未来一轮，总时长改成30秒';p=addVersion(p,{...gen('30秒版本'),requirementUpdates:[{id,quote:'总时长改成30秒',source:'feedback'}]});
  p=changeRequirement(p,p.requirements.find(r=>r.replacesId===id)!.id,{status:'confirmed'});
  p=restoreVersion(p,original);
  assert.equal(p.rounds.length,2);assert.equal(p.versions.length,3);
  const c=makeContext(p);
  assert.ok(c.confirmedRequirements.some(x=>x.text==='总时长50秒'));
  assert.ok(!c.confirmedRequirements.some(x=>x.text==='总时长30秒'));
  assert.ok(!JSON.stringify(c.recentRounds).includes('未来一轮'));
});
test('confirmed fact updates must cite exact current user input and cannot target unknown or rejected facts',()=>{
  let p=addRequirement(createProject('video','beginner','短片'),'总时长50秒');const id=p.requirements[0].id;
  p.feedback='总时长改成30秒，其他不变。';
  const c=makeContext(p);
  const updates=validateRequirementUpdates([{id,quote:'总时长改成30秒',source:'feedback'}],c);
  p=addVersion(p,{...gen('30秒版本'),requirementUpdates:updates});
  assert.equal(p.requirements[0].text,'总时长50秒');
  const replacement=p.requirements.find(r=>r.replacesId===id)!;assert.equal(replacement.text,'总时长改成30秒');assert.equal(replacement.status,'proposed');
  p=changeRequirement(p,replacement.id,{status:'confirmed'});assert.equal(p.requirements.find(r=>r.id===id)!.status,'rejected');
  assert.throws(()=>validateRequirementUpdates([{id,quote:'改成100秒',source:'feedback'}],c));
  assert.throws(()=>validateRequirementUpdates([{id:'unknown',quote:'总时长改成30秒',source:'feedback'}],c));
});
test('manual edits have user provenance and a rejected fact can be intentionally reinstated',()=>{
  let p=addVersion(createProject('image','beginner','角色'),gen());const id=p.requirements[0].id;
  p=changeRequirement(p,id,{text:'画幅3:4'});assert.equal(p.requirements[0].source,'user');
  assert.equal(p.requirements[0].status,'confirmed');
  p=changeRequirement(p,id,{status:'rejected'});p=changeRequirement(p,id,{status:'confirmed'});
  assert.equal(p.requirements[0].status,'confirmed');
});
