'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {X,UserRound,LoaderCircle} from 'lucide-react';
import {AdminDashboard} from './AdminDashboard';
import {useAccount} from './AccountSession';
import {readBackup,type Workspace} from '@/lib/backup';
import {CloudRevision,canAutoRestoreWorkspace} from '@/lib/account-workspace';
import {EmailSendCooldown,accountErrorMessage as message} from '@/lib/auth-email';

function verificationNotice(email:string){
  return `请在 ${email} 查收主题为「验证你的问形账号」的邮件，点击邮件里的按钮完成验证。收件箱里没有时，请检查垃圾邮件。`;
}

export function AccountPanel({disabled,workspace,onImport,onCloudBusy,localSaveWarning,onBackup}:{disabled:boolean;workspace?:()=>Workspace;onImport?:(workspace:Workspace)=>Promise<void>;onCloudBusy?:(busy:boolean)=>void;localSaveWarning?:string;onBackup?:()=>void}){
  const {client,session,recovery,finishRecovery}=useAccount();
  const [open,setOpen]=useState(false),[mode,setMode]=useState<'login'|'register'|'reset'|'resend'>('login');
  const [switching,setSwitching]=useState(false);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[working,setWorking]=useState(false),[info,setInfo]=useState(''),[error,setError]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [known,setKnown]=useState(false),[pending,setPending]=useState<{workspace:Workspace;revision:number}|null>(null);
  const [revision]=useState(()=>new CloudRevision());
  const live=useRef(true),modalRef=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),lock=useRef(false);
  const required=!workspace;
  const show=required||open||recovery;
  const [cooldown]=useState(()=>new EmailSendCooldown());
  const [clock,setClock]=useState(0);
  const mailMode=!recovery&&mode!=='login';
  const remaining=mailMode?cooldown.remaining(email,clock||Date.now()):0;
  useEffect(()=>{
    if(!show)return;
    const timer=window.setInterval(()=>setClock(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[show]);
  const accountId=session?.user.email_confirmed_at?session.user.id:null;
  const current=useRef({workspace,onImport,disabled});current.current={workspace,onImport,disabled};
  const cloudChecked=useRef(false);
  const [cloudNotice,setCloudNotice]=useState('项目自动保存在本浏览器；跨设备前请保存到云端。');
  useEffect(()=>{
    if(!client||!accountId||required||disabled||cloudChecked.current||!workspace)return;
    cloudChecked.current=true;
    const baseline=JSON.stringify(workspace());
    void(async()=>{
      try{
        const {data,error}=await client.from('wenxing_workspaces').select('workspace,revision').eq('user_id',accountId).maybeSingle();
        if(error)throw error;
        if(!live.current)return;
        if(!data){revision.inspect(0);setKnown(true);setCloudNotice('本地已保存；云端暂无备份，换设备前请在「我的账号」保存到云端。');return;}
        const backup=readBackup(JSON.stringify(data.workspace));
        const latest=current.current;
        if(latest.workspace&&latest.onImport&&!latest.disabled&&JSON.stringify(latest.workspace())===baseline&&canAutoRestoreWorkspace(latest.workspace())){
          await latest.onImport(backup);
          if(live.current){revision.merged(data.revision);setKnown(true);setCloudNotice('已从云端恢复项目；后续修改保存在本地，离开前请保存到云端。');}
        }else setCloudNotice('发现云端工作区；点「我的账号」检查并合并，本地内容会保留。');
      }catch{if(live.current)setCloudNotice('本地内容仍在；云端暂时无法检查，可在「我的账号」重试或下载备份。');}
    })();
  },[client,accountId,required,disabled,workspace,revision]);
  const [adminOpen,setAdminOpen]=useState(false);
  const [statsError,setStatsError]=useState('');
  const [stats,setStats]=useState<{registered:number;verified:number;today:number;online:number}|null>(null);
  useEffect(()=>{
    if(!client||!accountId||required||recovery)return;
    const heartbeat=()=>{
      if(document.visibilityState==='visible')void client.rpc('wenxing_heartbeat').then(()=>{});
    };
    heartbeat();
    const timer=window.setInterval(heartbeat,60000);
    document.addEventListener('visibilitychange',heartbeat);
    return ()=>{
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',heartbeat);
    };
  },[client,accountId,required,recovery]);
  useEffect(()=>{
    setStats(null);setStatsError('');
    if(!client||!accountId||!open||switching||recovery)return;
    let live=true;
    const refresh=()=>{
      void client.rpc('wenxing_usage_stats').then(({data,error})=>{
        if(live){if(error)setStatsError('管理员状态暂时无法检查，请重新打开账号窗口重试。');else {setStats(data);setStatsError('');}}
      });
    };
    refresh();
    const timer=window.setInterval(refresh,30000);
    return ()=>{live=false;window.clearInterval(timer);};
  },[client,accountId,open,switching,recovery]);
  function resetSwitch() {
    setSwitching(false);
    setMode('login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setInfo('');
  }
  function startSwitch() {
    resetSwitch();
    setSwitching(true);
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setError('');
    setInfo('');
  }
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{
    if(!show)return;
    const previous=document.activeElement as HTMLElement|null;
    modalRef.current?.focus();
    function key(event:KeyboardEvent){
      if(event.key==='Escape'&&!working&&!recovery&&!required){
        if(switching)resetSwitch();
        else setOpen(false);
        setPassword('');
        setConfirmPassword('');
      }
      if(event.key==='Tab'){
        const items=modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]');
        if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===modalRef.current)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    }
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[show,working,recovery,required,switching]);
  async function run(task:()=>Promise<void>,cloud=false){
    if(lock.current||(cloud&&disabled))return;
    lock.current=true;setWorking(true);setError('');setInfo('');
    if(cloud)onCloudBusy?.(true);
    try{await task();}catch(e){if(live.current)setError(message(e));}
    finally{lock.current=false;if(live.current){setWorking(false);if(cloud)onCloudBusy?.(false);}}
  }
  async function auth(event:FormEvent){
    event.preventDefault();if(!client)return;
    if((recovery||mode==='register')&&password!==confirmPassword){
      setError('两次输入的密码不一致，请重新确认。');
      modalRef.current?.querySelector<HTMLInputElement>('#account-password-confirm')?.focus();
      return;
    }
    if(mailMode&&cooldown.remaining(email)>0)return;
    await run(async()=>{
      // Reserve before sending: timeouts can occur after the server accepted the email.
      if(mailMode){cooldown.sent(email);setClock(Date.now());}
      if(recovery){const {error}=await client.auth.updateUser({password});if(error)throw error;setPassword('');setConfirmPassword('');finishRecovery();setInfo('密码已更新。');}
      else if(mode==='reset'){const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin});if(error)throw error;setInfo('如该邮箱已注册，你将收到重置密码邮件，请在此浏览器打开链接。');}
      else if(mode==='resend'){
        const target=email.trim();
        const {error}=await client.auth.resend({type:'signup',email:target,options:{emailRedirectTo:location.origin}});
        if(error)throw error;
        setInfo(verificationNotice(target));
      }
      else if(mode==='register'){
        const target=email.trim();
        const {data,error}=await client.auth.signUp({email:target,password,options:{emailRedirectTo:location.origin}});
        if(error)throw error;
        if(data.session){setPassword('');setConfirmPassword('');}
        setInfo(data.session?'账号已创建。':`${verificationNotice(target)} 密码已设置好，无需再次注册或重新设置密码。验证后返回登录，将保留本次填写的密码。`);
      }
      else {
        const target=email.trim();
        if(switching&&target.toLowerCase()===session?.user.email?.toLowerCase()){
          setError('这个账号已登录，请填写另一个账号的邮箱。');
          return;
        }
        const {data,error}=await client.auth.signInWithPassword({email:target,password});
        if(error)throw error;
        setPassword('');setConfirmPassword('');
        if(switching&&data.user?.id===session?.user.id)resetSwitch();
      }
    });
  }
  async function readCloud(){
    if(!client||!session)throw Error();
    const {data,error}=await client.from('wenxing_workspaces').select('workspace,revision').eq('user_id',session.user.id).maybeSingle();
    if(error)throw error;
    return data;
  }
  async function inspectCloud() {
    setPending(null);
    const data=await readCloud();
    setKnown(revision.inspect(data?.revision??0));
    if(!data){
      setInfo('云端还没有工作区，可以首次保存。');
      return;
    }
    setPending({workspace:readBackup(JSON.stringify(data.workspace)),revision:data.revision});
  }
  async function saveCloud() {
    if(!client||!workspace)return;
    const snapshot=readBackup(JSON.stringify(workspace()));
    const {data,error}=await client.rpc('wenxing_save_workspace',{
      p_workspace:snapshot,p_expected_revision:revision.expected(),
    });
    if(error){
      if(error.code==='40001'||error.code==='P0001'||error.message?.toLowerCase().includes('conflict')){
        revision.invalidate();
        setKnown(false);
        setError('其他设备已更新云端。请检查并读取云端，合并后再保存。');
        return;
      }
      throw error;
    }
    revision.saved(data);
    setCloudNotice('已保存到云端；其他设备登录后可恢复这次保存的项目。');
    setInfo('当前工作区已保存到云端。');
  }
  async function mergeCloud() {
    if(!pending||!onImport)return;
    await onImport(pending.workspace);
    revision.merged(pending.revision);
    setKnown(true);
    setPending(null);
    setInfo('云端工作区已合并到本地，可以保存。');
  }
  return <>{!required&&<><button ref={trigger} className="model-button account-trigger" disabled={working} onClick={()=>{resetSwitch();setOpen(true);}}><UserRound size={15}/><span>{session?'我的账号':'登录 / 注册'}</span></button><button className="workspace-sync-notice" disabled={working} onClick={()=>{resetSwitch();setOpen(true);}}>{cloudNotice}</button></>}
    {show&&<div className="modal-backdrop account-backdrop"><div ref={modalRef} className={"modal account-modal"+(adminOpen?" admin-expanded":"")} role="dialog" aria-modal="true" aria-labelledby="account-title" tabIndex={-1}>
      {!recovery&&!required&&<button className="modal-close" aria-label="关闭账号窗口" disabled={working} onClick={()=>{setOpen(false);resetSwitch();}}><X size={20}/></button>}
      <h2 id="account-title">{recovery?'设置新密码':session&&!required&&!switching?'我的账号':mode==='register'?'注册账号':mode==='reset'?'找回密码':mode==='resend'?'重发验证邮件':switching?'切换账号':'登录问形'}</h2>
      {!client?<p>账号服务尚未配置，请稍后重试。</p>:<>
      {session&&!recovery&&!switching&&workspace&&onImport?<><p className="account-email">{session.user.email}</p>{stats&&<section className="account-cloud" aria-label="站点统计">
        <h3>站点统计</h3>
        <p>注册账号 {stats.registered} · 已验证 {stats.verified}</p>
        <p>今日使用 {stats.today} · 当前在线约 {stats.online}</p>
        <p className="muted">今日按北京时间计算。在线人数按最近两分钟有活动心跳的账号去重。</p>
      <button type="button" className="secondary" onClick={()=>setAdminOpen(v=>!v)}>{adminOpen?'收起管理后台':'查看注册账号与用量明细'}</button></section>}{stats&&adminOpen&&<AdminDashboard/>}{statsError&&<p role="status">{statsError}</p>}<p>当前账号使用独立的本地工作区。空白工作区会尝试恢复云端项目；后续修改请手动保存到云端。</p>
        <section className="account-cloud">
          <h3>云端工作区</h3>
          <p>先检查云端。已有项目时，确认合并后即可保存当前工作区。</p>
          <div className="row-actions">
            <button className="secondary" disabled={disabled||working} onClick={()=>void run(inspectCloud,true)}>检查并读取云端</button>
            <button className="primary" disabled={disabled||working||!known||!!pending} onClick={()=>void run(saveCloud,true)}>保存到云端</button>
          </div>
          {pending&&<div className="import-preview">
            <p>云端有 {pending.workspace.projects.length} 个项目，合并时会保留本地项目。</p>
            <ul>{pending.workspace.projects.slice(0,5).map(project=><li key={project.id}>{project.goal||'未命名项目'}</li>)}</ul>
            {pending.workspace.projects.length>5&&<p>另有 {pending.workspace.projects.length-5} 个项目。</p>}
            <div className="row-actions">
              <button className="primary" disabled={disabled||working} onClick={()=>void run(mergeCloud)}>确认合并到本地</button>
              <button className="secondary" disabled={working} onClick={()=>setPending(null)}>取消</button>
            </div>
          </div>}
        </section><div className="row-actions"><button className="secondary" disabled={working} onClick={startSwitch}>切换账号</button><button className="secondary" disabled={working} onClick={()=>void run(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;})}>退出当前设备账号</button></div>
      </>:<form onSubmit={auth} className="account-form">
        {switching&&<><p>当前账号 {session?.user.email}</p>{mode==='login'&&<p>登录成功后将打开另一个账号在此浏览器的工作区。</p>}
          {localSaveWarning&&<><p role="status">{localSaveWarning}</p><button type="button" className="secondary" disabled={working} onClick={onBackup}>下载当前工作区备份</button></>}
        </>}
        {!recovery&&<><label htmlFor="account-email">邮箱</label><input id="account-email" type="email" autoComplete="email" required value={email} disabled={working} onChange={e=>setEmail(e.target.value)}/></>}
        {(recovery||(mode==='login'||mode==='register'))&&<><label htmlFor="account-password">{recovery?'新密码':'密码（至少8位）'}</label><input id="account-password" type="password" autoComplete={mode==='login'&&!recovery?'current-password':'new-password'} required minLength={8} value={password} disabled={working} onChange={e=>setPassword(e.target.value)}/></>}
        {(recovery||mode==='register')&&<><label htmlFor="account-password-confirm">确认密码</label><input id="account-password-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} disabled={working} aria-invalid={!!error&&password!==confirmPassword} onChange={e=>{setConfirmPassword(e.target.value);if(error)setError('');}}/></>}
        <button className="primary full" disabled={working||remaining>0} type="submit">{working?<><LoaderCircle size={16} className="spin"/> 正在处理…</>:remaining>0?`${remaining} 秒后可重新发送`:recovery?'保存新密码':mode==='register'?'注册并验证邮箱':mode==='reset'?'发送重置邮件':mode==='resend'?'发送验证邮件':switching?'登录并切换':'登录'}</button>
        {mailMode&&<p className="muted">同一邮箱每次发送后需间隔60秒。请使用最新邮件；收件箱没有时检查垃圾邮件，避免连续重发。</p>}
        {info&&(mode==='register'||mode==='resend')&&<p role="status" style={{overflowWrap:'anywhere'}}>{info}</p>}
        {!recovery&&<div className="row-actions">
          {(['login','register','reset','resend'] as const).filter(item=>item!==mode&&(item!=='resend'||mode==='register')).map(item=>
            <button type="button" className="text-button" disabled={working} key={item} onClick={()=>changeMode(item)}>
              {item==='login'?(switching?'返回切换账号':'返回登录'):item==='register'?'创建账号':item==='resend'?'重发验证邮件':(switching?'找回密码':'忘记密码')}
            </button>
          )}
        </div>}
        {switching&&!recovery&&<button type="button" className="secondary" disabled={working} onClick={resetSwitch}>返回我的账号</button>}
      </form>}
      {required&&!recovery&&<p className="muted">注册并验证邮箱后，登录即可使用提示词工作区。</p>}</>}
      {required&&!recovery&&<a className="text-button" href="/about/">了解问形</a>}
      <p><a href="/help/" target="_blank" rel="noopener noreferrer">注册、邮件与跨设备使用帮助</a></p>
      {error&&<p role="alert" className="insight-error">{error}</p>}{info&&((mode!=='register'&&mode!=='resend')||recovery)&&<p role="status">{info}</p>}
    </div></div>}
  </>;
}
