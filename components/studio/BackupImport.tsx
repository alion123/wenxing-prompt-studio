'use client';
import {useState} from 'react';
import {readBackup,type Workspace} from '@/lib/backup';

export function BackupImport({disabled,onImport}:{disabled:boolean;onImport:(backup:Workspace)=>Promise<void>}){
  const [backup,setBackup]=useState<Workspace|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  return <section className="backup-import"><h3>导入工作区备份</h3><p>支持问形及旧版问序导出的JSON，最多10MB。确认后合并项目，已有项目不会被覆盖。</p>
    <label className="input-label" htmlFor="backup-file">选择备份文件</label><input id="backup-file" type="file" accept=".json,application/json" disabled={disabled||loading} onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return;
      setBackup(null);setError('');setLoading(true);
      try{if(file.size>10*1024*1024)throw Error('备份超过10MB，请选择较小的文件。');setBackup(readBackup(await file.text()));}
      catch(err){setError(err instanceof Error?err.message:'读取备份失败，现有项目未改变。');}finally{setLoading(false);}
    }}/>
    {error&&<p role="alert" className="insight-error">{error}</p>}
    {backup&&<div className="import-preview"><strong>备份中有 {backup.projects.length} 个项目</strong><ul>{backup.projects.slice(0,8).map(p=><li key={p.id}>{p.goal||'未命名项目'} · {p.versions.length} 个版本</li>)}</ul>{backup.projects.length>8&&<p>另有 {backup.projects.length-8} 个项目。</p>}<p>完全相同的记录会跳过；编号相同但内容不同的项目保留为独立副本。</p><div className="row-actions"><button className="primary" disabled={disabled||loading} onClick={async()=>{setLoading(true);setError('');try{await onImport(backup);setBackup(null);}catch(err){setError(err instanceof Error?err.message:'导入失败，现有记录未覆盖。');}finally{setLoading(false);}}}>{loading?'正在导入…':'确认合并导入'}</button><button className="text-button" disabled={loading} onClick={()=>setBackup(null)}>取消导入</button></div></div>}
    {disabled&&<p>正在处理请求或自动保存已暂停。请先完成处理，或下载本页备份后刷新，再导入。</p>}
  </section>;
}
