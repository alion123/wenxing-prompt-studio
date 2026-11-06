export async function testAdminDashboard({page,expect,baseUrl='http://127.0.0.1:5199'}){
 const uid='99999999-0000-4000-8000-000000000008';let isAdmin=true,modelCalls=0;
 await page.route(baseUrl+'/api/auth-config',r=>r.fulfill({json:{url:'https://admin-fixture.example.test',publishableKey:'sb_publishable_admin_fixture'}}));
 await page.route(baseUrl+'/api/studio',r=>{modelCalls++;return r.fulfill({status:500,json:{message:'Unexpected model call'}});});
 await page.route('https://admin-fixture.example.test/**',r=>{
  const path=new URL(r.request().url()).pathname;
  const user={id:uid,aud:'authenticated',role:'authenticated',email:'admin@example.test',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
  if(path.endsWith('/token')){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return r.fulfill({json:{access_token:enc({alg:'HS256'})+'.'+enc({sub:uid,exp:Math.floor(Date.now()/1000)+3600})+'.fixture',refresh_token:'fixture',token_type:'bearer',expires_in:3600,user}});}
  if(path.endsWith('/user'))return r.fulfill({json:user});
  if(path.endsWith('/wenxing_quota_status'))return r.fulfill({json:{remaining:3,limit:7,reset_at:new Date(Date.now()+3600_000).toISOString()}});
  if(path.endsWith('/wenxing_usage_stats'))return r.fulfill({json:isAdmin?{registered:1,verified:1,today:1,online:1}:null});
  if(path.endsWith('/wenxing_admin_dashboard'))return r.fulfill({json:{summary:{registered:1,verified:1,today:1,online:1,requests:4},total:1,offset:0,users:[{...user,created_at:new Date().toISOString(),verified:true,admin:true,used:4,remaining:3,last_sign_in_at:null,last_seen:null,cloud_saved_at:null}],days:[{day:'2026-11-06',requests:4}]}});
  return r.fulfill({json:null});
 });
 await page.goto(baseUrl+'/',{waitUntil:'domcontentloaded'});
 const login=page.getByRole('dialog');await login.getByLabel('邮箱',{exact:true}).fill('admin@example.test');await login.getByLabel('密码（至少8位）',{exact:true}).fill('FixtureAdmin!123');await login.getByRole('button',{name:'登录',exact:true}).click();
 await expect(page.locator('.page-footer')).toContainText('每天7次');await expect(page.getByText('今日剩余 3 / 7 次',{exact:true})).toBeVisible();
 const border=await page.locator('.type-card').first().evaluate(e=>({width:getComputedStyle(e).borderTopWidth,style:getComputedStyle(e).borderTopStyle}));expect(parseFloat(border.width)).toBeGreaterThan(0);expect(border.style).toBe('solid');
 await page.getByRole('button',{name:'我的账号',exact:true}).click();await page.getByRole('button',{name:'查看注册账号与用量明细',exact:true}).click();
 await expect(page.getByRole('table').first()).toContainText('admin@example.test');await expect(page.getByRole('table').first()).toContainText('已用 4 · 剩 3');
 await page.getByLabel('查找注册账号',{exact:true}).fill('admin');await page.getByRole('button',{name:'搜索',exact:true}).click();await expect(page.getByRole('table').first()).toContainText('admin@example.test');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(modelCalls).toBe(0);
 return {quotaVisibleWithoutCharge:true,footerSeven:true,boxedOptions:true,adminAccountDetails:true,mobileNoPageOverflow:true};
}
