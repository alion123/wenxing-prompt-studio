import {useState} from 'react';
import {Star,Copy,Plus,Trash2} from 'lucide-react';
import type {PromptEntry} from '@/lib/favorites';
export function FavoriteLibrary({library,disabled,onAdd,onCopy,onReuse,onRemove,onClear}:{library:PromptEntry[];disabled:boolean;onAdd:(prompt:string)=>boolean;onCopy:(entry:PromptEntry)=>void;onReuse:(entry:PromptEntry)=>void;onRemove:(entry:PromptEntry)=>void;onClear:()=>void}){
 const [prompt,setPrompt]=useState('');
 const favorites=library.filter(x=>x.saved),tracked=library.filter(x=>!x.saved).length;
 return <><span className="modal-symbol"><Star size={24}/></span><h2 id="modal-title">常用提示词</h2><p>把好用的提示词留下，下次直接复制，或放进新项目继续修改。</p>
  <form className="favorite-card" onSubmit={event=>{
    event.preventDefault();
    if(!disabled&&prompt.trim()&&onAdd(prompt))setPrompt('');
  }}>
    <label htmlFor="favorite-paste">粘贴提示词</label>
    <textarea id="favorite-paste" rows={4} maxLength={24000} value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="把已有的提示词粘贴到这里" disabled={disabled} />
    <div className="row-actions"><button type="submit" className="primary" disabled={disabled||!prompt.trim()}>保存到常用提示词</button></div>
  </form>
  <div className="favorites-list">{favorites.length?favorites.map(entry=><article className="favorite-card" key={entry.id}><h3>{entry.title}</h3><small>{entry.usedIn.length>=4?'已在至少4个项目中使用':`已在${entry.usedIn.length}个项目中使用`}</small><details><summary>查看完整提示词</summary><pre>{entry.prompt}</pre></details><div className="row-actions"><button className="secondary" disabled={disabled} onClick={()=>onCopy(entry)}><Copy size={14}/>复制</button><button className="primary" disabled={disabled} onClick={()=>onReuse(entry)}><Plus size={14}/>在新项目中使用</button><button className="danger-text" disabled={disabled} onClick={()=>onRemove(entry)}><Trash2 size={14}/>移除常用</button></div></article>):<div className="favorites-empty"><Star size={27}/><strong>还没有常用提示词</strong><p>在预览页点击星标即可加入。同一提示词用于第4个不同项目时，也会询问你是否收藏。</p></div>}</div>
  <div className="favorites-note"><p>仅保存在当前浏览器，包含在工作区备份中。直接复制常用提示词不算新项目使用；在新项目里复制或下载后才会计数。</p><p>最多保留100条常用及近期使用记录。清除未收藏记录会重置这些提示词的计数与“不再提醒”选择，已收藏内容保留。</p><button className="text-button" disabled={disabled||!tracked} onClick={onClear}>清除未收藏的使用记录（{tracked}条）</button></div>
 </>;
}
