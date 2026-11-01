import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject,makeContext,addVersion} from '../lib/studio.ts';
import {profileFor,materialize} from '../lib/quality.ts';
import {addRequirement,changeRequirement,removeRequirement} from '../lib/requirements.ts';
import {handleStudio} from '../lib/deepseek.ts';
import {fixture} from './fixtures/visual.ts';
import {parseWorkspace} from '../lib/persistence.ts';

test('a negated duration change cannot override the explicitly retained duration',()=>{
  const c=makeContext(createProject('video','beginner','50秒两名武者短片'));
  for(const feedback of ['不要改成30秒，总时长保持50秒','不要缩短为30秒','不是30秒，而是50秒']){
    c.feedback=feedback;assert.equal(profileFor(c).expectedSeconds,50,feedback);
  }
  c.feedback='把总时长改为30秒';assert.equal(profileFor(c).expectedSeconds,30);
});

test('a short answer to a total-duration question overrides prior timing but a per-shot answer does not',()=>{
  const c=makeContext(createProject('video','beginner','50秒两名武者短片'));
  c.questions=[{id:'q1',text:'这次总时长改为多少？',hint:'',options:[]}];c.answers={q1:'30秒'};
  assert.equal(profileFor(c).expectedSeconds,30);
  c.questions[0].text='你希望这条视频多长？';c.answers.q1='1分钟';
  assert.equal(profileFor(c).expectedSeconds,60);
  c.questions[0].text='每个镜头的时长是多少？';c.answers.q1='5秒';
  assert.equal(profileFor(c).expectedSeconds,50);
  c.questions[0].text='镜头时长希望多少？';c.questions[0].hint='单个镜头';
  assert.equal(profileFor(c).expectedSeconds,50);
  c.questions[0].text='时长希望多少？';
  assert.equal(profileFor(c).expectedSeconds,50);
  c.questions[0].text='这条视频每个镜头的时长希望多少？';
  assert.equal(profileFor(c).expectedSeconds,50);
});

test('a no-actor video stays no-actor when its materialized text is refined',()=>{
  const c=makeContext(createProject('video','beginner','50秒工厂设备流程视频'));
  const g=fixture();g.visualPlan.characters=[];for(const s of g.visualPlan.shots)s.characters=[];
  c.currentPrompt=materialize(g,profileFor(c));
  assert.equal(profileFor(c).needsCharacters,false);
  assert.doesNotThrow(()=>materialize(g,profileFor(c)));
  const withActors=fixture();withActors.visualPlan.shots[1].characters=[];
  c.goal='50秒创意短片';c.currentPrompt=materialize(withActors,profileFor(c));
  assert.equal(profileFor(c).needsCharacters,true);
});

test('an accepted replacement supersedes the old fact without turning it into an explicit prohibition',()=>{
  let p=addRequirement(createProject('code','beginner','导出工具'),'导出CSV文件');
  const id=p.requirements[0].id;p.feedback='改为导出CSV文件，增加中文表头';
  p=addVersion(p,{prompt:'导出CSV文件，增加中文表头',summary:'导出',constraints:[],assumptions:[],conflicts:[],requirementUpdates:[{id,quote:p.feedback,source:'feedback'}]});
  const proposed=p.requirements.find(r=>r.replacesId===id)!;
  p=changeRequirement(p,proposed.id,{status:'confirmed'});
  assert.ok(makeContext(p).confirmedRequirements.some(r=>r.text.includes('中文表头')));
  assert.ok(!makeContext(p).rejectedRequirements.includes('导出CSV文件'));
  p=addRequirement(p,'不要联网');p=changeRequirement(p,p.requirements.at(-1)!.id,{status:'rejected'});
  assert.ok(makeContext(p).rejectedRequirements.includes('不要联网'));
});

test('an explicit recorded replacement is preserved even when the suggestion ledger is full',()=>{
  let p=createProject('code','beginner','导出工具');
  for(let i=0;i<80;i++)p=addRequirement(p,`保留功能${i}`);
  const id=p.requirements[0].id;p.feedback='功能0改为导出CSV';
  p=addVersion(p,{prompt:'成功返回的新提示词',summary:'导出',constraints:[],assumptions:[],conflicts:[],requirementUpdates:[{id,quote:p.feedback,source:'feedback'}]});
  assert.equal(p.draft,'成功返回的新提示词');
  assert.equal(p.requirements.find(r=>r.replacesId===id)?.status,'proposed');
});

test('ordinary Chinese requirements accepted by the UI fit the API transport budget',async()=>{
  let p=createProject('code','beginner','制作工具');
  for(let i=0;i<30;i++)p=addRequirement(p,`${i}${'中'.repeat(1490)}`);
  let calls=0;
  const r=await handleStudio(new Request('https://studio.test/api/studio',{method:'POST',body:JSON.stringify({action:'questions',context:makeContext(p)})}),{DEEPSEEK_API_KEY:'test'},async()=>{
    calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions:[1,2].map(i=>({id:`q${i}`,text:'具体功能？',hint:'',options:[]}))})}}]});
  });
  assert.equal(r.status,200);assert.equal(calls,1);
});

test('removing a current ledger entry frees capacity without erasing its version history',()=>{
  let p=addRequirement(createProject('code','beginner','导出工具'),'保留CSV');
  const id=p.requirements[0].id;
  const g={prompt:'初稿',summary:'摘要',constraints:[],assumptions:[],conflicts:[]};
  p=addVersion(p,g);const original=p.versions[0].id;
  p=removeRequirement(p,id);assert.equal(p.requirements.length,0);
  p=addVersion(p,{...g,prompt:'第二版'});
  assert.ok(p.versions.find(v=>v.id===original)?.requirementsSnapshot?.some(r=>r.id===id));
});

test('removing a legacy accepted replacement does not turn the retired fact into a prohibition',()=>{
  let p=addRequirement(createProject('code','beginner','导出工具'),'导出CSV文件');
  const id=p.requirements[0].id;p.feedback='改为导出CSV文件并增加中文表头';
  p=addVersion(p,{prompt:p.feedback,summary:'摘要',constraints:[],assumptions:[],conflicts:[],requirementUpdates:[{id,quote:p.feedback,source:'feedback'}]});
  const replacement=p.requirements.find(r=>r.replacesId===id)!;
  p=changeRequirement(p,replacement.id,{status:'confirmed'});
  for(const r of p.requirements)delete r.supersededBy;
  p=parseWorkspace(JSON.stringify({projects:[p],active:p.id}))!.projects[0];
  assert.deepEqual(makeContext(p).rejectedRequirements,[]);
  p=removeRequirement(p,replacement.id);
  assert.deepEqual(makeContext(p).rejectedRequirements,[]);
  assert.equal(p.versions.at(-1)?.requirementsSnapshot?.find(r=>r.id===id)?.supersededBy,replacement.id);
});
