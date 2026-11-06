// Run through Tabbit with a built Pages client and the isolated registration preview.
// All auth traffic is intercepted; no real account is created and no mail is sent.
export async function testRegistrationPassword({page,expect,baseUrl='http://127.0.0.1:5199'}){
 const password='FixtureOnly!92835';
 const email='registration@example.test';
 let signupCount=0,resendCount=0,loginCount=0;
 await page.route(baseUrl+'/api/auth-config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'https://auth-fixture.example.test',publishableKey:'sb_publishable_browser_fixture'})}));
 await page.route('https://auth-fixture.example.test/**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postDataJSON?.()??{};
  const fulfill=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname.endsWith('/signup')){
   signupCount++;
   if(body.email==='failed@example.test')return fulfill({error_code:'unexpected_failure',message:'Test service unavailable'},500);
   expect(body.email).toBe(email);expect(body.password).toBe(password);
   return fulfill({user:{id:'08a82384-ee91-433f-9706-5b7a0cc6cd92',aud:'authenticated',role:'authenticated',email,app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:'2026-11-05T00:00:00Z'},session:null});
  }
  if(url.pathname.endsWith('/resend')){resendCount++;return fulfill({});}
  if(url.pathname.endsWith('/token')){loginCount++;return fulfill({error_code:'invalid_credentials',message:'Invalid login credentials'},400);}
  return fulfill({message:'Unexpected fixture request'},400);
 });
 await page.goto(baseUrl+'/',{waitUntil:'domcontentloaded'});
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'创建账号',exact:true}).click();
 await page.getByLabel('邮箱',{exact:true}).fill(email);
 await page.getByLabel('密码（至少8位）',{exact:true}).fill(password);
 // Exercise the original bug before asserting the new field so the baseline
 // failure explicitly identifies the request-finally password wipe.
 const confirmation=page.getByLabel('确认密码',{exact:true});
 if(await confirmation.count())await confirmation.fill(password);
 await dialog.getByRole('button',{name:'注册并验证邮箱',exact:true}).click();
 await expect(dialog.getByRole('status').first()).toContainText('验证');
 await expect(page.getByLabel('密码（至少8位）',{exact:true})).toHaveValue(password);
 await expect(confirmation).toHaveValue(password);
 expect(signupCount).toBe(1);
 await dialog.getByRole('button',{name:'重发验证邮件',exact:true}).click();
 await expect(page.getByLabel('密码（至少8位）',{exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'返回登录',exact:true}).click();
 await expect(page.getByLabel('邮箱',{exact:true})).toHaveValue(email);
 await expect(page.getByLabel('密码（至少8位）',{exact:true})).toHaveValue(password);
 await expect(confirmation).toHaveCount(0);
 await dialog.getByRole('button',{name:'登录',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('邮箱或密码');
 await expect(page.getByLabel('密码（至少8位）',{exact:true})).toHaveValue(password);
 expect(loginCount).toBe(1);
 await dialog.getByRole('button',{name:'创建账号',exact:true}).click();
 await page.getByLabel('邮箱',{exact:true}).fill('failed@example.test');
 await confirmation.fill(password);
 await dialog.getByRole('button',{name:'注册并验证邮箱',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText(/操作未完成|账号服务/);
 await expect(page.getByLabel('密码（至少8位）',{exact:true})).toHaveValue(password);
 await expect(confirmation).toHaveValue(password);
 expect(signupCount).toBe(2);
 // A different recipient has no cooldown: mismatched confirmation must prevent
 // the real signup request without consuming its email send allowance.
 await page.getByLabel('邮箱',{exact:true}).fill('mismatch@example.test');
 await page.getByLabel('密码（至少8位）',{exact:true}).fill(password);
 await confirmation.fill('DifferentFixture!92835');
 await dialog.getByRole('button',{name:'注册并验证邮箱',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('不一致');
 await expect(dialog.getByRole('button',{name:'注册并验证邮箱',exact:true})).toBeEnabled();
 expect(signupCount).toBe(2);expect(resendCount).toBe(0);
 const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
 expect(stored.includes(password)).toBe(false);
 expect(stored.includes('DifferentFixture!92835')).toBe(false);
 return {retainsPasswordAfterSignup:true,retainsPasswordThroughResendAndLogin:true,failedRequestsRetainPassword:true,mismatchedConfirmationBlocksSending:true,passwordNotPersisted:true};
}
