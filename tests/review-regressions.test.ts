import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject,addVersion,restoreVersion,makeContext} from '../lib/studio.ts';
import {addRequirement,changeRequirement} from '../lib/requirements.ts';
import {profileFor} from '../lib/quality.ts';
const gen={prompt:'黑发高束',summary:'人物短片',constraints:[],assumptions:['黑发高束'],conflicts:[]};
test('outgoing versions preserve manual requirement decisions through both generation and restore',()=>{
  let p=addVersion(createProject('video','beginner','短片'),gen);const first=p.versions[0].id;
  const hair=p.requirements[0].id;p=changeRequirement(p,hair,{status:'rejected'});p.draft='不再出现旧发型';
  p=addRequirement(p,'保持蓝色腰带');p=addVersion(p,{...gen,prompt:'第二版'});
  p=restoreVersion(p,first);assert.equal(p.requirements.find(r=>r.id===hair)?.status,'rejected');assert.ok(makeContext(p).confirmedRequirements.some(r=>r.text==='保持蓝色腰带'));assert.equal(p.draft,'不再出现旧发型');
  p=addRequirement(p,'恢复后手动确认的新要求');const current=p.versions.at(-1)!.id;
  p=restoreVersion(p,first);p=restoreVersion(p,current);assert.ok(makeContext(p).confirmedRequirements.some(r=>r.text==='恢复后手动确认的新要求'));
});
test('raw answers keep whitespace and blank values instead of provider fallback text',()=>{
  let p=createProject('code','beginner','任务');p.questions=[{id:'q1',text:'格式？',hint:'',options:[]},{id:'q2',text:'风格？',hint:'',options:[]}];
  p.answers={q1:'  中文\r\n保留空格  ',q2:''};p=addVersion(p,gen);
  assert.equal(p.rounds[0].answers[0].answer,'  中文\r\n保留空格  ');assert.equal(p.rounds[0].answers[1].answer,'');
});
test('visual validation honors confirmed ledger duration, shot choice and character exclusions',()=>{
  const c=makeContext(addRequirement(addRequirement(addRequirement(createProject('video','beginner','50秒两名武者多镜头短片'),'总时长30秒'),'一镜到底'),'不含任何人物'));
  c.currentPrompt='## 分镜表（合计 50 秒）\n| S01 | 0–25 |\n| S02 | 25–50 |';
  assert.equal(profileFor(c).expectedSeconds,30);assert.equal(profileFor(c).singleShot,true);assert.equal(profileFor(c).needsCharacters,false);
  c.feedback='总时长改为10秒，不要一镜到底，改为多镜头';assert.equal(profileFor(c).expectedSeconds,10);assert.equal(profileFor(c).singleShot,false);
});
test('model-selected negated or unrelated fragments cannot replace confirmed facts without user acceptance',()=>{
  for(const feedback of ['不要改成JSON，继续保留CSV','界面改成JSON示例展示，导出格式继续保留CSV']){
    let p=addRequirement(createProject('code','beginner','导出工具'),'导出格式CSV');const id=p.requirements[0].id;p.feedback=feedback;
    p=addVersion(p,{...gen,requirementUpdates:[{id,quote:'改成JSON',source:'feedback'}]});
    assert.equal(p.requirements.find(r=>r.id===id)?.text,'导出格式CSV');assert.equal(p.requirements.find(r=>r.id===id)?.status,'confirmed');
    const proposal=p.requirements.find(r=>r.replacesId===id)!;assert.equal(proposal.status,'proposed');assert.ok(proposal.sourceDetail.includes(feedback));
    const rejected=changeRequirement(p,proposal.id,{status:'rejected'});assert.equal(rejected.requirements.find(r=>r.id===id)?.status,'confirmed');
    const accepted=changeRequirement(p,proposal.id,{status:'confirmed'});assert.equal(accepted.requirements.find(r=>r.id===id)?.status,'rejected');assert.equal(accepted.requirements.find(r=>r.id===proposal.id)?.status,'confirmed');
  }
});
