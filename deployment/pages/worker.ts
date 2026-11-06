import {handleStudio} from '../../lib/deepseek.ts';
import {publicAuthConfig} from '../../lib/auth-config.ts';
import {checkStudioAccess} from '../../lib/studio-access.ts';
import {withQuotaHeaders} from '../../lib/quota.ts';

type PagesEnv={ASSETS:{fetch:(request:Request)=>Promise<Response>};DEEPSEEK_API_KEY?:string;DEEPSEEK_MODEL?:string;WENXU_ACCESS_CODE?:string;SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const page=(title:string,body:string,status:number)=>new Response(`<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 问形</title><style>body{margin:0;background:#f8f7fc;color:#4e425c;font:16px/1.9 system-ui,"Microsoft YaHei",sans-serif}main{max-width:620px;margin:12vh auto;padding:32px;border:1px solid #e7dff1;border-radius:16px;background:white}h1{font-size:26px;color:#7861d3}code{background:#f2edf9;padding:3px 7px;border-radius:5px}p{overflow-wrap:anywhere}@media(max-width:680px){main{margin:8vh 18px;padding:24px}}</style><main><h1>${title}</h1>${body}</main></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
const jsonError=(status:number,code:string,message:string,extra:Record<string,string>={})=>Response.json({code,message},{status,headers:{...headers,...extra}});
export function createPagesWorker(fetcher:typeof fetch=fetch){
  return {async fetch(request:Request,env:PagesEnv):Promise<Response>{
    const url=new URL(request.url),api=url.pathname.startsWith('/api/');
    // Serve the ownership file directly because Pages redirects .html asset URLs.
    if(url.pathname==='/google6fe8b4bccb41e560.html'&&(request.method==='GET'||request.method==='HEAD')){
      const assetUrl=new URL('/google6fe8b4bccb41e560',url);
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    if(url.pathname==='/api/auth-config'){
      if(request.method!=='GET')return jsonError(405,'method','此接口仅支持GET。',{Allow:'GET'});
      return Response.json(publicAuthConfig(env),{headers});
    }
    if(!env.DEEPSEEK_API_KEY?.trim()){
      if(api)return jsonError(503,'not_configured','问形尚未配置。请在Cloudflare设置DEEPSEEK_API_KEY，然后重新部署。');
      return page('部署已完成，请配置服务',`<p>请在当前 Pages 项目的<strong>设置 → 变量和机密</strong>中，为生产环境添加 <code>DEEPSEEK_API_KEY</code> 模型服务密钥。</p><p>保存后重新部署同一个上传包。本站不再需要访问用户名或密码。</p>`,503);
    }
    if(url.pathname==='/api/status'){
      if(request.method!=='GET')return jsonError(405,'method','此接口仅支持GET。',{Allow:'GET'});
      return Response.json({configured:true},{headers});
    }
    if(url.pathname==='/api/studio'){
      if(request.method!=='POST')return jsonError(405,'method','此接口仅支持POST。',{Allow:'POST'});
      const quotaHeaders=new Headers();
      const denied=await checkStudioAccess(request,env,fetcher,quotaHeaders);
      const response=denied??await handleStudio(request,{DEEPSEEK_API_KEY:env.DEEPSEEK_API_KEY,DEEPSEEK_MODEL:env.DEEPSEEK_MODEL},fetcher);
      return withQuotaHeaders(response,quotaHeaders);
    }
    if(api||url.pathname==='/_worker.js'||url.pathname==='/_routes.json')return jsonError(404,'not_found','未找到此地址。');
    if(request.method!=='GET'&&request.method!=='HEAD')return jsonError(405,'method','此页面仅支持GET或HEAD。',{Allow:'GET, HEAD'});
    const response=await env.ASSETS.fetch(request);
    const outgoing=new Headers(response.headers);for(const [key,value]of Object.entries(headers))outgoing.set(key,value);
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:outgoing});
  }};
}
export default createPagesWorker();
