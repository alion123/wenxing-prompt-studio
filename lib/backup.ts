import type {Project} from './studio.ts';
import {parseWorkspace} from './persistence.ts';
import {mergeLibrary,type PromptEntry} from './favorites.ts';
export type Workspace={projects:Project[];active:string;library?:PromptEntry[]};
export function readBackup(raw:string):Workspace{
  if(new TextEncoder().encode(raw).length>10*1024*1024)throw Error('备份超过10MB，请使用较小的备份文件。');
  let workspace:Workspace|null;
  try{workspace=parseWorkspace(raw);}catch{throw Error('不是有效的工作区备份。请选择问形或旧版问序导出的JSON备份文件。');}
  if(!workspace?.projects.length||workspace.projects.length>200)throw Error('备份需要包含1至200个项目。');
  const unique=(ids:string[])=>ids.every(id=>!!id.trim())&&new Set(ids).size===ids.length;
  if(!unique(workspace.projects.map(p=>p.id)))throw Error('备份中的项目编号重复或为空。');
  for(const p of workspace.projects){
    if(!unique(p.versions.map(v=>v.id))||!unique(p.requirements.map(r=>r.id))||!unique(p.rounds.map(r=>r.id))||!unique(p.questions.map(q=>q.id))||(['preview','refine'].includes(p.stage)&&!p.versions.length))throw Error('备份中的项目记录不完整或存在重复编号，未导入任何内容。');
    const versionIds=new Map(p.versions.map((v,i)=>[v.id,i])),roundIds=new Set(p.rounds.map(r=>r.id));
    const invalid=p.rounds.some(r=>!versionIds.has(r.versionId)||!unique(r.answers.map(a=>a.questionId)))||p.versions.some((v,i)=>
      (v.requirementsSnapshot&&!unique(v.requirementsSnapshot.map(r=>r.id)))||
      (v.roundId&&!roundIds.has(v.roundId))||(v.roundIds&&(!unique(v.roundIds)||v.roundIds.some(id=>!roundIds.has(id))))||
      [v.parentVersionId,v.sourceVersionId].some(id=>id!==undefined&&(!versionIds.has(id)||versionIds.get(id)!>=i)));
    if(invalid)throw Error('备份的历史版本或问答引用损坏，未导入任何内容。');
  }
  return workspace;
}
export function mergeBackup(current:Workspace,backup:Workspace){
  const existing=new Map(current.projects.map(p=>[p.id,p]));
  const normalize=(project:Project)=>parseWorkspace(JSON.stringify({projects:[project],active:project.id}))!.projects[0];
  const fingerprint=(project:Project)=>JSON.stringify(normalize({...project,id:''}));
  const fingerprints=new Map(current.projects.map(p=>[fingerprint(p),p.id]));
  const importedIds=new Map<string,string>();
  const added:Project[]=[];let skipped=0,active=current.active;
  for(const original of backup.projects){
    const p=structuredClone(original),prior=existing.get(p.id);
    // Compare validated shapes so property ordering or legacy defaults do not create false copies.
    if(prior&&fingerprints.has(fingerprint(p))){importedIds.set(original.id,fingerprints.get(fingerprint(p))!);skipped++;continue;}
    if(existing.has(p.id)){do{p.id=crypto.randomUUID();}while(existing.has(p.id));}
    existing.set(p.id,p);fingerprints.set(fingerprint(p),p.id);importedIds.set(original.id,p.id);added.push(p);
    if(original.id===backup.active)active=p.id;
  }
  if(added.length&&!added.some(p=>p.id===active)&&!current.projects.some(p=>p.id===active))active=added[0].id;
  const incomingLibrary=backup.library?.map(entry=>({...entry,usedIn:[...new Set(entry.usedIn.map(id=>importedIds.get(id)??id))]}));
  const library=current.library||incomingLibrary?mergeLibrary(current.library??[],incomingLibrary??[]):undefined;
  return {projects:[...added,...current.projects],active,...(library?{library}:{}),added:added.length,skipped};
}
