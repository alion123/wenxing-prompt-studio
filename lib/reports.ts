import type {Project,StudioContext,QualityReport} from './studio.ts';
import {z} from 'zod';
import {makeContext} from './studio.ts';
import {referencesKey} from './references.ts';
function requirementsKey(context:StudioContext):string{
  return JSON.stringify({confirmed:(context.confirmedRequirements??[]).map(r=>({id:r.id,text:r.text,scope:r.scope})).sort((a,b)=>a.id.localeCompare(b.id)),rejected:[...(context.rejectedRequirements??[])].sort(),...(context.references?.length?{references:referencesKey(context.references)}:{})});
}
export function createAutomaticReport(prompt:string,context:StudioContext,result:unknown):QualityReport {
  const g=result as {visualPlan?:{shots?:unknown[];characters?:unknown[];totalSeconds?:number};conflicts?:string[]};
  const checks=[{label:'返回内容与字段',evidence:'已通过格式与长度检查；不代表已经验证实际生成效果。'}];
  const plan=g.visualPlan;
  if(plan){checks.push({label:'视觉信息',evidence:`已具备具体风格、场景与构图；角色设定 ${plan.characters?.length??0} 项。`});
    if(plan.shots?.length)checks.push({label:'镜头时间轴',evidence:`${plan.shots.length} 个镜头，合计 ${plan.totalSeconds} 秒；已检查连续时间、角色引用和动作起止字段。`});}
  return {kind:'automatic',createdAt:new Date().toISOString(),prompt,requirementsKey:requirementsKey(context),...(context.activeVersionId?{versionId:context.activeVersionId}:{}),
    summary:'结构检查已完成。内容是否符合你的创作目标，可以继续评估和预览确认。',checks,
    findings:(g.conflicts??[]).slice(0,6).map(x=>({severity:'issue',title:'有要求需要确认',reason:x,evidenceQuote:'',suggestion:'请在继续优化时明确这项要求的取舍。'}))};
}
const text=z.string().trim().min(1).max(1500);
const assessment=z.object({summary:text,strengths:z.array(text).max(6),findings:z.array(z.object({severity:z.enum(['issue','suggestion']),title:text,reason:text,evidenceQuote:z.string().max(1500),suggestion:text})).max(6)});
export function validateAssessment(data:unknown,prompt:string,context:StudioContext):QualityReport {
  const r=assessment.parse(data);
  if(r.findings.some(f=>f.evidenceQuote&&!prompt.includes(f.evidenceQuote)))throw Error('评估引用未能与原文匹配。');
  return {kind:'ai',createdAt:new Date().toISOString(),prompt,requirementsKey:requirementsKey(context),summary:r.summary,
    checks:r.strengths.map(s=>({label:'问形认为值得保留',evidence:s})),findings:r.findings,...(context.activeVersionId?{versionId:context.activeVersionId}:{})};
}
export function reportIsCurrent(report:QualityReport,project:Project):boolean {
  return report.prompt===project.draft&&report.requirementsKey===requirementsKey(makeContext(project))&&(!report.versionId||report.versionId===project.versions.at(-1)?.id);
}
export function attachAssessment(project:Project,report:QualityReport):Project {
  if(!reportIsCurrent(report,project))return project;
  return {...project,assessment:report,versions:project.versions.map((v,i)=>i===project.versions.length-1?{...v,assessment:report}:v)};
}
