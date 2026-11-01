'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {X,UserRound,LoaderCircle} from 'lucide-react';
import {useAccount} from './AccountSession';
import {readBackup,type Workspace} from '@/lib/backup';
import {CloudRevision} from '@/lib/account-workspace';

function message(error:unknown){
  const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
  if(code==='invalid_credentials')return '邮箱或密码不正确，请重试。';
  if(code==='email_not_confirmed')return '请先打开验证邮件完成邮箱验证。';
  if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return '操作较频繁，请稍后再试。';
  if(error instanceof Error&&error.message.includes('10MB'))return error.message;
  return '操作未完成，请检查网络或稍后重试。';
}
export function AccountPanel({disabled,workspace,onImport,onCloudBusy}:{disabled:boolean;workspace:()=>Workspace;onImport:(workspace:Workspace)=>Promise<void>;onCloudBusy:(busy:boolean)=>void}){
  const {client,session,recovery,finishRecovery}=useAccount();
  const [open,setOpen]=useState(false),[mode,setMode]=useState<'login'|'register'|'reset'>('login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[working,setWorking]=useState(false),[info,setInfo]=useState(''),[error,setError]=useState('');
  const [known,setKnown]=useState(false),[pending,setPending]=useState<Workspace|null>(null);
  const [revision]=useState(()=>new CloudRevision());
  const pendingRevision=useRef<number|null>(null);
  const live=useRef(true),modalRef=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),lock=useRef(false);
  const show=open||recovery;
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{
    if(!show)return;
    const previous=document.activeElement as HTMLElement|null;
    modalRef.current?.focus();
    function key(event:KeyboardEvent){
      if(event.key==='Escape'&&!working&&!recovery){setOpen(false);setPassword('');}
      if(event.key==='Tab'){
        const items=modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]');
        if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===modalRef.current)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    }
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[show,working,recovery]);
  async function run(task:()=>Promise<void>,cloud=false){
    if(lock.current||disabled)return;
    lock.current=true;setWorking(true);setError('');setInfo('');
    if(cloud)onCloudBusy(true);
    try{await task();}catch(e){if(live.current)setError(message(e));}
    finally{lock.current=false;if(live.current){setWorking(false);setPassword('');if(cloud)onCloudBusy(false);}}
  }
  async function auth(event:FormEvent){
    event.preventDefault();if(!client)return;
    await run(async()=>{
      if(recovery){const {error}=await client.auth.updateUser({password});if(error)throw error;finishRecovery();setInfo('密码已更新。');}
      else if(mode==='reset'){const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin});if(error)throw error;setInfo('如该邮箱已注册，你将收到重置密码邮件，请在此浏览器打开链接。');}
      else if(mode==='register'){const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:location.origin}});if(error)throw error;setInfo(data.session?'账号已创建。':'请查收验证邮件，完成验证后再登录。');}
      else {const {error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}
    });
  }
  async function readCloud(){
    if(!client||!session)throw Error();
    const {data,error}=await client.from('wenxing_workspaces').select('workspace,revision').eq('user_id',session.user.id).maybeSingle();
    if(error)throw error;
    return data;
  }
  return <><button ref={trigger} className="model-button account-trigger" disabled={disabled||working} onClick={()=>{setOpen(true);setPassword('');setError('');setInfo('');}}><UserRound size={15}/><span>{session?'我的账号':'登录 / 注册'}</span></button>
    {show&&<div className="modal-backdrop account-backdrop"><div ref={modalRef} className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" tabIndex={-1}>
      {!recovery&&<button className="modal-close" aria-label="关闭账号窗口" disabled={working} onClick={()=>{setOpen(false);setPassword('');}}><X size={20}/></button>}
      <h2 id="account-title">{recovery?'设置新密码':session?'我的账号':mode==='register'?'注册账号':mode==='reset'?'重置密码':'登录问形'}</h2>
      {!client?<p>账号服务尚未配置。你可以继续使用当前浏览器的访客工作区。</p>:<>
      {session&&!recovery?<><p className="account-email">{session.user.email}</p><p>当前账号使用独立的本地工作区。云端保存与读取均需手动操作。</p>
        <section className="account-cloud"><h3>云端工作区</h3><p>先检查云端版本，再保存当前工作区。读取云端会先显示确认，并合并到本地，已有项目会保留。</p>
        <div className="row-actions"><button className="secondary" disabled={disabled||working||known} onClick={()=>void run(async()=>{const data=await readCloud();revision.observe(data?.revision??0);setKnown(true);setInfo(data?'已检查云端版本。若其他设备更新，保存将被阻止。':'云端暂无工作区，可以首次保存。');},true)}>检查云端版本</button>
        <button className="primary" disabled={disabled||working||!known||!!pending} onClick={()=>void run(async()=>{
          const snapshot=readBackup(JSON.stringify(workspace()));
          const {data,error}=await client.rpc('wenxing_save_workspace',{p_workspace:snapshot,p_expected_revision:revision.expected()});
          if(error){if(error.message?.toLowerCase().includes('conflict')||error.code==='40001'||error.code==='P0001'){setError('云端已有更新，未覆盖。请先读取合并云端工作区，再保存。');return;}throw error;}
          revision.saved(data);setInfo('当前工作区已保存到云端。');
        },true)}>保存当前工作区到云端</button>
        <button className="secondary" disabled={disabled||working} onClick={()=>void run(async()=>{const data=await readCloud();if(!data){revision.observe(0);setKnown(true);setInfo('云端暂无工作区。');return;}const backup=readBackup(JSON.stringify(data.workspace));pendingRevision.current=data.revision;setPending(backup);},true)}>读取云端工作区</button></div>
        {pending&&<div className="import-preview"><p>云端包含 {pending.projects.length} 个项目。确认后合并到当前账号本地工作区。</p><div className="row-actions"><button className="primary" disabled={disabled||working} onClick={()=>void run(async()=>{await onImport(pending);revision.observe(pendingRevision.current!);setKnown(true);setPending(null);setInfo('云端工作区已合并到本地。');})}>确认合并到本地</button><button className="secondary" disabled={working} onClick={()=>setPending(null)}>取消</button></div></div>}
        </section><button className="secondary" disabled={disabled||working} onClick={()=>void run(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;})}>退出当前设备账号</button>
      </>:<form onSubmit={auth} className="account-form">
        {!recovery&&<><label htmlFor="account-email">邮箱</label><input id="account-email" type="email" autoComplete="email" required value={email} disabled={working||disabled} onChange={e=>setEmail(e.target.value)}/></>}
        {(recovery||mode!=='reset')&&<><label htmlFor="account-password">{recovery?'新密码':'密码（至少8位）'}</label><input id="account-password" type="password" autoComplete={mode==='login'&&!recovery?'current-password':'new-password'} required minLength={8} value={password} disabled={working||disabled} onChange={e=>setPassword(e.target.value)}/></>}
        <button className="primary full" disabled={working||disabled} type="submit">{working?<><LoaderCircle size={16} className="spin"/> 正在处理…</>:recovery?'保存新密码':mode==='register'?'注册并验证邮箱':mode==='reset'?'发送重置邮件':'登录'}</button>
        {!recovery&&<div className="row-actions">{(['login','register','reset'] as const).filter(x=>x!==mode).map(item=><button type="button" className="text-button" disabled={working||disabled} key={item} onClick={()=>{setMode(item);setPassword('');setError('');setInfo('');}}>{item==='login'?'返回登录':item==='register'?'创建账号':'忘记密码'}</button>)}</div>}
      </form>}
      <p className="muted">访客数据不会自动归入账号。迁移时，请先在访客工作区下载备份，登录后在“问形服务”中导入备份。</p></>}
      {error&&<p role="alert" className="insight-error">{error}</p>}{info&&<p role="status">{info}</p>}
    </div></div>}
  </>;
}
