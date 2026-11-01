'use client';
import {useEffect,useRef,useState} from 'react';
import {ImagePlus,LoaderCircle,Trash2,Maximize2} from 'lucide-react';
import {MAX_REFERENCES,type ReferenceImage} from '@/lib/references';
import {prepareReference} from '@/lib/reference-upload';

export function ReferenceImages({images=[],readOnly=false,onChange,onBusyChange}:{images?:ReferenceImage[];readOnly?:boolean;onChange:(images:ReferenceImage[])=>void;onBusyChange:(busy:boolean)=>void}){
  const [uploading,setUploading]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<ReferenceImage|null>(null);
  const input=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;onBusyChange(false);};},[onBusyChange]);
  async function upload(files:File[]){
    if(readOnly||uploading||!files.length)return;
    if(images.length+files.length>MAX_REFERENCES){setError('最多添加3张参考图，请先删除部分图片。');return;}
    setError('');setUploading(true);onBusyChange(true);
    try{const prepared:ReferenceImage[]=[];for(const file of files)prepared.push(await prepareReference(file));if(alive.current)onChange([...images,...prepared]);}
    catch(e){if(alive.current)setError(e instanceof Error?e.message:'图片上传失败，已有内容已保留。');}
    finally{if(alive.current){setUploading(false);onBusyChange(false);}}
  }
  return <section className="panel reference-panel" aria-label="参考图片"><div className="reference-heading"><div><h2><ImagePlus size={19}/> 参考图片 <span className="pill">选填 · {images.length}/3</span></h2><p>上传画风、角色、构图或界面参考，写明想借鉴的部分。</p></div>{!readOnly&&<button type="button" className="secondary" disabled={uploading||images.length>=MAX_REFERENCES} onClick={()=>input.current?.click()}>{uploading?<LoaderCircle size={15} className="spin"/>:<ImagePlus size={15}/>} {uploading?'正在处理图片…':'添加参考图片'}</button>}</div>
    <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="上传参考图片" className="reference-file" disabled={readOnly||uploading} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void upload(files);}}/>
    {error&&<p className="reference-error" role="alert">{error}</p>}
    {!images.length?<p className="reference-empty">暂无参考图。支持 PNG、JPG、WebP，单张原图不超过10MB；最多3张。</p>:<div className="reference-grid">{images.map((image,i)=><article className="reference-item" key={image.id}><button type="button" className="reference-thumbnail" aria-label={`预览参考图${i+1}`} onClick={()=>{setPreview(image);dialog.current?.showModal();}}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Local compressed data URLs need no external image optimization. */}
      <img src={image.dataUrl} alt={`参考图${i+1}：${image.name}`}/><span><Maximize2 size={13}/> 点击预览</span></button><div className="reference-item-heading"><strong title={image.name}>参考图{i+1} · {image.name}</strong>{!readOnly&&<button type="button" className="icon-button" aria-label={`删除参考图${i+1}`} disabled={uploading} onClick={()=>onChange(images.filter(r=>r.id!==image.id))}><Trash2 size={15}/></button>}</div><label htmlFor={`reference-note-${image.id}`}>想参考什么？</label><textarea id={`reference-note-${image.id}`} aria-label={`参考图${i+1}说明`} rows={2} maxLength={1000} readOnly={readOnly} disabled={uploading} value={image.note} onChange={e=>onChange(images.map(r=>r.id===image.id?{...r,note:e.target.value}:r))} placeholder="例如：只参考配色和构图，人物按我的描述。"/></article>)}</div>}
    <p className="reference-privacy">图片压缩后保存在当前浏览器并包含在备份中。提问、生成、评估或补齐建议时，会连同说明发送给模型分析；图片识别可能存在偏差。</p>
    <dialog className="reference-dialog" ref={dialog} aria-label="参考图预览" onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}><button type="button" className="secondary" onClick={()=>dialog.current?.close()}>关闭预览</button>{preview&&<>
      {/* eslint-disable-next-line @next/next/no-img-element -- Preview the already-compressed local reference. */}
      <img src={preview.dataUrl} alt={preview.name}/><p>{preview.name}</p></>}</dialog>
  </section>;
}
