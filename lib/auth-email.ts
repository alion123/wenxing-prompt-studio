export class EmailSendCooldown {
  private until=new Map<string,number>();
  sent(email:string,now=Date.now()):void{
    for(const [key,value] of this.until)if(value<=now)this.until.delete(key);
    this.until.set(email.trim().toLowerCase(),now+60_000);
  }
  remaining(email:string,now=Date.now()):number{
    return Math.max(0,Math.ceil(((this.until.get(email.trim().toLowerCase())??0)-now)/1000));
  }
}

export function accountErrorMessage(error:unknown):string {
  const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
  if(code==='invalid_credentials')return '邮箱或密码不正确，请重试。';
  if(code==='weak_password')return '密码需至少8位，包含大写字母、小写字母、数字和特殊符号（如 ! @ # _）。';
  if(code==='email_not_confirmed')return '请先打开验证邮件完成邮箱验证。没收到邮件时，进入「创建账号」并选择「重发验证邮件」。';
  if(code==='over_email_send_rate_limit')return '站点发信额度暂时用尽，请稍后再试。请勿连续重发；也可检查垃圾邮件中已有的验证邮件。';
  if(code==='over_request_rate_limit')return '操作较频繁，请稍后再试。';
  if(code==='email_address_not_authorized'||code==='email_provider_disabled')return '发信服务暂时无法向此邮箱发送邮件，请联系站点管理员。';
  if(code==='unexpected_failure')return '账号服务暂时未能完成请求，请稍后再试。';
  if(code==='request_timeout')return '连接超时，操作结果暂未确认。请检查邮箱或登录状态，稍后重试，避免连续提交。';
  if(error instanceof Error&&error.message.includes('10MB'))return error.message;
  if(error instanceof Error&&(/timeout|timed out|超时/i.test(error.message)||['AbortError','TimeoutError'].includes(error.name)))return '连接超时，操作结果暂未确认。请检查邮箱或登录状态，稍后重试，避免连续提交。';
  return '操作未完成，请检查网络或稍后重试。';
}
