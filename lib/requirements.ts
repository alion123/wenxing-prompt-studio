import type {Project,Requirement,Generation,StudioContext,RequirementUpdate,Kind} from './studio.ts';
const normalize=(s:string)=>s.normalize('NFKC').replace(/[\s，。；、,.!！:：;]+/g,'').toLowerCase();
export const MAX_REQUIREMENTS=80;
export function preserveRequirementSnapshot(project:Project):Requirement[]{
  const ids=new Set(project.requirements.map(r=>r.id));
  return structuredClone([...project.requirements,...(project.versions.at(-1)?.requirementsSnapshot??[]).filter(r=>!ids.has(r.id))]);
}
export function isSupersededRequirement(r:Requirement,requirements:Requirement[]):boolean{
  return !!r.supersededBy||(r.sourceDetail.startsWith('你接受了替换要求：')&&requirements.some(next=>next.replacesId===r.id&&next.status==='confirmed'));
}
export function pendingRequirementChanges(project:Project){return project.requirements.filter(r=>r.status==='proposed'&&r.replacesId);}
function checkedText(text:string){const t=text.trim();if(!t||t.length>1500)throw Error('要求请填写1至1500个字符。');return t;}
export function addRequirement(project:Project,text:string,scope:Requirement['scope']='project',detail='你手动添加的要求'):Project {
  const value=checkedText(text), existing=(project.requirements??[]).find(r=>normalize(r.text)===normalize(value));
  if(existing)return changeRequirement(project,existing.id,{status:'confirmed'});
  if((project.requirements??[]).length>=MAX_REQUIREMENTS)throw Error('需求账本已达到80条，请先移除不再需要的记录后继续。历史版本会保留原有记录。');
  const now=new Date().toISOString();
  return {...project,updatedAt:now,requirements:[...(project.requirements??[]),{id:crypto.randomUUID(),text:value,status:'confirmed',source:'user',sourceDetail:detail,scope,kind:'requirement',createdAt:now,updatedAt:now}]};
}
export function changeRequirement(project:Project,id:string,patch:{text?:string;status?:Requirement['status'];scope?:Requirement['scope']}):Project {
  const text=patch.text===undefined?undefined:checkedText(patch.text),now=new Date().toISOString();
  const selected=project.requirements.find(r=>r.id===id),accepting=selected?.replacesId&&(patch.status==='confirmed'||(text!==undefined&&patch.status!=='rejected'));
  return {...project,updatedAt:now,requirements:(project.requirements??[]).map(r=>{
    if(r.id===id){
      const active={...r};delete active.supersededBy;
      return {...(patch.status!==undefined||text!==undefined?active:r),...patch,...(patch.status==='rejected'?{sourceDetail:`你拒绝了此项。此前来源：${r.sourceDetail}`}:{ }),...(text===undefined?{}:{text,status:patch.status??'confirmed',source:'user' as const,sourceDetail:'你手动修改的要求',previousText:r.text}),updatedAt:now};
    }
    return accepting&&r.id===selected.replacesId?{...r,status:'rejected',supersededBy:selected.id,updatedAt:now,sourceDetail:`你接受了替换要求：${text??selected.text}。此前来源：${r.sourceDetail}`}:r;
  })};
}
export function removeRequirement(project:Project,id:string):Project{
  if(pendingRequirementChanges(project).some(r=>r.replacesId===id))throw Error('这条要求还有待核对的替换建议，请先接受或拒绝该建议。');
  // Older workspaces inferred retirement through the accepted replacement. Preserve that link before removing it.
  const marked={...project,requirements:project.requirements.map(r=>{
    const replacement=!r.supersededBy&&isSupersededRequirement(r,project.requirements)?project.requirements.find(next=>next.replacesId===r.id&&next.status==='confirmed'):undefined;
    return replacement?{...r,supersededBy:replacement.id}:r;
  })};
  return {...marked,updatedAt:new Date().toISOString(),requirements:marked.requirements.filter(r=>r.id!==id),versions:marked.versions.map((v,i)=>i===marked.versions.length-1?{...v,requirementsSnapshot:preserveRequirementSnapshot(marked)}:v)};
}
export function mergeSuggestions(existing:Requirement[],result:Generation,roundId:string|undefined,type:Kind,source:'model'|'legacy'='model'):Requirement[] {
  const list=structuredClone(existing),now=new Date().toISOString();
  for(const [kind,texts] of [['requirement',result.constraints],['assumption',result.assumptions]] as const){
    for(const text of texts){
      if(!text.trim()||list.some(r=>normalize(r.text)===normalize(text))||list.length>=MAX_REQUIREMENTS)continue;
      const scope=(type==='image'||type==='video')&&/角色|男子|女子|发型|服装|兵器|持物/.test(text)?'character':/镜头|运镜|景别|机位/.test(text)?'shot':'project';
      list.push({id:crypto.randomUUID(),text,status:'proposed',source,scope,kind,createdAt:now,updatedAt:now,sourceRoundId:roundId,sourceDetail:source==='legacy'?'历史版本中的条目，未记录确认过程':kind==='assumption'?'问形补定的假设，待你确认':'问形整理的建议，待你确认'});
    }
  }
  return list;
}
export function validateRequirementUpdates(raw:unknown,context:StudioContext):RequirementUpdate[] {
  if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>20)throw Error('要求更新格式无效。');
  const seen=new Set<string>();
  return raw.map(item=>{
    if(!item||typeof item.id!=='string'||!context.confirmedRequirements?.some(r=>r.id===item.id)||seen.has(item.id)||typeof item.quote!=='string'||item.quote.trim().length<4||item.quote.length>1500||!['feedback','omissions','answer'].includes(item.source))throw Error('要求更新缺少可核对的用户依据。');
    const input=item.source==='answer'&&typeof item.questionId==='string'&&Object.hasOwn(context.answers,item.questionId)?context.answers[item.questionId]:item.source==='feedback'?context.feedback:item.source==='omissions'?context.omissions:'';
    if(typeof input!=='string'||!input.includes(item.quote))throw Error('要求更新引用了不存在的用户原话。');
    seen.add(item.id);return {id:item.id,quote:item.quote,source:item.source,...(item.source==='answer'?{questionId:item.questionId}:{})};
  });
}
