export function accountStorageKey(userId:string|null):string{return userId?`wenxu.studio.v1.account.${userId}`:'wenxu.studio.v1';}
export class CloudRevision {
  private value:number|null=null;
  observe(value:number){if(!Number.isSafeInteger(value)||value<0)throw Error('云端版本无效，请稍后重试。');this.value=value;}
  expected():number{if(this.value===null)throw Error('请先检查云端版本，再保存。');return this.value;}
  saved(value:number){this.observe(value);}
}
