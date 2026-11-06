export async function testPasswordRules({page,expect,baseUrl='http://127.0.0.1:5199'}){
 let signups=0,logins=0,updates=0;
 await page.addInitScript(()=>{localStorage.removeItem('sb-password-fixture-auth-token');localStorage.removeItem('wenxu.studio.v1.account.99999999-0000-4000-8000-000000000009');});
 const user={id:'99999999-0000-4000-8000-000000000009',aud:'authenticated',role:'authenticated',email:'password@example.test',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
 await page.route(baseUrl+'/api/auth-config',r=>r.fulfill({json:{url:'https://password-fixture.example.test',publishableKey:'sb_publishable_password_fixture'}}));
 await page.route('https://password-fixture.example.test/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/user')){if(r.request().method()==='PUT')updates++;return r.fulfill({json:user});}
  if(path.endsWith('/signup')){signups++;return r.fulfill({json:{user:{id:'password-fixture',email:'password@example.test',identities:[],created_at:new Date().toISOString()},session:null}});}
  if(path.endsWith('/token')){logins++;return r.fulfill({status:400,json:{error_code:'invalid_credentials',message:'fixture'}});}
  return r.fulfill({json:null});
 });
 await page.goto(baseUrl+'/',{waitUntil:'domcontentloaded'});
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'创建账号',exact:true}).click();
 await dialog.getByLabel('邮箱',{exact:true}).fill('password@example.test');
 await page.locator('#account-password').fill('NoSymbol123');await page.getByLabel('确认密码',{exact:true}).fill('NoSymbol123');
 await dialog.getByRole('button',{name:'注册并验证邮箱',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('特殊符号');expect(signups).toBe(0);
 await expect(dialog.getByRole('button',{name:'注册并验证邮箱',exact:true})).toBeEnabled();
 await page.locator('#account-password').fill('WithSymbol123!');await page.getByLabel('确认密码',{exact:true}).fill('WithSymbol123!');
 await dialog.getByRole('button',{name:'注册并验证邮箱',exact:true}).click();
 await expect(dialog.getByRole('status').first()).toContainText('验证');expect(signups).toBe(1);
 await dialog.getByRole('button',{name:'返回登录',exact:true}).click();
 await page.locator('#account-password').fill('OldPassword123');await dialog.getByRole('button',{name:'登录',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('邮箱或密码');expect(logins).toBe(1);
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const token=enc({alg:'HS256'})+'.'+enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})+'.fixture';
 await page.goto(baseUrl+'/#'+new URLSearchParams({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:'3600',type:'recovery'}),{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'设置新密码',exact:true})).toBeVisible();
 await page.getByLabel('新密码',{exact:true}).fill('NoSymbol123');await page.getByLabel('确认密码',{exact:true}).fill('NoSymbol123');await page.getByRole('button',{name:'保存新密码',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('特殊符号');expect(updates).toBe(0);
 await page.getByLabel('新密码',{exact:true}).fill('WithSymbol123!');await page.getByLabel('确认密码',{exact:true}).fill('WithSymbol123!');await page.getByRole('button',{name:'保存新密码',exact:true}).click();
 await expect(page.getByRole('heading',{name:'设置新密码',exact:true})).not.toBeVisible();expect(updates).toBe(1);
 return {weakSignupBlockedBeforeSend:true,validSignupAccepted:true,noCooldownForInvalidPassword:true,legacyLoginNotBlocked:true,recoveryValidated:true};
}
