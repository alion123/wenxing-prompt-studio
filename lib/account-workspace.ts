import type {Workspace} from './backup.ts';
export function canAutoRestoreWorkspace(workspace:Workspace):boolean{
  const p=workspace.projects[0];
  return workspace.projects.length===1&&!workspace.library?.length&&p.type==='code'&&p.mode==='beginner'&&p.stage==='setup'&&!p.goal.trim()&&!p.versions.length&&!p.questions.length&&!p.references?.length&&!p.draft;
}
export function accountStorageKey(userId:string|null):string{return userId?`wenxu.studio.v1.account.${userId}`:'wenxu.studio.v1';}
export class CloudRevision {
  private value: number | null = null;

  inspect(value: number): boolean {
    this.validate(value);
    if (value === 0) this.value = 0;
    else if (value !== this.value) this.invalidate();
    return this.value !== null;
  }

  invalidate() {
    this.value = null;
  }

  expected(): number {
    if (this.value === null) throw Error('请先检查云端并合并已有项目，再保存。');
    return this.value;
  }

  merged(value: number) {
    this.validate(value);
    this.value = value;
  }

  saved(value: number) {
    this.merged(value);
  }

  private validate(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) throw Error('云端版本无效，请稍后重试。');
  }
}
