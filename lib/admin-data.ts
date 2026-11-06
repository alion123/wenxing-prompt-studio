import type {QuotaSnapshot} from './quota.ts';
export function parseQuotaStatus(value:unknown):QuotaSnapshot{
 const d=value as Record<string,unknown>|null;
 if(!d||d.limit!==7||!Number.isSafeInteger(d.remaining)||Number(d.remaining)<0||Number(d.remaining)>7||typeof d.reset_at!=='string'||!Number.isFinite(Date.parse(d.reset_at)))throw Error('暂时无法读取剩余次数，请稍后刷新。');
 return {remaining:d.remaining as number,limit:7,resetAt:d.reset_at};
}
export type AdminUser={id:string;email:string;created_at:string;verified:boolean;admin:boolean;used:number;remaining:number;last_sign_in_at:string|null;last_seen:string|null;cloud_saved_at:string|null};
export type AdminData={summary:{registered:number;verified:number;today:number;online:number;requests:number};total:number;offset:number;users:AdminUser[];days:{day:string;requests:number}[]};
export function parseAdminDashboard(value:unknown):AdminData{
 const d=value as AdminData|null;const count=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
 if(!d||!d.summary||!['registered','verified','today','online','requests'].every(k=>count(d.summary[k as keyof AdminData['summary']]))||!count(d.total)||!count(d.offset)||!Array.isArray(d.users)||d.users.length>20||!Array.isArray(d.days)||d.days.length>30)throw Error('后台数据格式异常，请刷新重试。');
 for(const u of d.users){if(typeof u.id!=='string'||typeof u.email!=='string'||typeof u.created_at!=='string'||typeof u.verified!=='boolean'||typeof u.admin!=='boolean'||!count(u.used)||!count(u.remaining)||u.remaining>7||![u.last_sign_in_at,u.last_seen,u.cloud_saved_at].every(x=>x===null||typeof x==='string'))throw Error('账号明细格式异常。');}
 if(d.days.some(x=>typeof x.day!=='string'||!count(x.requests)))throw Error('每日统计格式异常。');
 return d;
}
