'use client';
import {useState} from 'react';
import {Check, Plus, Sparkles, ListChecks, MessagesSquare, GitCompareArrows, ClipboardCheck} from 'lucide-react';
import type {Project,Requirement,QualityReport} from '@/lib/studio';
import {addRequirement,changeRequirement,pendingRequirementChanges,removeRequirement,isSupersededRequirement} from '@/lib/requirements';
import {compareLines} from '@/lib/diff';
import {reportIsCurrent} from '@/lib/reports';

const scopes={project:'全局要求',character:'角色设定',shot:'分镜要求'};
const statuses={confirmed:'已确认',proposed:'待确认',rejected:'已拒绝'};
const tabs=[{id:'requirements',label:'需求账本',icon:ListChecks},{id:'rounds',label:'历轮问答',icon:MessagesSquare},{id:'diff',label:'版本对比',icon:GitCompareArrows},{id:'quality',label:'质量报告',icon:ClipboardCheck}] as const;
type Props={project:Project;onChange:(p:Project)=>void;onEvaluate:()=>void;onRefine:(text:string)=>void};

export function ProjectInsights({project:p,onChange,onEvaluate,onRefine}:Props){
  const [tab,setTab]=useState<typeof tabs[number]['id']>('requirements');
  return <section className="insights panel" aria-label="需求与版本记录"><div className="insights-heading"><div><span className="eyebrow">KEEP THE IMPORTANT THINGS</span><h2>每一步，都有迹可循</h2></div><span className="pill">版本 {p.versions.length}</span></div>
    {pendingRequirementChanges(p).length>0&&<div className="pending-banner" style={{margin:'0 20px 12px'}}><div><strong>有 {pendingRequirementChanges(p).length} 项要求变更待核对</strong><p>原要求仍保留。请核对本轮完整原话，接受或拒绝建议后再继续优化。</p></div><button className="text-button" onClick={()=>setTab('requirements')}>核对变更 →</button></div>}
    <div className="insight-tabs" role="group" aria-label="记录面板">{tabs.map(t=><button key={t.id} aria-pressed={tab===t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}><t.icon size={15}/>{t.label}{t.id==='requirements'&&<small>{p.requirements.filter(r=>r.status==='confirmed').length}</small>}</button>)}</div>
    <div className="insight-body">{tab==='requirements'&&<Requirements p={p} onChange={onChange}/>}{tab==='rounds'&&<Rounds p={p} onChange={onChange}/>}{tab==='diff'&&<Comparison p={p}/>}{tab==='quality'&&<Quality p={p} onEvaluate={onEvaluate} onRefine={onRefine}/>}</div>
  </section>;
}
function Requirements({p,onChange}:Pick<Props,'onChange'>&{p:Project}){
  const [text,setText]=useState(''),[scope,setScope]=useState<Requirement['scope']>('project'),[error,setError]=useState('');
  const [filter,setFilter]=useState<'all'|Requirement['status']>('all');
  const [expanded,setExpanded]=useState(false);
  const priority={confirmed:0,proposed:1,rejected:2};
  const visible=p.requirements.filter(r=>filter==='all'||r.status===filter).sort((a,b)=>(a.replacesId&&a.status==='proposed'?-1:priority[a.status])-(b.replacesId&&b.status==='proposed'?-1:priority[b.status]));
  function save(fn:()=>Project){try{onChange(fn());setError('');return true;}catch(e){setError(e instanceof Error?e.message:'未能保存要求。');return false;}}
  return <><p className="insight-intro">确认你要保留的要求。问形整理的建议会先标为待确认；拒绝项也会保留，供后续优化遵循。</p>
    <div className="requirement-add"><label className="sr-only" htmlFor="requirement-text">新增明确要求</label><textarea id="requirement-text" rows={2} maxLength={1500} value={text} onChange={e=>setText(e.target.value)} placeholder="写下一条必须保留的要求，比如：角色始终穿灰白长袍。"/><div><label className="sr-only" htmlFor="requirement-scope">要求范围</label><select id="requirement-scope" value={scope} onChange={e=>setScope(e.target.value as Requirement['scope'])}>{Object.entries(scopes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button className="secondary" disabled={!text.trim()} onClick={()=>{if(save(()=>addRequirement(p,text,scope)))setText('');}}><Plus size={14}/> 添加并确认</button></div></div>
    {error&&<p className="insight-error" role="alert">{error}</p>}
    <div className="requirement-filters" role="group" aria-label="筛选要求">{(['all','confirmed','proposed','rejected'] as const).map(f=><button aria-pressed={filter===f} key={f} onClick={()=>setFilter(f)} className={filter===f?'active':''}>{f==='all'?'全部':statuses[f]} <span>{p.requirements.filter(r=>f==='all'||r.status===f).length}</span></button>)}</div>
    {!p.requirements.length&&<p className="insight-empty">这个项目还没有需求账本记录。你可以手动添加明确要求；旧版本未记录的确认过程不会被补造。</p>}
    <div className="requirement-list">{(expanded?visible:visible.slice(0,8)).map(r=><RequirementRow key={r.id} r={r} superseded={isSupersededRequirement(r,p.requirements)} onSave={patch=>save(()=>changeRequirement(p,r.id,patch))} onRemove={()=>save(()=>removeRequirement(p,r.id))}/>)}</div>{visible.length>8&&<button className="text-button" style={{marginTop:15}} onClick={()=>setExpanded(!expanded)}>{expanded?'收起更多要求':`查看其余 ${visible.length-8} 条要求`}</button>}
  </>;
}
function RequirementRow({r,onSave,onRemove,superseded}:{r:Requirement;onSave:(patch:{text?:string;status?:Requirement['status'];scope?:Requirement['scope']})=>boolean;onRemove:()=>boolean;superseded:boolean}){
  const [editing,setEditing]=useState(false),[text,setText]=useState(r.text),[scope,setScope]=useState(r.scope);
  const [removing,setRemoving]=useState(false);
  return <article className={`requirement-row ${r.status}`}><div className="requirement-meta"><span className={`status-tag ${r.status}`}>{superseded?'已被替换':statuses[r.status]}</span><span>{scopes[r.scope]}</span><span>{r.source==='user'?'来自你':r.source==='legacy'?'历史记录':r.kind==='assumption'?'问形假设':'问形建议'}</span></div>
    {removing&&<div className="conflict-note"><p>移除账本记录不会自动改写当前提示词。若不再需要其中的内容，请同时修改提示词或在继续优化时说明。历史版本和原始问答仍保留。</p><div className="row-actions"><button className="text-button reject" onClick={()=>{if(onRemove())setRemoving(false);}}>确认移除</button><button className="text-button" onClick={()=>setRemoving(false)}>取消移除</button></div></div>}
    {editing?<><label className="sr-only" htmlFor={`edit-${r.id}`}>编辑要求</label><textarea id={`edit-${r.id}`} rows={2} maxLength={1500} value={text} onChange={e=>setText(e.target.value)}/><select aria-label="修改要求范围" value={scope} onChange={e=>setScope(e.target.value as Requirement['scope'])}>{Object.entries(scopes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><div className="row-actions"><button className="secondary" onClick={()=>{if(onSave({text,scope,status:'confirmed'}))setEditing(false);}}>保存并确认</button><button className="text-button" onClick={()=>setEditing(false)}>取消</button></div></>:<><p className="requirement-text">{r.text}</p>{r.replacesId&&<p className="muted" style={{fontSize:11,marginTop:7}}>建议替换：{r.previousText}</p>}<details className="requirement-source" open={r.replacesId&&r.status==='proposed'?true:undefined}><summary>查看来源</summary><p>{r.sourceDetail}</p>{r.previousText&&<p>此前内容：{r.previousText}</p>}</details><div className="row-actions">{r.status!=='confirmed'&&<button className="text-button" onClick={()=>onSave({status:'confirmed'})}><Check size={13}/>{r.replacesId&&r.status==='proposed'?'接受替换':r.status==='rejected'?'重新确认':'确认保留'}</button>}<button className="text-button" onClick={()=>{setText(r.text);setScope(r.scope);setEditing(true);}}>编辑要求</button>{r.status!=='rejected'&&<button className="text-button reject" onClick={()=>onSave({status:'rejected'})}>拒绝这项</button>}<button className="text-button reject" onClick={()=>setRemoving(true)}>移除记录</button></div></>}
  </article>;
}
function Rounds({p,onChange}:Pick<Props,'onChange'>&{p:Project}){
  const [error,setError]=useState('');const activeIds=p.versions.at(-1)?.roundIds??[];
  function confirm(text:string,round:number){try{onChange(addRequirement(p,text,'project',`你从第 ${round} 轮原始问答中确认的内容`));setError('');}catch(e){setError(e instanceof Error?e.message:'未能确认要求。');}}
  return <><p className="insight-intro">保留每次生成前的原始回答、反馈和遗漏补充。恢复旧版后，后续轮次仍可查阅，模型只接收当前分支最近两轮的摘要。</p>{error&&<p className="insight-error" role="alert">{error}</p>}{!p.rounds.length&&<p className="insight-empty">历史版本没有保存原始问答；从下一次生成开始记录。</p>}
    {[...p.rounds].reverse().map((r)=>{const n=p.rounds.indexOf(r)+1;return <details key={r.id} className="round-record"><summary><span>第 {n} 轮 <small>{activeIds.includes(r.id)?'当前分支':'历史分支'}</small></span><time>{new Date(r.createdAt).toLocaleString('zh-CN',{hour12:false})}</time></summary><div className="round-detail"><p><b>当时的方向</b>{r.goal}</p>{r.answers.map(a=><div className="raw-answer" key={a.questionId}><b>{a.question}</b><p>{a.answer||'未填写（本轮由问形提出假设）'}</p>{a.answer.trim()&&a.answer.length<=1500&&<button className="text-button" onClick={()=>confirm(a.answer,n)}>把这条回答确认为要求</button>}</div>)}{[['当轮反馈',r.feedback],['遗漏补充',r.omissions]].map(([title,value])=>value&&<div className="raw-answer" key={title}><b>{title}</b><p>{value}</p>{value.length<=1500&&<button className="text-button" onClick={()=>confirm(value,n)}>将原话确认为要求</button>}</div>)}</div></details>;})}
  </>;
}
function Comparison({p}:{p:Project}){
  const last=p.versions.at(-1)!;
  const [leftId,setLeftId]=useState(p.versions.at(-2)?.id??'original'),[rightId,setRightId]=useState(last.id);
  const value=(id:string)=>id==='original'?(last.generatedPrompt??last.prompt):id===last.id?p.draft:p.versions.find(v=>v.id===id)?.prompt??'';
  const left=leftId==='original'?(last.generatedPrompt?'original':last.id):p.versions.some(v=>v.id===leftId)?leftId:last.id;
  const right=rightId==='original'&&last.generatedPrompt?'original':p.versions.some(v=>v.id===rightId)?rightId:last.id;
  const diff=compareLines(value(left),value(right));
  function choices(){return <>{last.generatedPrompt&&<option value="original">当前版本 · 生成原稿</option>}{p.versions.map((v,i)=><option value={v.id} key={v.id}>版本 {i+1}{v.id===last.id?' · 当前编辑稿':''}{v.sourceVersionId?' · 恢复版':''}</option>)}</>;}
  return <><p className="insight-intro">选择两份文本，查看增删内容。对比在当前浏览器完成，不额外调用模型。生成原稿和手动编辑稿分别保留。</p><div className="diff-selectors"><label>对比之前<select value={left==='original'&&!last.generatedPrompt?last.id:left} onChange={e=>setLeftId(e.target.value)}>{choices()}</select></label><span>→</span><label>对比之后<select value={right} onChange={e=>setRightId(e.target.value)}>{choices()}</select></label></div><div className="diff-legend"><span className="added">新增 {diff.added} 字符</span><span className="removed">删除 {diff.removed} 字符</span><span>未标色为相同内容</span></div>{diff.added===0&&diff.removed===0&&<p className="insight-empty">这两份文本完全一致。</p>}<pre className="diff-preview" aria-label="版本文本差异">{diff.chunks.map((c,i)=><span key={i} className={c.type}>{c.text}</span>)}</pre></>;
}
function Quality({p,onEvaluate,onRefine}:{p:Project;onEvaluate:()=>void;onRefine:(text:string)=>void}){
  const latest=p.versions.at(-1)!;const assessment=p.assessment??latest.assessment;
  return <><div className="quality-intro"><p className="insight-intro">结构检查随生成提供。主动评估会将当前提示词和需求发送给问形，给出有依据的改进建议；它不代表代码或图片、视频的实际运行效果。</p><button className="secondary" onClick={onEvaluate} disabled={!p.draft.trim()}><Sparkles size={14}/>{assessment?'重新评估当前稿':'评估当前稿'}</button></div>{latest.qualityReport?<Report report={latest.qualityReport} p={p} onRefine={onRefine}/>:<p className="insight-empty">这个旧版本没有结构检查记录。你可以主动评估当前稿。</p>}{assessment&&<Report report={assessment} p={p} onRefine={onRefine}/>}</>;
}
function Report({report:r,p,onRefine}:{report:QualityReport;p:Project;onRefine:(text:string)=>void}){
  const fresh=reportIsCurrent(r,p);
  return <article className={`quality-report ${fresh?'':'stale'}`}><div className="report-heading"><h3>{r.kind==='automatic'?'自动结构检查':'问形内容评估'}</h3><span className={`status-tag ${fresh?'confirmed':'proposed'}`}>{fresh?'对应当前稿':'已过期'}</span></div><small className="report-time">{new Date(r.createdAt).toLocaleString('zh-CN',{hour12:false})}</small>{!fresh&&<p className="stale-note">提示词、已确认要求或拒绝项已改变，这份报告仅供历史参考。</p>}<p>{r.summary}</p><div className="report-checks">{r.checks.map((c,i)=><div key={i}><Check size={14}/><p><b>{c.label}</b>{c.evidence}</p></div>)}</div>{r.findings.map((f,i)=><div className="report-finding" key={i}><span className="finding-label">{f.severity==='issue'?'需要处理':'可选优化'}</span><h4>{f.title}</h4><p>{f.reason}</p>{f.evidenceQuote?<blockquote>{f.evidenceQuote}</blockquote>:<small>此项针对缺失或待确认内容，没有可引用的现有原文。</small>}<p className="finding-suggestion">建议：{f.suggestion}</p><button className="text-button" disabled={!fresh} onClick={()=>onRefine(`${f.title}：${f.suggestion}`)}>带入继续优化 →</button></div>)}{r.kind==='ai'&&!r.findings.length&&<p className="insight-empty">本次评估未提出新问题，你仍可按实际使用效果继续调整。</p>}</article>;
}
