export class WorkspaceConflictError extends Error{}
export function saveWorkspace(storage:Pick<Storage,'getItem'|'setItem'>,key:string,previous:string|null,next:string,previousState?:string|null):boolean{
  if(previousState===next)return false;
  if(storage.getItem(key)!==previous)throw new WorkspaceConflictError('另一个页面已更新或清空工作区。本页已暂停自动保存，请先下载本页备份，再刷新读取最新记录。');
  storage.setItem(key,next);
  return true;
}
