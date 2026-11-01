import type {Project} from './studio.ts';
import {answerFor} from './studio.ts';
import {uncertainQuestionNumbers} from './answer-guidance.ts';
export const DELEGATE_ANSWER='暂不确定，请问形根据当前需求决定具体初稿；补定内容标为待确认，保留我的已确认要求。';
export function delegateAnswer(answer:string):string{
  if(answer.includes(DELEGATE_ANSWER))return answer;
  const uncertain=uncertainQuestionNumbers({type:'custom',questions:[{id:'answer',text:'',hint:'',options:[]}],answers:{answer}}).length>0;
  const next=!answer.trim()||uncertain?DELEGATE_ANSWER:`${answer}\n${DELEGATE_ANSWER}`;
  if(next.length>4000)throw Error('这条回答已接近4000字符，请先精简后再委托，原回答未改变。');
  return next;
}
export function delegateUnresolved(p:Project){
  const undecided=new Set(uncertainQuestionNumbers(p));
  return Object.fromEntries(p.questions.map((q,i)=>[q.id,!answerFor(p,q.id).trim()||undecided.has(i+1)?DELEGATE_ANSWER:answerFor(p,q.id)]));
}
