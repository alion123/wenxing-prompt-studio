import type {Project} from './studio.ts';
import {needsSuggestions,validateSuggestions,type Suggestion} from './suggestions.ts';
export type Step=0|1|2|3;
export const stepLabels=['选择方向','聊聊需求','预览与打磨','完成提示词'] as const;
export function questionsForReview(p:Project){
  if(p.questions.length)return {questions:p.questions,answers:p.answers,feedback:p.feedback,omissions:p.omissions};
  const round=p.rounds.find(r=>r.id===p.versions.at(-1)?.roundId);
  return {questions:round?.answers.map(a=>({id:a.questionId,text:a.question,hint:a.hint??'这条旧记录未保存原来的建议选项，系统会按原问题补齐建议；原回答保留。失败时可点击“补全建议选项”重试。',options:a.options?[...a.options]:['不确定，请问形给出具体建议']}))??[],answers:Object.fromEntries(round?.answers.map(a=>[a.questionId,a.answer])??[]),feedback:(p.stage==='refine'||p.pendingRefinement)?p.feedback:round?.feedback??'',omissions:(p.stage==='refine'||p.pendingRefinement)?p.omissions:round?.omissions??''};
}
export function canEditStep(p:Project,step:Step){return step===0||step===1&&(p.stage==='refine'||p.pendingRefinement||questionsForReview(p).questions.length>0)||step>=2&&p.versions.length>0;}
export function editStep(p:Project,step:Step):Project{
  if(!canEditStep(p,step))return p;
  const pending=p.pendingRefinement||p.stage==='refine'&&!p.questions.length;
  const working=pending?{...p,pendingRefinement:true}:p;
  if(step===0)return {...working,stage:'setup',status:'draft'};
  if(step===1){if(pending&&!p.questions.length)return {...working,stage:'refine',status:'draft'};const round=questionsForReview(p);return {...working,...round,stage:round.questions.length?'questions':'refine',status:'draft'};}
  return {...working,stage:'preview',status:'draft'};
}
export function suggestionTarget(p:Project){
  const reviewed=questionsForReview(p),questions=reviewed.questions.filter(needsSuggestions);
  if(!questions.length)return null;
  const round=p.rounds.find(r=>r.id===p.versions.at(-1)?.roundId);
  const sameRound=round&&round.answers.length===reviewed.questions.length&&round.answers.every(a=>reviewed.questions.some(q=>q.id===a.questionId&&q.text===a.question));
  return {attemptKey:JSON.stringify([p.id,p.versions.at(-1)?.id,questions.map(q=>[q.id,q.text])]),projectId:p.id,questions:structuredClone(questions),roundId:sameRound?round.id:undefined,key:JSON.stringify([p.id,p.versions.at(-1)?.id,p.questions.length?'active':'history',reviewed.questions])};
}
export function applySuggestions(p:Project,target:NonNullable<ReturnType<typeof suggestionTarget>>,items:Suggestion[]):Project{
  if(suggestionTarget(p)?.key!==target.key)throw Error('原问题已变化，建议未覆盖当前内容，请重试。');
  const validated=validateSuggestions({suggestions:items},target.questions),byId=new Map(validated.map(s=>[s.id,s]));
  const questions=p.questions.map(q=>{const s=byId.get(q.id);return s?{...q,hint:s.hint,options:[...s.options]}:q;});
  const rounds=p.rounds.map(r=>r.id!==target.roundId?r:{...r,answers:r.answers.map(a=>{const s=byId.get(a.questionId);return s?{...a,hint:s.hint,options:[...s.options]}:a;})});
  return {...p,questions,rounds};
}
