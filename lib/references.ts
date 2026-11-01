import {z} from 'zod';
export const MAX_REFERENCES=3;
export const MAX_REFERENCE_BYTES=180*1024;
export function validInlineImage(value:string):boolean{
  if(value.length>Math.ceil(MAX_REFERENCE_BYTES/3)*4+40)return false;
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match||match[2].length%4)return false;
  try{
    const bytes=atob(match[2]);if(bytes.length>MAX_REFERENCE_BYTES)return false;
    if(match[1]==='png')return bytes.startsWith('\x89PNG\r\n\x1a\n');
    if(match[1]==='jpeg')return bytes.startsWith('\xff\xd8\xff');
    return bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
  }catch{return false;}
}
export const referenceSchema=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(180),note:z.string().max(1000),dataUrl:z.string().refine(validInlineImage,'图片格式无效或压缩后过大')});
export const referencesSchema=z.array(referenceSchema).max(MAX_REFERENCES).refine(items=>new Set(items.map(r=>r.id)).size===items.length);
export type ReferenceImage=z.infer<typeof referenceSchema>;
export type UserContent=string|({type:'text';text:string}|{type:'image_url';image_url:{url:string;detail:'high'}})[];
export function referenceUserContent(context:{references?:ReferenceImage[];[key:string]:unknown}):UserContent{
  const {references=[],...rest}=context;if(!references.length)return JSON.stringify(context);
  return [{type:'text',text:JSON.stringify({...rest,references:references.map(r=>({id:r.id,name:r.name,note:r.note}))})},...references.flatMap((r,i):Exclude<UserContent,string>=>[{type:'text',text:`参考图${i+1}：${r.name}。参考说明：${r.note||'未指定，请提问确认主要参考哪些方面。'}`},{type:'image_url',image_url:{url:r.dataUrl,detail:'high'}}])];
}
export function referencesKey(items:ReferenceImage[]=[]){
  return items.map(r=>{let hash=2166136261;for(let i=0;i<r.dataUrl.length;i++)hash=Math.imul(hash^r.dataUrl.charCodeAt(i),16777619);return {id:r.id,name:r.name,note:r.note,imageHash:(hash>>>0).toString(16)};});
}
