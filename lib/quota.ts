export type QuotaSnapshot={remaining:number;limit:7;resetAt:string};
export type QuotaNoticeKind='low'|'exhausted';
export function readQuotaSnapshot(headers:Headers):QuotaSnapshot|null{
 const remaining=headers.get('X-Wenxing-Quota-Remaining'),limit=headers.get('X-Wenxing-Quota-Limit'),resetAt=headers.get('X-Wenxing-Quota-Reset');
 if(remaining===null||!/^\d+$/.test(remaining)||limit!=='7'||!resetAt||!Number.isFinite(Date.parse(resetAt)))return null;
 const count=Number(remaining);if(!Number.isSafeInteger(count)||count<0||count>7)return null;
 return {remaining:count,limit:7,resetAt};
}
export class QuotaNoticeTracker{
 private resetAt='';private low=false;private exhausted=false;
 next(quota:QuotaSnapshot):QuotaNoticeKind|null{
  if(quota.resetAt!==this.resetAt){this.resetAt=quota.resetAt;this.low=false;this.exhausted=false;}
  if(quota.remaining===0&&!this.exhausted){this.exhausted=true;return 'exhausted';}
  if(quota.remaining>0&&quota.remaining<=3&&!this.low){this.low=true;return 'low';}
  return null;
 }
}
export function withQuotaHeaders(response:Response,quotaHeaders:Headers):Response{
 const headers=new Headers(response.headers);
 for(const [name,value]of quotaHeaders)headers.set(name,value);
 headers.set('Cache-Control','private, no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
