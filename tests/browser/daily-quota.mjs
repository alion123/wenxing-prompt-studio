// Uses isolated auth/model transports; never sends mail or consumes live quota.
export async function testDailyQuota({page,expect,baseUrl='http://127.0.0.1:5199'}){
 const uid='99999999-0000-4000-8000-000000000007';
 const email='quota@example.test';
 const resetAt=new Date(Date.now()+12*3600_000).toISOString();
 let requests=0;
 await page.addInitScript(()=>{localStorage.removeItem('sb-quota-fixture-auth-token');localStorage.removeItem('wenxu.studio.v1.account.99999999-0000-4000-8000-000000000007');});
 await page.route(baseUrl+'/api/auth-config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'https://quota-fixture.example.test',publishableKey:'sb_publishable_quota_fixture'})}));
 await page.route('https://quota-fixture.example.test/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/token')){
   const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
   const access=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fixture';
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:access,refresh_token:'quota-fixture',token_type:'bearer',expires_in:3600,user:{id:uid,aud:'authenticated',role:'authenticated',email,email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()}})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:'null'});
 });
 await page.route(baseUrl+'/api/studio',async route=>{
  requests++;
  const remaining=requests===1?3:requests===2?2:0;
  const headers={'X-Wenxing-Quota-Remaining':String(remaining),'X-Wenxing-Quota-Limit':'7','X-Wenxing-Quota-Reset':resetAt};
  return route.fulfill({status:requests>3?429:200,contentType:'application/json',headers,body:JSON.stringify(requests>3?{code:'quota_exhausted',message:'今天的7次使用次数已用尽，感谢你使用问形。已有内容仍可查看、编辑、复制和下载。'}:{questions:[{id:'q1',text:'主要给谁使用？',hint:'说明用途',options:['个人','团队','不确定']},{id:'q2',text:'需要什么风格？',hint:'说明风格',options:['简洁','活泼','不确定']}]})});
 });
 await page.goto(baseUrl+'/',{waitUntil:'domcontentloaded'});
 const login=page.getByRole('dialog');
 await login.getByLabel('邮箱',{exact:true}).fill(email);
 await login.getByLabel('密码（至少8位）',{exact:true}).fill('FixtureQuotaOnly!123');
 await login.getByRole('button',{name:'登录',exact:true}).click();
 await expect(page.locator('#goal')).toBeVisible();
 await page.locator('#goal').fill('额度回归检查的项目，请保留我的输入');
 await page.getByRole('button',{name:'开始梳理想法',exact:false}).click();
 const notice=page.getByRole('alertdialog');
 await expect(notice).toContainText('3次');
 await notice.getByRole('button',{name:'我知道了',exact:true}).click();
 await expect(notice).toHaveCount(0);
 async function reask(){
  await page.getByRole('button',{name:'重新提问',exact:true}).click();
  await page.getByRole('button',{name:'确认重新提问',exact:true}).click();
 }
 await reask();await expect(page.getByText('今日剩余 2 / 7 次',{exact:true})).toBeVisible();
 await expect(notice).toHaveCount(0);
 await reask();await expect(notice).toContainText('已用尽');
 await expect(notice).toContainText('感谢');
 await notice.getByRole('button',{name:'我知道了',exact:true}).click();
 await expect(page.getByText('今日剩余 0 / 7 次',{exact:true})).toBeVisible();
 await reask();await expect(page.getByRole('alert')).toContainText('7次使用次数已用尽');
 await expect(page.getByRole('alertdialog')).toHaveCount(0);
 await expect(page.getByText('额度回归检查的项目，请保留我的输入',{exact:true}).first()).toBeVisible();
 return {lowQuotaPopup:true,doesNotRepeatLowWarning:true,exhaustionNotice:true,quotaErrorRetainsProject:true,requests};
}
