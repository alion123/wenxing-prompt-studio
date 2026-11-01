import type {Project} from '@/lib/studio';
import {questionsForReview,stepLabels,type Step} from '@/lib/step-review';
const kinds={code:'代码开发',image:'图片创作',video:'视频制作',copy:'文案写作',custom:'更多可能'};
export function StepReview({project:p,step}:{project:Project;step:Step}){
  const round=questionsForReview(p),hasDraft=p.versions.length>0;
  return <section className="panel step-review" aria-label={`${stepLabels[step]}只读查看`}><span className="eyebrow">READ ONLY</span><h2>{stepLabels[step]} <span className="pill">只读查看</span></h2>
    {step===0&&<><p>方向：{kinds[p.type]} · {p.mode==='beginner'?'轻松入门':'进阶创作'}</p><label htmlFor="review-goal">你想做什么？</label><textarea id="review-goal" value={p.goal} readOnly rows={4}/></>}
    {step===1&&<>{round.questions.map((q,i)=><div className="review-answer" key={q.id}><label htmlFor={`review-${q.id}`}>{i+1}. {q.text}</label>{q.hint&&<p className="muted">{q.hint}</p>}<div className="answer-options" aria-label="建议选项（只读）">{q.options.map(option=><span className="review-option" key={option}>{option}</span>)}</div><textarea id={`review-${q.id}`} value={round.answers[q.id]??''} placeholder="未填写" readOnly rows={3}/></div>)}{round.feedback&&<><label htmlFor="review-feedback">优化反馈</label><textarea id="review-feedback" value={round.feedback} readOnly rows={3}/></>}{round.omissions&&<><label htmlFor="review-omissions">补充说明</label><textarea id="review-omissions" value={round.omissions} readOnly rows={3}/></>}{!round.questions.length&&!round.feedback&&!round.omissions&&<p>这一阶段还没有可查看的问答。可以继续当前步骤，或等待正在进行的提问完成。</p>}</>}
    {step>=2&&<>{step===3&&<p>{p.status==='completed'?'你已完成这份提示词。':'这份提示词尚未标记完成。查看本步骤不会自动完成。'}</p>}{hasDraft?<textarea className="review-prompt" aria-label="只读提示词" value={p.draft} readOnly rows={16}/>:<p>还没有生成提示词。已有填写内容仍保留在前面的步骤中。</p>}</>}
  </section>;
}
