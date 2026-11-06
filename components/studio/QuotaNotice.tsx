'use client';
import {useEffect,useRef} from 'react';
import {Lightbulb,CheckCheck} from 'lucide-react';
import type {QuotaNoticeKind,QuotaSnapshot} from '@/lib/quota';

export function QuotaNotice({kind,quota,onClose}:{kind:QuotaNoticeKind;quota:QuotaSnapshot;onClose:()=>void}){
 const button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  button.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
   if(event.key==='Tab'){event.preventDefault();event.stopPropagation();button.current?.focus();}
  };
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};
 },[onClose]);
 const exhausted=kind==='exhausted';
 const reset=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(quota.resetAt));
 return <div className="modal-backdrop quota-backdrop"><section className="modal quota-modal" role="alertdialog" aria-modal="true" aria-labelledby="quota-notice-title" aria-describedby="quota-notice-body">
  <span className="modal-symbol">{exhausted?<CheckCheck size={26}/>:<Lightbulb size={26}/>}</span>
  <h2 id="quota-notice-title">{exhausted?'今天的使用次数已用尽':'今天的使用次数不多了'}</h2>
  <div id="quota-notice-body">
   <p>{exhausted?'今天的7次使用次数已用尽，感谢你使用问形。':'今天还剩'+quota.remaining+'次使用机会，可以先整理好需求，再继续生成。'}</p>
   <p>提问、生成、优化、评估和补齐建议共用每天7次额度。北京时间每日00:00恢复。</p>
   <p>本次恢复时间：{reset}（北京时间）。</p>
   <p>你的项目、回答和提示词都已保留，仍可查看、编辑、复制和下载已有内容。</p>
  </div>
  <button ref={button} type="button" className="primary full" onClick={onClose}>我知道了</button>
 </section></div>;
}
