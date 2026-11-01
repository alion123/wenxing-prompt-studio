import type {Project} from './studio.ts';
type Answers=Pick<Project,'questions'|'answers'|'type'>;
export const answerGuidance={
  code:{focus:'给谁用、要解决什么问题、最重要的功能',example:'给自己用的记账网页，能记录收支并按月汇总，数据保存在本地。'},
  image:{focus:'画面主体、图片用途、最想呈现的内容',example:'用于咖啡店宣传的海报，主体是一杯热拿铁，背景温暖简洁。'},
  video:{focus:'视频用途、画面主体、最重要的动作或流程',example:'给客户看的10秒工厂宣传视频，以设备为主，展示加工、质检和包装。'},
  copy:{focus:'写给谁、想表达什么、希望读者做什么',example:'写给附近居民的书店开业推文，介绍安静的阅读环境，邀请周末到店。'},
  custom:{focus:'具体任务、使用场景、希望得到的结果',example:'为零基础学习者制定每天20分钟的英语口语计划，按周安排练习。'},
} as const;

// Only standalone undecided answers count; mentioning uncertainty alongside real details does not.
const undecided=/^(?:(?:暂时|暂|还)?(?:不确定|不知道|没想好|未确定)|都可以|你来决定|由你决定|随便)(?:[，,：:]?(?:请你|请|你)?(?:给我|给|提供)(?:一个|个)?(?:通用)?(?:示例|例子|建议))?[。.!！]?$/;
export function uncertainQuestionNumbers(project:Answers):number[]{
  return project.questions.flatMap((q,index)=>{
    const answer=Object.hasOwn(project.answers,q.id)?project.answers[q.id]:'';
    return typeof answer==='string'&&undecided.test(answer.trim())?[index+1]:[];
  });
}
export function generationErrorMessage(code:string|undefined,message:string,project:Answers):string{
  const numbers=uncertainQuestionNumbers(project);
  if(!['insufficient_detail','invalid_response'].includes(code??'')||numbers.length<2)return message;
  const guidance=answerGuidance[project.type];
  return `${message} 上次提交时，第 ${numbers.join('、')} 题尚不确定，可以先补充其中一题，或在补充栏说明${guidance.focus}。例如：“${guidance.example}”你的回答和原稿已保留，可以补充后再试，也可以直接重试。`;
}
