'use client';
import {useEffect,useRef,useState} from 'react';
import {useAccount} from './AccountSession';
import {parseAdminDashboard,type AdminData} from '@/lib/admin-data';
const time=(s:string|null)=>s?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(s)):'—';
export function AdminDashboard(){
 const {client}=useAccount();const [data,setData]=useState<AdminData|null>(null),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');const serial=useRef(0);
 useEffect(()=>{
  if(!client)return;const token=++serial.current;let active=true;setLoading(true);setError('');
  void(async()=>{try{const {data,error}=await client.rpc('wenxing_admin_dashboard',{p_offset:offset,p_search:search});if(error)throw error;const result=parseAdminDashboard(data);if(active&&token===serial.current)setData(result);}catch{if(active)setError('无法读取管理后台。请检查登录权限或网络后重试。');}finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[client,offset,search,revision]);
 return <section className="admin-dashboard" aria-label="管理员后台"><h3>管理员后台</h3><p>仅管理员可见。时间均为北京时间；账号明细不包含密码或用户提示词。</p>
 <form className="admin-search" onSubmit={e=>{e.preventDefault();setSearch(query.trim());setOffset(0);setRevision(n=>n+1);}}><label htmlFor="admin-search">查找注册账号</label><input id="admin-search" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} placeholder="邮箱或账号 ID"/><button type="submit" className="secondary" disabled={loading}>搜索</button><button type="button" className="secondary" disabled={loading} onClick={()=>setRevision(n=>n+1)}>刷新后台</button></form>
 {loading&&<p role="status">正在读取后台…</p>}{error&&<p role="alert">{error}</p>}
 {data&&!loading&&!error&&<><div className="admin-metrics">{[['注册账号',data.summary.registered],['已验证',data.summary.verified],['今日活跃',data.summary.today],['当前在线约',data.summary.online],['今日 AI 请求',data.summary.requests]].map(([label,n])=><div key={label}><span>{label}</span><strong>{n}</strong></div>)}</div>
 <p>在线按最近2分钟心跳估算。AI 请求数是已预留次数，包含失败或停止后上游已受理的请求，并非成功生成数。所有账号每日7次；全站每日200次。</p>
 <div className="admin-table-scroll" tabIndex={0} aria-label="账号明细，可横向滚动"><table><caption>注册账号明细（匹配 {data.total} 个）</caption><thead><tr>{['邮箱 / 账号ID','身份 / 验证','注册时间','最近登录','最近活跃','今日用量','最近云端保存'].map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{data.users.map(u=><tr key={u.id}><td>{u.email}<small>{u.id}</small></td><td>{u.admin?'管理员':'普通用户'}<small>{u.verified?'已验证':'待验证'}</small></td><td>{time(u.created_at)}</td><td>{time(u.last_sign_in_at)}</td><td>{time(u.last_seen)}</td><td>已用 {u.used} · 剩 {u.remaining}</td><td>{time(u.cloud_saved_at)}</td></tr>)}</tbody></table>{!data.users.length&&<p>未找到匹配账号。</p>}</div>
 <div className="row-actions"><button type="button" className="secondary" disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-20))}>上一页</button><span>第 {Math.floor(offset/20)+1} 页，共 {Math.max(1,Math.ceil(data.total/20))} 页</span><button type="button" className="secondary" disabled={offset+20>=data.total} onClick={()=>setOffset(n=>n+20)}>下一页</button></div>
 <details><summary>最近30天 AI 请求明细</summary><div className="admin-table-scroll"><table><thead><tr><th>日期</th><th>预留请求数</th></tr></thead><tbody>{data.days.map(d=><tr key={d.day}><td>{d.day}</td><td>{d.requests}</td></tr>)}</tbody></table></div></details></>}
 </section>;
}
