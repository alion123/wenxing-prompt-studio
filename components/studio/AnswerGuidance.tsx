import type {Project} from '@/lib/studio';
import {answerGuidance,uncertainQuestionNumbers} from '@/lib/answer-guidance';
import {Lightbulb} from 'lucide-react';

export function AnswerGuidance({project,onDelegate}:{project:Project;onDelegate:()=>void}){
  const numbers=uncertainQuestionNumbers(project),multiple=numbers.length>=2;
  const guidance=answerGuidance[project.type];
  return <div className={`answer-guidance${multiple?' needs-detail':''}`} role="status" aria-live="polite">
    <Lightbulb size={18} aria-hidden="true"/>
    <div><strong>{multiple?`第 ${numbers.join('、')} 题还没确定，建议先补充一点信息`:'不确定也可以继续，先说清楚你已经知道的部分'}</strong>
      <p>{multiple?'多项选择“不确定”时，可用信息可能不足，生成结果可能不够具体或暂时无法生成。':'如果多项选择“不确定”或留空，生成结果可能不够具体或暂时无法生成。'} 建议至少说明{guidance.focus}，不必每题都想清楚。</p>
      {multiple&&<p>可以在任意一题或下方补充栏写一句，例如：{guidance.example}</p>}
      <p className="guidance-note">仍然可以直接尝试生成；问形会把推断标为待确认。生成失败时，已有回答和原稿会保留。</p>
    <button className="text-button" onClick={onDelegate}>其余由问形决定</button><p className="guidance-note">只补充空白或不确定的回答；你已写明的内容会保留。</p></div>
  </div>;
}
