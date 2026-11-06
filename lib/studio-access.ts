import { publicAuthConfig } from './auth-config.ts';

export async function checkStudioAccess(
  request: Request,
  env: Parameters<typeof publicAuthConfig>[0],
  fetcher: typeof fetch = fetch,
  quotaHeaders: Headers = new Headers(),
): Promise<Response | null> {
  const deny = (status: number, code: string, message: string) =>
    Response.json({ code, message }, { status, headers: { ...Object.fromEntries(quotaHeaders), 'Cache-Control': 'private, no-store' } });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return deny(403, 'origin', '请求来源不匹配，请在本站重试。');
  }

  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer [\w.-]+$/i.test(authorization)) {
    return deny(401, 'login_required', '请先注册并验证邮箱，然后登录问形。');
  }
  const config = publicAuthConfig(env);
  if (!config.url || !config.publishableKey) {
    return deny(503, 'auth_unavailable', '账号服务尚未配置。');
  }

  try {
    const response = await fetcher(`${config.url}/auth/v1/user`, {
      headers: { authorization, apikey: config.publishableKey },
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    });
    if (response.status === 401 || response.status === 403) {
      return deny(401, 'login_required', '登录已失效，请重新登录。');
    }
    if (!response.ok) return deny(503, 'auth_unavailable', '暂时无法验证账号，请稍后重试。');
    const user = await response.json() as { id?: string; email_confirmed_at?: string };
    if (!user.id || !user.email_confirmed_at) {
      return deny(403, 'email_not_confirmed', '请先完成邮箱验证。');
    }
    const budget=await fetcher(`${config.url}/rest/v1/rpc/wenxing_consume_generation`,{
      method:'POST',headers:{authorization,apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}',
      redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(8000)]),
    });
    if(!budget.ok)return deny(503,'quota_unavailable','暂时无法检查使用额度，请稍后重试。');
    const result=await budget.json() as {allowed?:boolean;reason?:string;retry_after?:number;remaining?:number;limit?:number;reset_at?:string};
    if(!result||result.limit!==7||!Number.isSafeInteger(result.remaining)||result.remaining!<0||result.remaining!>7||typeof result.reset_at!=='string'||!Number.isFinite(Date.parse(result.reset_at)))return deny(503,'quota_unavailable','暂时无法检查使用额度，请稍后重试。');
    quotaHeaders.set('X-Wenxing-Quota-Remaining',String(result.remaining));
    quotaHeaders.set('X-Wenxing-Quota-Limit','7');
    quotaHeaders.set('X-Wenxing-Quota-Reset',result.reset_at);
    if(result?.allowed===true)return null;
    if(result?.allowed!==false||!['account_daily','site_daily','interval'].includes(result.reason??''))return deny(503,'quota_unavailable','暂时无法检查使用额度，请稍后重试。');
    const retry=Number.isSafeInteger(result.retry_after)&&result.retry_after!>0?Math.min(result.retry_after!,86400):60;
    const messages:Record<string,string>={account_daily:'今天的7次使用次数已用尽，感谢你使用问形。北京时间每日00:00恢复，已有内容仍可查看、编辑、复制和下载。',site_daily:'本站今天的请求额度已用完，北京时间明天零点恢复。',interval:`请等待${retry}秒再提交下一次请求。`};
    const limited=deny(429,result.reason==='account_daily'?'quota_exhausted':'quota',messages[result.reason!]);limited.headers.set('Retry-After',String(retry));return limited;
  } catch {
    return deny(503, 'auth_unavailable', '暂时无法验证账号，请稍后重试。');
  }
}
