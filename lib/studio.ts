import {mergeSuggestions, validateRequirementUpdates,isSupersededRequirement,preserveRequirementSnapshot} from './requirements.ts';
import type {ReferenceImage} from './references.ts';
export type Kind = 'code' | 'image' | 'video' | 'copy' | 'custom';
export type Mode = 'beginner' | 'advanced';
export type Question = { id: string; text: string; hint: string; options: string[] };
export type Requirement = {id:string; text:string; status:'confirmed'|'proposed'|'rejected'; source:'user'|'model'|'legacy'; sourceDetail:string; scope:'project'|'character'|'shot'; kind:'requirement'|'assumption'; createdAt:string; updatedAt:string; sourceRoundId?:string; previousText?:string;replacesId?:string;supersededBy?:string};
export type Round = {id:string;versionId:string;createdAt:string;goal:string;mode:Mode;feedback:string;omissions:string;answers:{questionId:string;question:string;answer:string;hint?:string;options?:string[]}[]};
export type RequirementUpdate = {id:string;quote:string;source:'feedback'|'omissions'|'answer';questionId?:string};
export type Finding = {severity:'issue'|'suggestion';title:string;reason:string;evidenceQuote:string;suggestion:string};
export type QualityReport = {kind:'automatic'|'ai';createdAt:string;prompt:string;requirementsKey:string;summary:string;checks:{label:string;evidence:string}[];findings:Finding[];versionId?:string};
export type Generation = { prompt: string; summary: string; constraints: string[]; assumptions: string[]; conflicts: string[]; requirementUpdates?:RequirementUpdate[];qualityReport?:QualityReport };
export type Version = Generation & { id: string; createdAt: string; label?: string;generatedPrompt?:string;parentVersionId?:string;sourceVersionId?:string;roundId?:string;roundIds?:string[];requirementsSnapshot?:Requirement[];assessment?:QualityReport };
export type Project = {
  id: string; type: Kind; mode: Mode; goal: string; createdAt: string; updatedAt: string;
  pendingRefinement?:boolean;
  references?:ReferenceImage[];
  status: 'draft' | 'completed'; stage: 'setup' | 'questions' | 'preview' | 'refine';
  questions: Question[]; answers: Record<string, string>; feedback: string; omissions: string;
  draft: string; versions: Version[];
  requirements:Requirement[];rounds:Round[];assessment?:QualityReport;
};
export function createProject(type: Kind, mode: Mode, goal: string): Project {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), type, mode, goal, createdAt: now, updatedAt: now,
    status: 'draft', stage: 'setup', questions: [], answers: {}, feedback: '', omissions: '', draft: '', versions: [],requirements:[],rounds:[] };
}
export function addVersion(project: Project, result: Generation): Project {
  const working={...project};delete working.assessment;delete working.pendingRefinement;
  const now = new Date().toISOString();
  const versions = project.versions.map((v, i) => i === project.versions.length - 1 ? { ...v, prompt: project.draft,requirementsSnapshot:preserveRequirementSnapshot(project) } : v);
  const id=crypto.randomUUID(), roundId=crypto.randomUUID();
  const updates=validateRequirementUpdates(result.requirementUpdates,makeContext(project));
  let requirements=structuredClone(project.requirements??[]);
  for(const u of updates){
    const prior=requirements.find(r=>r.id===u.id)!;
    const input=u.source==='answer'?answerFor(project,u.questionId!):u.source==='feedback'?project.feedback:project.omissions;
    // Explicit replacements must be recorded even when optional suggestions have reached capacity.
    requirements.push({id:crypto.randomUUID(),text:u.quote,status:'proposed',source:'model',sourceDetail:`问形建议替换「${prior.text}」。本轮完整${u.source==='answer'?'回答':u.source==='omissions'?'补充':'反馈'}原文：${input}`,scope:prior.scope,kind:'requirement',createdAt:now,updatedAt:now,sourceRoundId:roundId,previousText:prior.text,replacesId:prior.id});
  }
  requirements=mergeSuggestions(requirements,result,roundId,project.type);
  const round:Round={id:roundId,versionId:id,createdAt:now,goal:project.goal,mode:project.mode,feedback:project.feedback,omissions:project.omissions,
    answers:project.questions.map(q=>({questionId:q.id,question:q.text,hint:q.hint,options:[...q.options],answer:answerFor(project,q.id)}))};
  const roundIds=[...(project.versions.at(-1)?.roundIds??[]),roundId];
  return { ...working, stage: 'preview', status: 'draft', draft: result.prompt, updatedAt: now,
    questions: [], answers: {}, feedback: '', omissions: '',
    requirements,rounds:[...(project.rounds??[]),round],
    versions: [...versions, { ...result, id, createdAt: now,generatedPrompt:result.prompt,...(versions.length?{parentVersionId:versions.at(-1)!.id}:{}),roundId,roundIds,requirementsSnapshot:structuredClone(requirements),...(result.qualityReport?{qualityReport:{...result.qualityReport,versionId:id}}:{}) }] };
}
export function restoreVersion(project: Project, id: string): Project {
  const working={...project};delete working.assessment;delete working.pendingRefinement;
  const version = project.versions.find(v => v.id === id);
  if (!version) return project;
  const now=new Date().toISOString();
  const versions=project.versions.map((v,i)=>i===project.versions.length-1?{...v,prompt:project.draft,requirementsSnapshot:preserveRequirementSnapshot(project)}:v);
  const source=versions.find(v=>v.id===id)!;
  const requirements=source.requirementsSnapshot?structuredClone(source.requirementsSnapshot):mergeSuggestions([],source,undefined,project.type,'legacy');
  const restored:Version={...structuredClone(source),id:crypto.randomUUID(),createdAt:now,label:'从历史版本恢复',sourceVersionId:source.id,parentVersionId:versions.at(-1)?.id,requirementsSnapshot:structuredClone(requirements)};
  if(restored.qualityReport)restored.qualityReport={...restored.qualityReport,versionId:restored.id};
  if(restored.assessment)restored.assessment={...restored.assessment,versionId:restored.id};
  return {...working,status:'draft',stage:'preview',draft:source.prompt,updatedAt:now,requirements,questions:[],answers:{},feedback:'',omissions:'',versions:[...versions,restored]};
}
export function makeContext(project: Project) {
  const active = project.versions.at(-1);
  return { type: project.type, mode: project.mode, goal: project.goal,
    references:project.references??[],
    currentPrompt: project.draft, summary: active?.summary ?? '', constraints: active?.constraints ?? [],
    assumptions: active?.assumptions ?? [], feedback: project.feedback, omissions: project.omissions,
    questions: project.questions, answers: project.answers,activeVersionId:active?.id,
    confirmedRequirements:(project.requirements??[]).filter(r=>r.status==='confirmed').map(r=>({id:r.id,text:r.text,scope:r.scope})),
    rejectedRequirements:(project.requirements??[]).filter(r=>r.status==='rejected'&&!isSupersededRequirement(r,project.requirements)).map(r=>r.text),
    recentRounds:(active?.roundIds??[]).slice(-2).flatMap(id=>{
      const r=(project.rounds??[]).find(x=>x.id===id);return r?[{id:r.id,feedback:r.feedback.slice(0,800),omissions:r.omissions.slice(0,800),answers:r.answers.map(a=>({question:a.question,answer:a.answer.slice(0,800)}))}]:[];
    }) };
}
export type StudioContext = ReturnType<typeof makeContext>;
export function resumeQuestionRound(project: Project): Project | null {
  return project.questions.length ? { ...project, stage: 'questions' } : null;
}
export function answerFor(project: Project, id: string): string {
  return Object.hasOwn(project.answers, id) && typeof project.answers[id] === 'string' ? project.answers[id] : '';
}
