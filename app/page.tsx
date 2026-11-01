'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeft, Plus, Sparkles, Code2, Image as ImageIcon, Video, PenLine, WandSparkles, Check, ChevronDown, Copy, Download, History, Trash2, RotateCcw, X, CircleHelp, SlidersHorizontal, ShieldCheck, LoaderCircle, CheckCheck, MessageCircle, Layers, Lightbulb, Star } from 'lucide-react';
import { createProject, addVersion, restoreVersion, makeContext, resumeQuestionRound, answerFor, type Kind, type Project, type Question, type Generation } from '@/lib/studio';
import { parseWorkspace } from '@/lib/persistence';
import {attachAssessment} from '@/lib/reports';
import {ProjectInsights} from '@/components/studio/ProjectInsights';
import {pendingRequirementChanges} from '@/lib/requirements';
import {AnswerGuidance} from '@/components/studio/AnswerGuidance';
import {generationErrorMessage} from '@/lib/answer-guidance';
import {readStudioResponse,StudioApiError,requestFailureMessage} from '@/lib/api-response';
import {saveWorkspace,WorkspaceConflictError} from '@/lib/workspace-storage';
import {delegateUnresolved,delegateAnswer,DELEGATE_ANSWER} from '@/lib/delegation';
import {mergeBackup,type Workspace} from '@/lib/backup';
import {BackupImport} from '@/components/studio/BackupImport';
import {createRequestLifecycle} from '@/lib/request-lifecycle';
import {StepReview} from '@/components/studio/StepReview';
import {ReferenceImages} from '@/components/studio/ReferenceImages';
import {FavoriteLibrary} from '@/components/studio/FavoriteLibrary';
import {recordUse,saveFavorite,dismissFavorite,removeFavorite,reuseFavorite,promptIdentity,type PromptEntry} from '@/lib/favorites';
import {stepLabels,canEditStep,editStep,questionsForReview,suggestionTarget,applySuggestions,type Step} from '@/lib/step-review';

import {AccountSession} from '@/components/studio/AccountSession';
import {AccountPanel} from '@/components/studio/AccountPanel';
const TYPES = [
  { id: 'code', label: '代码开发', en: 'CODE', icon: Code2, description: '网站、应用、脚本', example: '我想做一个简洁的个人记账网页，能按月查看支出。' },
  { id: 'image', label: '图片创作', en: 'IMAGE', icon: ImageIcon, description: '海报、插画、摄影', example: '我想生成一张咖啡品牌的春日海报，温暖、有自然感。' },
  { id: 'video', label: '视频制作', en: 'VIDEO', icon: Video, description: '短片、广告、分镜', example: '我想做一段 15 秒的城市旅行短片，记录清晨的街道。' },
  { id: 'copy', label: '文案写作', en: 'WRITING', icon: PenLine, description: '文章、营销、故事', example: '我想为一家新开的独立书店写一篇温暖的开业推文。' },
  { id: 'custom', label: '更多可能', en: 'EXPLORE', icon: WandSparkles, description: '任何值得探索的想法', example: '我想制定一个适合零基础学习者的英语口语练习计划。' },
] as const;

export default function Page(){return <AccountSession>{storageKey=><Studio key={storageKey} storageKey={storageKey}/>}</AccountSession>;}

function Studio({storageKey}:{storageKey:string}) {
  const KEY=storageKey;
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState('');
  const [library,setLibrary]=useState<PromptEntry[]>([]);
  const libraryRef=useRef<PromptEntry[]>([]);
  const [suggestionId,setSuggestionId]=useState('');
  function changeLibrary(next:PromptEntry[]){libraryRef.current=next;setLibrary(next);}
  const workspace=()=>({projects,active,...(library.length?{library}:{})});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'questions' | 'generate' | 'evaluate' | 'suggestions' | 'import' | null>(null);
  const [requests]=useState(createRequestLifecycle);
  const [reviewStep,setReviewStep]=useState<Step|null>(null);
  const [navigationEditable,setNavigationEditable]=useState(false);
  const suggestionAttempts=useRef(new Set<string>());
  useEffect(()=>()=>requests.cancel(),[requests]);
  const [referenceBusy,setReferenceBusy]=useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [writeBlocked, setWriteBlocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'help' | 'settings' | 'versions' | 'delete' | 'reask' | 'favorites' | 'favoriteSuggestion' | null>(null);
  const [deleteId, setDeleteId] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRaw=useRef<string|null>(null);
  const savedState=useRef<string|null>(null);
  const p = projects.find(x => x.id === active);
  const selectedType = TYPES.find(t => t.id === p?.type) || TYPES[0];
  const latest = p?.versions.at(-1);
  const savedPrompt=library.find(x=>x.saved&&p&&promptIdentity(x.prompt)===promptIdentity(p.draft));
  const suggestedPrompt=library.find(x=>x.id===suggestionId);
  const pendingChanges=p?pendingRequirementChanges(p).length:0;
  const missingSuggestions=p&&(reviewStep===1||(reviewStep===null&&p.stage==='questions'))?suggestionTarget(p):null;
  const suggestionKey=missingSuggestions?.attemptKey;


  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      savedRaw.current=raw;
      const saved = parseWorkspace(raw);
      savedState.current=saved?JSON.stringify(saved):null;
      changeLibrary(saved?.library??[]);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only storage after hydration, keeping the server shell deterministic.
      if (saved?.projects.length) { setProjects(saved.projects); setActive(saved.projects.some((x: Project) => x.id === saved.active) ? saved.active : saved.projects[0].id); }
      else { const first = createProject('code', 'beginner', ''); setProjects([first]); setActive(first.id); }
    } catch {
      const first = createProject('code', 'beginner', ''); setProjects([first]); setActive(first.id);
      setWriteBlocked(true);
      setStorageError('无法读取本地记录，原始记录未被覆盖。本次内容不会自动保存，请及时复制或下载。');
    }
    setReady(true);
    const onStorage=(event:StorageEvent)=>{
      if((event.key===KEY||event.key===null)&&event.newValue!==savedRaw.current){setWriteBlocked(true);setStorageError('另一个页面已更新或清空工作区。本页已暂停自动保存，请先下载本页备份，再刷新读取最新记录。');}
    };
    window.addEventListener('storage',onStorage);
    fetch('/api/status').then(r => { if (!r.ok) throw Error(); return r.json() as Promise<{ configured: boolean }>; }).then(s => setConfigured(s.configured === true)).catch(() => setConfigured(null));
    return () => { window.removeEventListener('storage',onStorage);if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, []);
  useEffect(() => {
    if (!ready || writeBlocked) return;
    let cancelled=false;
    const persist=()=>{if(cancelled)return;const next=JSON.stringify({projects,active,...(library.length?{library}:{})});if(saveWorkspace(localStorage,KEY,savedRaw.current,next,savedState.current)){savedRaw.current=next;savedState.current=next;}};
    const failed=(e:unknown)=>{if(cancelled)return;if(e instanceof WorkspaceConflictError){setWriteBlocked(true);setStorageError(e.message);}else setStorageError('浏览器存储不可用或空间不足。当前内容仍在，请及时复制或下载保存。');};
    try { if(navigator.locks)void navigator.locks.request(KEY,persist).catch(failed);else persist(); }catch(e){failed(e);}
    return ()=>{cancelled=true;};
  }, [projects, active, library, ready, writeBlocked]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const items = modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary');
        if (!items?.length) return;
        const first = items[0], last = items[items.length-1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    modalRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [modal]);

  function toast(message: string) {
    setNotice(message); if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3000);
  }
  function update(changes: Partial<Project>) {
    setProjects(all => all.map(item => item.id === active ? { ...item, ...(item.stage==='refine'&&!item.questions.length&&changes.stage&&changes.stage!=='questions'?{pendingRefinement:true}:{}), ...changes, updatedAt: new Date().toISOString() } : item));
  }
  function newProject() {
    if (busy||referenceBusy) return;
    const next = createProject('code', p?.mode || 'beginner', '');
    setReviewStep(null);setNavigationEditable(false);
    setProjects(all => [next, ...all]); setActive(next.id); setError(''); setMobileNav(false);
  }
  function openProject(id: string) { if (busy||referenceBusy) return; setReviewStep(null);setNavigationEditable(false); setActive(id); setError(''); setMobileNav(false); }
  async function request(action: 'questions' | 'generate', restart = false) {
    if (!p || busy||referenceBusy) return;
    if (!p.goal.trim()) { setError('先用一句话告诉我们，你想做什么。'); return; }
    if(pendingRequirementChanges(p).length){setError('请先在需求账本接受或拒绝待核对的要求变更，再继续优化。');document.querySelector('.insights')?.scrollIntoView({block:'start'});return;}
    if (action === 'questions' && !restart) {
      const resumed = resumeQuestionRound(p);
      if (resumed) { update({ stage: resumed.stage }); setError(''); return; }
    }
    setError('');setReviewStep(null);setNavigationEditable(false); setBusy(action);
    const token=requests.begin();
    const snapshot = { ...p };
    try {
      const r = await fetch('/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, context: makeContext(snapshot) }), signal: AbortSignal.any([token.signal,AbortSignal.timeout(65_000)]) });
      const data = await readStudioResponse(r,action) as Generation & {questions:Question[]};
      if(!requests.isCurrent(token))return;
      setConfigured(true);
      if (action === 'questions') update({ questions: data.questions as Question[], answers: {}, pendingRefinement:undefined, stage: 'questions' });
      else { const next = addVersion(snapshot, data as Generation); setProjects(all => all.map(item => item.id === snapshot.id ? next : item)); requestAnimationFrame(()=>window.scrollTo({top:0})); toast(snapshot.versions.length ? '新的版本已生成，之前的版本已保留' : '第一版提示词已准备好'); }
    } catch (e) {
      if(!requests.isCurrent(token))return;
      if(e instanceof StudioApiError&&e.code==='not_configured')setConfigured(false);
      const message=requestFailureMessage(e);
      setError(action==='generate'&&e instanceof StudioApiError?generationErrorMessage(e.code,message,snapshot):message);
    } finally { if(requests.finish(token))setBusy(null); }
  }
  async function restoreSuggestions(){
    if(!p||busy||referenceBusy)return;
    const snapshot=p,target=suggestionTarget(snapshot);if(!target)return;
    suggestionAttempts.current.add(target.attemptKey);setError('');setBusy('suggestions');
    const token=requests.begin();
    const reviewed=questionsForReview(snapshot);
    const context=makeContext({...snapshot,questions:target.questions,answers:Object.fromEntries(target.questions.map(q=>[q.id,reviewed.answers[q.id]??'']))});
    try{
      const response=await fetch('/api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'suggestions',context}),signal:AbortSignal.any([token.signal,AbortSignal.timeout(65_000)])});
      const data=await readStudioResponse(response,'suggestions');if(!requests.isCurrent(token))return;
      applySuggestions(snapshot,target,data.suggestions);
      setProjects(all=>all.map(item=>item.id===snapshot.id&&suggestionTarget(item)?.key===target.key?applySuggestions(item,target,data.suggestions):item));
      setConfigured(true);toast('已补齐建议选项，原问题和回答保持不变');
    }catch(e){if(requests.isCurrent(token))setError('建议选项补齐失败。'+requestFailureMessage(e));}
    finally{if(requests.finish(token))setBusy(null);}
  }
  useEffect(()=>{
    if(!suggestionKey||busy||referenceBusy||suggestionAttempts.current.has(suggestionKey))return;
    const timer=setTimeout(()=>{void restoreSuggestions();},0);
    return ()=>clearTimeout(timer);
    // The stable target key owns one automatic attempt; retries are explicit after failure/cancel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[suggestionKey,busy,referenceBusy]);
  async function evaluate() {
    if(!p||busy||referenceBusy||!p.draft.trim())return;
    const snapshot=p;setError('');setReviewStep(null);setNavigationEditable(false);setBusy('evaluate');
    const token=requests.begin();
    try{
      const response=await fetch('/api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'evaluate',context:makeContext(snapshot)}),signal:AbortSignal.any([token.signal,AbortSignal.timeout(65_000)])});
      const data=await readStudioResponse(response,'evaluate');
      if(!requests.isCurrent(token))return;
      setProjects(all=>all.map(item=>item.id===snapshot.id?attachAssessment(item,data):item));
      toast('评估已记录，提示词内容保持原样');
    }catch(e){if(requests.isCurrent(token))setError(requestFailureMessage(e));}
    finally{if(requests.finish(token))setBusy(null);}
  }
  function cancelRequest(){
    if(!busy||busy==='import')return;
    requests.cancel();setBusy(null);setError('');setNavigationEditable(true);
    if(p&&reviewStep!==null&&canEditStep(p,reviewStep)){const next=editStep(p,reviewStep);setProjects(all=>all.map(item=>item.id===p.id?next:item));setReviewStep(null);}
    toast('已停止等待，可以继续修改。已有回答和提示词已保留');
  }
  function openStep(target:Step){
    if(!p)return;
    if(!busy&&!referenceBusy&&navigationEditable&&canEditStep(p,target)){const next=editStep(p,target);setProjects(all=>all.map(item=>item.id===p.id?next:item));setReviewStep(null);}
    else setReviewStep(target);
  }
  function editReviewedStep(){
    if(!p||busy||referenceBusy||reviewStep===null||!canEditStep(p,reviewStep))return;
    const next=editStep(p,reviewStep);setProjects(all=>all.map(item=>item.id===p.id?next:item));setReviewStep(null);setError('');
  }
  function trackUse(project:Project){
    if(writeBlocked)return;
    const result=recordUse(libraryRef.current,{prompt:project.draft,title:project.goal,type:project.type,projectId:project.id});
    changeLibrary(result.library);
    if(result.suggest){setSuggestionId(result.suggest);setModal('favoriteSuggestion');}
  }
  function addFavorite(entry:{prompt:string;title:string;type:Kind}){
    if(writeBlocked){toast('本页已暂停保存，请先下载备份并刷新。');return;}
    try{changeLibrary(saveFavorite(libraryRef.current,entry));setModal(null);toast('已加入常用提示词');}catch(e){toast((e as Error).message);}
  }
  async function copyFavorite(entry:PromptEntry){
    try{await navigator.clipboard.writeText(entry.prompt);toast('常用提示词已复制');}catch{toast('浏览器未允许复制，请展开完整提示词手动复制。');}
  }
  function useFavorite(entry:PromptEntry){
    if(busy||referenceBusy||writeBlocked)return;
    const next=reuseFavorite(entry,p?.mode||'beginner');
    setProjects(all=>[next,...all]);setActive(next.id);setReviewStep(null);setNavigationEditable(false);setError('');setModal(null);setMobileNav(false);
    toast('已放入新项目，可以直接使用或继续优化');
  }
  async function copy() {
    if (!p?.draft) return;
    try { await navigator.clipboard.writeText(p.draft); trackUse(p);toast('提示词已复制'); }
    catch { setError('浏览器未允许复制，请在提示词编辑框内全选并复制。'); }
  }
  async function importWorkspace(backup:Workspace){
    if(busy||referenceBusy||writeBlocked)throw Error('请先结束当前处理或恢复自动保存，再导入备份。');
    setBusy('import');
    try{
      // Read usage after obtaining the lock: a pending clipboard write may finish while importing.
      const persist=()=>{const merged=mergeBackup({...workspace(),library:libraryRef.current},backup);const next=JSON.stringify({projects:merged.projects,active:merged.active,...(merged.library?.length?{library:merged.library}:{})});saveWorkspace(localStorage,KEY,savedRaw.current,next);savedRaw.current=next;savedState.current=next;return merged;};
      const merged=navigator.locks?await navigator.locks.request(KEY,persist):persist();
      setReviewStep(null);setNavigationEditable(false);setProjects(merged.projects);setActive(merged.active);changeLibrary(merged.library??[]);setError('');setModal(null);
      toast(`已导入 ${merged.added} 个项目，跳过 ${merged.skipped} 个相同项目${merged.library?.length?'，常用及使用记录已合并':''}`);
    }finally{setBusy(null);}
  }
  function backupWorkspace(){
    const url=URL.createObjectURL(new Blob([JSON.stringify(workspace(),null,2)],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='问形-工作区备份.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('已导出项目、回答、版本和常用提示词');
  }
  function download() {
    if (!p?.draft) return;
    const url = URL.createObjectURL(new Blob([p.draft], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `问形-${p.goal.slice(0, 28).replace(/[<>:"/\\|?*]/g, '') || '提示词'}.md`;
    link.click();trackUse(p);setTimeout(() => URL.revokeObjectURL(url), 1000);toast('已导出 Markdown 文件');
  }
  function removeProject() {
    if(busy||referenceBusy)return;
    const remaining = projects.filter(x => x.id !== deleteId);
    if (!remaining.length) { const next = createProject('code', 'beginner', ''); setProjects([next]); setActive(next.id); }
    else { setProjects(remaining); if (active === deleteId) setActive(remaining[0].id); }
    setReviewStep(null);setNavigationEditable(false);setModal(null); setError(''); toast('项目和历史版本已删除');
  }
  const step = !p || p.stage === 'setup' ? 0 : p.stage === 'questions' || p.stage === 'refine' ? 1 : p.status === 'completed' ? 3 : 2;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); newProject(); }} aria-label="问形首页"><span className="brand-icon"><Layers size={23}/></span><span>问形<span className="brand-en">PROMPT STUDIO</span></span></a>
      <button className="new-button" onClick={newProject} disabled={!!busy||referenceBusy}><Plus size={18}/> 新建提示词 <span>↗</span></button>
      <div className="nav-title">工作空间</div>
      <div className="nav-active"><WandSparkles size={18}/><span>提示词工作室</span><span className="small-tag">AI</span></div>
      <button className="favorites-nav" onClick={()=>{setModal('favorites');setMobileNav(false);}}><Star size={17}/><span>常用提示词</span><span className="small-tag">{library.filter(x=>x.saved).length}</span></button>
      <div className="history-title"><span><History size={14}/> 最近项目</span><span>{projects.filter(x => x.goal.trim()).length}</span></div>
      <nav className="history-list" aria-label="最近项目">
        {projects.filter(x => x.goal.trim()).map(item => <div className={`history-item ${item.id === active ? 'selected' : ''}`} key={item.id}>
          <button className="history-open" disabled={!!busy} onClick={() => openProject(item.id)}><span className={`history-dot ${item.status === 'completed' ? 'done' : ''}`}/><span>{item.goal}</span></button>
          <button className="history-delete" disabled={!!busy} aria-label={`删除项目：${item.goal}`} onClick={() => { setDeleteId(item.id); setModal('delete'); }}><Trash2 size={13}/></button>
        </div>)}
        {!projects.some(x => x.goal.trim()) && <p className="empty-history">每个好想法，都从这里开始。<br/>你的项目会自动保存在此处。</p>}
      </nav>
      <div className="sidebar-bottom"><div className="small-tip"><span className="tip-icon"><Lightbulb size={18}/></span><strong>不必一次想清楚</strong><p>先说一个想法，剩下的<br/>我们一起慢慢完善。</p><span className="tip-spark">✧</span></div><button className="guide-button" onClick={() => setModal('help')}><CircleHelp size={17}/> 使用指南 <ArrowUpRight size={15}/></button><div className="local-profile"><span className="avatar">你</span><div>我的工作空间<small><span className="green-dot"/> {storageError ? '请手动保存内容' : '本地自动保存'}</small></div><ShieldCheck size={16}/></div></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="关闭项目栏" onClick={() => setMobileNav(false)}/>}
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="打开项目栏"><Layers size={21}/></button><span>工作空间</span><span className="slash">/</span><strong>提示词工作室</strong></div><div className="top-actions">{busy&&busy!=='import'&&<button className="activity-button" onClick={()=>setReviewStep(null)} aria-label="查看正在进行的生成任务"><LoaderCircle size={15} className="spin"/><span>{busy==='questions'?'正在提问':busy==='evaluate'?'正在评估':busy==='suggestions'?'正在补齐建议':'正在生成'}</span></button>}<AccountPanel disabled={!!busy||referenceBusy||writeBlocked||!ready} workspace={workspace} onImport={importWorkspace} onCloudBusy={setReferenceBusy}/><span className="private-label"><ShieldCheck size={13}/> 私有工作空间</span><button className="model-button" onClick={() => setModal('settings')}><span className={configured ? 'green-dot' : 'amber-dot'}/> 问形 <ChevronDown size={13}/></button></div></header>
      <main><div className="page-top"><span className="eyebrow"><span/> FROM IDEA TO PROMPT</span><button className="text-button" onClick={() => setModal('help')}><CircleHelp size={15}/> 如何使用</button></div>
        <div className="hero"><div><div className="hero-kicker">让好想法，有更好的表达</div><h1>{p?.status === 'completed' ? <>想法就绪，<span>去创造吧。</span></> : p?.stage === 'setup' || !p ? <>从一个想法，<br className="mobile-break"/>到<span>一条好提示词。</span></> : p.stage === 'questions' ? <>好问题，让方向<span>更清晰。</span></> : p.stage === 'refine' ? <>再近一步，<span>更像你想的。</span></> : <>你的想法，<span>已经有了形状。</span></>}</h1><p>{p?.status === 'completed' ? '复制到你喜欢的 AI 工具，开始下一步创作。' : p?.stage === 'setup' || !p ? '不需要学习复杂的技巧。回答几个简单问题，让 AI 帮你把需求表达清楚。' : p.stage === 'questions' ? '不用想得很完美，按你的直觉回答。不确定的部分，我们会帮你标出来。' : p.stage === 'refine' ? '告诉我们哪里还不够好，再补充一些细节，让下一版更贴近你的期待。' : '先读一读，也可以直接修改。满意就完成，还差一点就继续打磨。'}</p></div><div className="hero-art" aria-hidden="true"><div className="art-orbit"/><div className="art-card back"/><div className="art-card front"><Sparkles size={26}/><span/><span/><span/></div><i className="spark-one">✦</i><i className="spark-two">✧</i></div></div>
        <nav className="steps" aria-label="创建进度">{stepLabels.map((label,i)=><div className={`step ${(reviewStep??step)===i?'current':step>i?'passed':''}`} key={label}><button className="step-button" aria-current={(reviewStep??step)===i?'step':undefined} onClick={()=>openStep(i as Step)} disabled={!ready||busy==='import'}><span className="step-number">{step>i?<Check size={13}/>: `0${i+1}`}</span><span>{label}</span></button>{i<3&&<span className="step-line"/>}</div>)}</nav>
        {storageError && <div className="alert storage-alert" role="status"><span>{storageError}</span><button className="text-button" onClick={backupWorkspace}>下载本页备份</button></div>}
        {error && <div className="alert" role="alert"><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError('')}><X size={16}/></button></div>}
        {pendingChanges>0&&<div className="pending-banner"><div><strong>有 {pendingChanges} 项要求变更需要你核对</strong><p>在需求账本接受或拒绝建议后，可以继续优化或完成提示词。</p></div><button className="text-button" onClick={()=>document.querySelector('.insights')?.scrollIntoView({block:'start'})}>前往需求账本 →</button></div>}
        {p && ['setup', 'refine'].includes(p.stage) && p.questions.length > 0 && <div className="pending-banner"><div><strong>你还有一轮未完成的问答</strong><p>继续回答会保留原来的问题和所有输入。如果方向已改变，也可以重新提问。</p></div><button className="text-button" disabled={!!busy} onClick={() => setModal('reask')}><RotateCcw size={14}/> 重新提问</button></div>}
        {missingSuggestions&&<div className="suggestion-notice" role="status"><div><strong>{busy==='suggestions'?'正在补齐具体建议选项…':'这些问题的建议选项还不完整'}</strong><p>按原问题和已有需求补充建议，不换题、不清空回答。补充的方向只有在你选择后才作为回答。</p></div><button className="secondary" disabled={!!busy} onClick={()=>void restoreSuggestions()}>{busy==='suggestions'?<LoaderCircle size={14} className="spin"/>:null} {busy==='suggestions'?'补齐中':'补全建议选项'}</button></div>}
        {p&&reviewStep!==null&&<div className="review-toolbar"><div><strong>正在查看：{stepLabels[reviewStep]}</strong><p>{busy?busy==='suggestions'?'正在补齐建议，原问题和回答保持不变；本页仅供查看。':'生成仍在进行，本页仅供查看；停止生成后可以修改。':'只读查看不会改变当前进度。'}</p></div><div className="row-actions">{!busy&&canEditStep(p,reviewStep)&&<button className="secondary" onClick={editReviewedStep}>修改此步</button>}<button className="text-button" onClick={()=>setReviewStep(null)}>{busy?'回到生成进度':'继续当前步骤'}</button></div></div>}
        {ready&&p&&<ReferenceImages key={p.id} images={p.references} readOnly={!!busy||reviewStep!==null||p.status==='completed'} onChange={references=>update({references})} onBusyChange={setReferenceBusy}/>}
        {!ready || !p ? <div className="loading-screen"><LoaderCircle className="spin"/> 正在打开工作室…</div> : reviewStep!==null?<StepReview project={p} step={reviewStep}/>: <fieldset className="workspace-fieldset" disabled={!!busy||referenceBusy}>
          {p.stage === 'setup' && <>
            <section className="type-section"><div className="section-heading"><h2><span>01</span> 你想创造什么？</h2><p>选择一个方向，我们会问对的问题。</p></div><div className="type-grid">{TYPES.map(t => <button key={t.id} className={`type-card ${p.type === t.id ? 'active' : ''}`} onClick={() => update({ type: t.id as Kind })} aria-pressed={p.type === t.id}><div className="type-card-top"><span className="type-icon"><t.icon size={23} strokeWidth={1.7}/></span>{p.type === t.id ? <span className="selection-check"><Check size={11}/></span> : <span className="selection-circle"/>}</div><strong>{t.label}</strong><p>{t.description}</p><span className="type-en">{t.en}</span></button>)}</div></section>
            <section className="brief-card"><div className="brief-main"><div className="section-heading"><h2><span>02</span> 用你习惯的方式开始</h2></div><div className="mode-picker" role="group" aria-label="选择使用模式"><button className={p.mode === 'beginner' ? 'active' : ''} onClick={() => update({ mode: 'beginner' })}><Sparkles size={17}/><span>轻松入门<small>简单提问，一步步引导</small></span>{p.mode === 'beginner' && <Check size={15}/>}</button><button className={p.mode === 'advanced' ? 'active' : ''} onClick={() => update({ mode: 'advanced' })}><SlidersHorizontal size={17}/><span>进阶创作<small>深入细节，精准掌控</small></span>{p.mode === 'advanced' && <Check size={15}/>}</button></div><label className="input-label" htmlFor="goal">先说说，你大概想做什么？ <span>一句话就好</span></label><textarea id="goal" className="goal-input" maxLength={4000} value={p.goal} onChange={e => update({ goal: e.target.value })} placeholder={selectedType.example}/><div className="input-footer"><button className="example-button" onClick={() => update({ goal: selectedType.example })}><WandSparkles size={13}/> 试试这个灵感</button><span>{p.goal.length} / 4000</span></div></div><div className="brief-aside"><span className="aside-badge"><MessageCircle size={15}/> 像聊天一样简单</span><h3>你负责想象，<br/>我们负责问对问题。</h3><p>从模糊到清晰，从初稿到满意。<br/>每一次回答，都让提示词<br/>更懂你的想法。</p><div className="mini-conversation"><span>我有一个想法…</span><span><Sparkles size={12}/> 我们一起把它变具体。</span></div><div className="aside-bottom"><span/> 专属于你的创作节奏</div></div></section>
            <div className="start-footer"><div><ShieldCheck size={15}/><span>项目保存在当前浏览器，需求将发送给 问形 处理</span></div><button className="primary" onClick={() => request('questions')} disabled={!p.goal.trim() || !!busy}><Sparkles size={17}/> {p.questions.length ? '继续原有问答' : '开始梳理想法'} <ArrowRight size={17}/></button></div>
          </>}
          {p.stage === 'questions' && <div className="work-grid"><section className="panel questions-panel"><div className="panel-heading"><div><span className="eyebrow">LET’S MAKE IT CLEAR</span><h2>{p.versions.length ? `第 ${p.versions.length + 1} 轮 · 深入一点` : '先从这几个问题开始'}</h2></div><span className="pill">{p.mode === 'beginner' ? '轻松入门' : '进阶创作'}</span></div><div className="question-tools"><button className="text-button" onClick={()=>setModal('reask')}><RotateCcw size={14}/> 重新提问</button></div><AnswerGuidance project={p} onDelegate={()=>{update({answers:delegateUnresolved(p)});toast('已委托问形补定未明确的部分，具体选择会标为待确认');}}/>{p.questions.map((q, index) => <div className="question-block" key={q.id}><label htmlFor={q.id}><span className="question-number">{index + 1}</span>{q.text}</label><p>{q.hint}</p><div className="answer-options">{q.options.map(option => <button key={option} className={answerFor(p, q.id) === option ? 'chosen' : ''} onClick={() => update({ answers: { ...p.answers, [q.id]: option } })}>{option}</button>)}</div><button className="text-button delegate-question" aria-pressed={answerFor(p,q.id).includes(DELEGATE_ANSWER)} onClick={()=>{try{update({answers:{...p.answers,[q.id]:delegateAnswer(answerFor(p,q.id))}});}catch(err){setError(err instanceof Error?err.message:'无法委托，原回答已保留。');}}}>问形帮我决定</button><textarea id={q.id} maxLength={4000} value={answerFor(p, q.id)} onChange={e => update({ answers: { ...p.answers, [q.id]: e.target.value } })} placeholder="选一个答案，或补充已知的主体、用途和关键细节。不确定的部分可以留待确认。" rows={2}/></div>)}<div className="question-block omissions"><label htmlFor="omissions"><Plus size={17}/> 还有什么重要的事我们没问到？</label><p>任何你在意的细节、希望避免的内容，都可以写在这里。</p><textarea id="omissions" maxLength={4000} value={p.omissions} onChange={e => update({ omissions: e.target.value })} placeholder="选填，比如：我特别在意… / 一定不要…" rows={3}/></div><div className="panel-footer"><button className="text-button" onClick={() => update({ stage: p.versions.length ? 'refine' : 'setup' })}><ArrowLeft size={15}/> 返回修改</button><button className="primary" onClick={() => request('generate')}><Sparkles size={17}/>{p.versions.length ? '生成优化版' : '生成第一版'}<ArrowRight size={17}/></button></div></section><ContextCard p={p} changeMode={() => update({ mode: p.mode === 'beginner' ? 'advanced' : 'beginner' })}/></div>}
          {p.stage === 'refine' && <div className="work-grid"><section className="panel refine-panel"><span className="eyebrow">A LITTLE CLOSER</span><h2>这一版，哪里还差一点？</h2><p className="muted">我们会根据你的反馈，继续问几个更具体的问题。</p><label className="input-label" htmlFor="feedback">你希望怎么调整？</label><textarea id="feedback" maxLength={4000} rows={6} value={p.feedback} onChange={e => update({ feedback: e.target.value })} placeholder="比如：方向对了，但风格还不够简洁；希望补上具体的输出格式…"/><label className="input-label" htmlFor="extra">还有什么重要的事我们没问到？ <span>选填</span></label><textarea id="extra" maxLength={4000} rows={4} value={p.omissions} onChange={e => update({ omissions: e.target.value })} placeholder="把遗漏的想法、限制或新需求告诉我们。"/><div className="panel-footer"><button className="text-button" onClick={() => update({ stage: 'preview' })}><ArrowLeft size={15}/> 返回预览</button><button className="primary" onClick={() => request('questions')}>{p.questions.length ? '继续原有问答' : '继续细化需求'} <ArrowRight size={17}/></button></div></section><ContextCard p={p} changeMode={() => update({ mode: p.mode === 'beginner' ? 'advanced' : 'beginner' })}/></div>}
          {p.stage === 'preview' && <div className="preview-layout"><section className="panel editor-panel"><div className="editor-heading"><div><span className="document-icon"><PenLine size={19}/></span><div><h2>{p.status === 'completed' ? '你的最终提示词' : '提示词预览'}</h2><small>{selectedType.label} <span>·</span> 版本 {p.versions.length} <span>·</span> {p.status === 'completed' ? '已完成' : '可以直接编辑'}</small></div></div><div className="editor-tools"><button className="icon-button" disabled={!p.draft.trim()||writeBlocked} title={savedPrompt?'已加入常用提示词':'加入常用提示词'} aria-label={savedPrompt?'已加入常用提示词':'加入常用提示词'} aria-pressed={!!savedPrompt} onClick={()=>savedPrompt?setModal('favorites'):addFavorite({prompt:p.draft,title:p.goal,type:p.type})}><Star size={17} fill={savedPrompt?'currentColor':'none'}/></button><button className="icon-button" onClick={() => setModal('versions')} title="版本历史" aria-label="版本历史"><History size={17}/></button><button className="icon-button" onClick={copy} title="复制提示词" aria-label="复制提示词"><Copy size={17}/></button><button className="icon-button" onClick={download} title="下载 Markdown" aria-label="下载 Markdown"><Download size={17}/></button></div></div>{latest?.conflicts.length ? <div className="conflict-note"><strong>以下要求还需要你确认</strong>{latest.conflicts.map((c, i) => <p key={i}>{c}</p>)}</div> : null}<textarea className="prompt-editor" aria-label="提示词编辑器" maxLength={24000} value={p.draft} readOnly={p.status === 'completed'} onChange={e => update({ draft: e.target.value })} spellCheck={false}/><div className="editor-status"><span><span className="green-dot"/> {p.status === 'completed' ? '已完成，随时可以再次优化' : '修改自动保存在当前浏览器'}</span><span>{p.draft.length} 字符</span></div></section><aside className="preview-side"><div className="panel next-panel"><span className={`next-icon ${p.status === 'completed' ? 'complete' : ''}`}>{p.status === 'completed' ? <CheckCheck size={25}/> : <WandSparkles size={25}/>}</span><h3>{p.status === 'completed' ? '准备好了，开始创作' : '好提示词，值得再打磨'}</h3><p>{p.status === 'completed' ? '复制这份提示词，粘贴到你喜欢的 AI 工具里使用。' : '初稿只是起点。你可以删掉重来，也可以再聊聊，让它更贴近你的期待。'}</p>{p.status === 'completed' ? <><button className="primary full" onClick={copy}><Copy size={16}/> 复制提示词</button><button className="secondary full" onClick={download}><Download size={16}/> 下载 Markdown</button><button className="text-button full" onClick={() => update({ status: 'draft', stage: 'refine' })}><RotateCcw size={15}/> 重新打开并优化</button></> : <><button className="primary full" disabled={!p.draft.trim()||pendingChanges>0} onClick={() => { update({ status: 'completed' });setNavigationEditable(false); toast('提示词已完成'); }}><Check size={17}/> 完成提示词</button><button className="secondary full" onClick={() => update({ stage: 'refine' })}><Sparkles size={16}/> 继续优化 <ArrowRight size={15}/></button><button className="danger-text full" onClick={() => { setDeleteId(p.id); setModal('delete'); }}><Trash2 size={14}/> 删除这个项目</button></>}</div>{latest?.assumptions.length ? <div className="assumption-card"><Lightbulb size={18}/><h4>这些地方，我们先做了假设</h4>{latest.assumptions.map((a, i) => <p key={i}>{a}</p>)}</div> : null}<div className="version-note"><Layers size={16}/><p>每一次优化都保留历史版本。<button onClick={() => setModal('versions')}>查看 {p.versions.length} 个版本 <ArrowUpRight size={12}/></button></p></div></aside></div>}
          {p.versions.length>0&&<ProjectInsights key={p.id} project={p} onChange={next=>setProjects(all=>all.map(item=>item.id===p.id?next:item))} onEvaluate={evaluate} onRefine={text=>{update({status:'draft',stage:'refine',feedback:[p.feedback,text].filter(Boolean).join('\n').slice(0,4000)});toast('建议已带入反馈，请确认后继续细化');}}/>}
        </fieldset>}
        {busy && <div className="busy-indicator" role="status"><LoaderCircle size={18} className="spin"/><div><strong>{busy === 'import' ? '正在恢复工作区…' : busy === 'questions' ? '正在想下一组好问题…' : busy==='evaluate'?'正在检查当前稿与需求…':busy==='suggestions'?'正在为原问题补齐建议选项…':'正在把你的想法写成提示词…'}</strong><span>问形 正在处理，请稍候。输入已保留。</span></div>{busy!=='import'&&<button className="secondary" onClick={cancelRequest}><ArrowLeft size={15}/> 停止等待，返回修改</button>}</div>}
        <footer className="page-footer"><span>每一个好结果，都始于一个好问题。</span><span><Sparkles size={12}/> 由 问形 驱动</span></footer>
      </main>
    </div>
    {notice && <div className="toast" role="status"><Check size={16}/>{notice}</div>}
    {modal && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={modalRef}><button className="modal-close icon-button" aria-label="关闭对话框" onClick={() => setModal(null)}><X size={19}/></button>
      {modal==='favorites'&&<FavoriteLibrary library={library} disabled={!!busy||referenceBusy||writeBlocked} onCopy={entry=>void copyFavorite(entry)} onReuse={useFavorite} onRemove={entry=>{changeLibrary(removeFavorite(libraryRef.current,entry.id));toast('已移出常用，使用记录保留');}} onClear={()=>{changeLibrary(libraryRef.current.filter(x=>x.saved));toast('已清除未收藏记录，已收藏提示词保留');}}/>}
      {modal==='favoriteSuggestion'&&suggestedPrompt&&<><span className="modal-symbol"><Star size={24}/></span><h2 id="modal-title">要加入常用提示词吗？</h2><p>这份提示词已在4个不同项目中被使用。加入常用，下次更容易找到。</p><div className="favorite-suggestion"><strong>{suggestedPrompt.title}</strong><pre>{suggestedPrompt.prompt}</pre></div><div className="modal-actions"><button className="secondary" disabled={writeBlocked} onClick={()=>{changeLibrary(dismissFavorite(libraryRef.current,suggestionId));setModal(null);}}>不再提醒此提示词</button><button className="primary" disabled={writeBlocked} onClick={()=>addFavorite(suggestedPrompt)}><Star size={15}/>加入常用</button></div></>}
      {modal === 'settings' && <><span className="modal-symbol"><SlidersHorizontal size={24}/></span><h2 id="modal-title">问形服务</h2><p className="connection-state"><span className={configured ? 'green-dot' : 'amber-dot'}/>{configured === true ? '问形服务已配置' : configured === false ? '问形服务尚未配置' : '暂时无法确认问形服务状态'}</p><p>问形会通过简单问答，帮助你把想法整理成清晰、具体的提示词。</p><p className="muted">项目保存在当前浏览器。每轮提问与生成会通过问形调用模型服务处理需求；请及时下载重要结果。</p><div className="row-actions"><button className="secondary" onClick={backupWorkspace}>下载工作区备份</button></div><BackupImport disabled={!!busy||writeBlocked} onImport={importWorkspace}/><button className="primary full" onClick={() => setModal(null)}>继续创作 <ArrowRight size={15}/></button></>}
      {modal === 'help' && <><span className="modal-symbol"><Sparkles size={24}/></span><h2 id="modal-title">从想法到好提示词</h2>{[['选一个方向','代码、图片、视频、文案，或自定义任务。新手选轻松入门，熟悉 AI 可以选择进阶创作。'],['回答几个问题','可以选择“不确定”，但建议至少说明用途、主体或关键内容。多项不确定时可能需要补充后才能得到具体结果。'],['预览，再打磨','直接修改初稿，或点击继续优化。每次保留旧版，直到你觉得满意。'],['带走你的提示词','点击完成，复制或下载到喜欢的 AI 工具里。随时可以重新打开优化。']].map(([title,description],i) => <div className="help-step" key={title}><b>0{i+1}</b><div><strong>{title}</strong><p>{description}</p></div></div>)}<p className="muted">无需注册应用账号。项目仅保存在本浏览器，清理浏览器数据会删除记录。重要结果请下载保存。</p><button className="primary full" onClick={() => setModal(null)}>开始探索 <ArrowRight size={16}/></button></>}
      {modal === 'delete' && <><span className="modal-symbol danger"><Trash2 size={24}/></span><h2 id="modal-title">删除这个项目？</h2><p>项目「{projects.find(x => x.id === deleteId)?.goal || '未命名想法'}」及所有历史版本都将被删除，无法恢复。</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>保留项目</button><button className="danger-button" onClick={removeProject}>确认删除</button></div></>}
      {modal === 'reask' && <><span className="modal-symbol"><RotateCcw size={24}/></span><h2 id="modal-title">重新梳理这一轮问题？</h2><p>新问题生成成功后，会替换这一轮的问题和未提交的答案。你的提示词、版本历史和补充说明会保留；生成失败也不会清空已有输入。</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>保留原有问答</button><button className="primary" onClick={() => { setModal(null); request('questions', true); }}>确认重新提问</button></div></>}
      {modal === 'versions' && <><span className="modal-symbol"><History size={24}/></span><h2 id="modal-title">每一次，都更进一步</h2><p>恢复会新增一个版本，不会覆盖已有历史。</p><div className="version-list">{p?.versions.map((v, i) => <div key={v.id}><div><strong>版本 {i + 1} {i === p.versions.length - 1 && <span className="pill">当前</span>}</strong><small>{new Date(v.createdAt).toLocaleString('zh-CN', { hour12: false })}</small><p>{v.label || v.summary}</p><details><summary>查看此版本提示词</summary><pre>{i === p.versions.length - 1 ? p.draft : v.prompt}</pre></details></div>{i < p.versions.length - 1 && <button className="secondary" onClick={() => { const next = restoreVersion(p, v.id); setProjects(all => all.map(x => x.id === p.id ? next : x)); setModal(null); setError(''); toast('已恢复为新的当前版本'); }}><RotateCcw size={14}/> 恢复</button>}</div>)}</div></>}
    </div></div>}
  </div>;
}

function ContextCard({ p, changeMode }: { p: Project; changeMode: () => void }) {
  const kind = TYPES.find(t => t.id === p.type)!;
  const latest = p.versions.at(-1);
  const confirmed=p.requirements.filter(r=>r.status==='confirmed').map(r=>r.text);
  const requirements=confirmed.length?confirmed:latest?.constraints??[];
  return <aside className="context-card"><span className="eyebrow">YOUR CREATIVE BRIEF</span><span className="context-kind"><kind.icon size={20}/>{kind.label}</span><h3>我们正在一起做的事</h3><p className="context-goal">{p.goal}</p>{p.draft && <><div className="context-divider"/><strong className="context-subtitle">当前提示词 · 版本 {p.versions.length}</strong><pre className="context-preview">{p.draft}</pre></>}{requirements.length ? <><div className="context-divider"/><strong className="context-subtitle">{confirmed.length?'你已确认的要求':'问形整理的要求（待确认）'}</strong><ul>{requirements.map((c, i) => <li key={i}><Check size={13}/>{c}</li>)}</ul></> : <div className="context-tip"><Lightbulb size={17}/><p>没有标准答案。越真实地表达，你的提示词就越有用。</p></div>}<div className="mode-inline"><span>提问方式</span><button onClick={changeMode} title="切换提问模式，下轮问题生效">{p.mode === 'beginner' ? '轻松入门' : '进阶创作'} ⇄</button></div></aside>;
}
