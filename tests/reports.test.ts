import {test} from 'node:test';import assert from 'node:assert/strict';
import {createProject,addVersion,makeContext} from '../lib/studio.ts';import {addRequirement} from '../lib/requirements.ts';
import {createAutomaticReport,validateAssessment,reportIsCurrent,attachAssessment} from '../lib/reports.ts';
import {fixture} from './fixtures/visual.ts';
test('automatic reports describe actual validated structure and become stale after editing or changing requirements',()=>{
  const p=addVersion(createProject('video','beginner','50秒两名武者'),fixture());
  const report=createAutomaticReport(p.draft,makeContext(p),fixture());
  assert.ok(report.checks.some(x=>x.evidence.includes('50')));assert.equal(reportIsCurrent(report,p),true);
  assert.equal(reportIsCurrent(report,{...p,draft:p.draft+'修改'}),false);
  assert.equal(reportIsCurrent(report,addRequirement(p,'不出现额外人物')),false);
});
test('assessment rejects invented quotations and cannot overwrite changed text',()=>{
  const p=addVersion(createProject('code','beginner','导出文件'),{prompt:'实现CSV导出，支持中文表头。',summary:'导出',constraints:[],assumptions:[],conflicts:[]});
  const data={summary:'需要补充异常处理',strengths:['格式已明确'],findings:[{severity:'suggestion',title:'补充失败提示',reason:'尚未明确失败行为',evidenceQuote:'支持中文表头',suggestion:'说明写入失败时的用户提示'}]};
  const report=validateAssessment(data,p.draft,makeContext(p));assert.equal(report.kind,'ai');
  assert.equal(attachAssessment(p,report).assessment?.summary,'需要补充异常处理');
  const edited={...p,draft:'已经改过的内容'};assert.equal(attachAssessment(edited,report),edited);
  assert.throws(()=>validateAssessment({...data,findings:[{...data.findings[0],evidenceQuote:'原文没有的话'}]},p.draft,makeContext(p)));
});
