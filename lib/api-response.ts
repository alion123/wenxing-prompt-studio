import {z} from 'zod';
import type {Generation,Question,QualityReport} from './studio.ts';
import {questionSchema,qualityReportSchema} from './persistence.ts';
import {suggestionsSchema,type Suggestion} from './suggestions.ts';

export class StudioApiError extends Error{status:number;code:string;constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;}}
type Results={questions:{questions:Question[]};generate:Generation;evaluate:QualityReport;suggestions:{suggestions:Suggestion[]}};
const list=z.array(z.string().max(1500)).max(30);
const schemas={
  suggestions:suggestionsSchema,
  questions:z.object({questions:z.array(questionSchema).min(2).max(4).refine(q=>new Set(q.map(x=>x.id)).size===q.length)}),
  generate:z.object({prompt:z.string().min(1).max(24000).refine(s=>!!s.trim()),summary:z.string().min(1).max(6000).refine(s=>!!s.trim()),constraints:list,assumptions:list,conflicts:list,
    requirementUpdates:z.array(z.object({id:z.string(),quote:z.string(),source:z.enum(['feedback','omissions','answer']),questionId:z.string().optional()})).max(20).optional(),qualityReport:qualityReportSchema.optional()}),
  evaluate:qualityReportSchema.extend({kind:z.literal('ai')}),
};
export async function readStudioResponse<A extends keyof Results>(response:Response,action:A):Promise<Results[A]>{
  let data:unknown;
  try{data=await response.json();}catch{/* Proxies and HTTP authentication can return HTML. */}
  if(!response.ok){
    const body=data&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,unknown>:{};
    const fallback=response.status===401?'网站登录已失效，请重新打开网站并输入访问用户名和密码。输入已保留。':response.status>=500?'服务暂时不可用，请稍后重试。输入已保留。':'请求未成功，请重试。输入已保留。';
    throw new StudioApiError(response.status,typeof body.code==='string'?body.code:response.status===401?'authentication_required':'request_failed',typeof body.message==='string'&&body.message.trim()?body.message:fallback);
  }
  const parsed=schemas[action].safeParse(data);
  if(!parsed.success)throw new StudioApiError(response.status,'invalid_response','未收到完整可用的结果，输入和原稿已保留，请重试。');
  return parsed.data as Results[A];
}
export function requestFailureMessage(error:unknown):string{
  if(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name))return '等待响应超时，输入和原稿已保留，请重试。';
  if(error instanceof TypeError)return /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(error.message)?'网络连接失败，请检查网络后重试。输入和原稿已保留。':'请求处理失败，输入和原稿已保留，请重试。';
  return error instanceof Error?error.message:'请求未成功，输入和原稿已保留，请重试。';
}
