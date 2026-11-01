import {MAX_REFERENCE_BYTES,referenceSchema,validInlineImage,type ReferenceImage} from './references.ts';
const dataURL=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('图片读取失败，请重试。'));reader.readAsDataURL(blob);});
const encode=(canvas:HTMLCanvasElement,quality:number)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('无法处理这张图片，请换一张。')),'image/webp',quality));
export async function prepareReference(file:File):Promise<ReferenceImage>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 PNG、JPG 或 WebP 图片。');
  if(file.size>10*1024*1024||!file.size)throw Error('单张原图需小于10MB，且不能为空。');
  const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(!validInlineImage(`data:${file.type};base64,${btoa(String.fromCharCode(...header))}`))throw Error('文件内容不是有效的 PNG、JPG 或 WebP 图片。');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;try{await image.decode();}catch{throw Error('无法读取图片，请确认文件未损坏。');}
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>36_000_000)throw Error('图片像素过大，请先缩小到3600万像素以内。');
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw Error('当前浏览器无法处理图片。');
    for(const bound of [1400,1100,800,600]){
      const scale=Math.min(1,bound/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      context.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [.84,.65,.45]){
        const blob=await encode(canvas,quality);if(blob.size<=MAX_REFERENCE_BYTES)return referenceSchema.parse({id:crypto.randomUUID(),name:file.name.slice(0,180)||'参考图片',note:'',dataUrl:await dataURL(blob)});
      }
    }
    throw Error('图片压缩后仍然过大，请先缩小图片再上传。');
  }finally{URL.revokeObjectURL(url);}
}
