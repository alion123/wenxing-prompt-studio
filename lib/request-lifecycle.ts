export function createRequestLifecycle(){
  let active:AbortController|null=null;
  return {
    begin(){active?.abort();active=new AbortController();return active;},
    isCurrent(token:AbortController){return active===token&&!token.signal.aborted;},
    finish(token:AbortController){if(active!==token)return false;active=null;return true;},
    cancel(){active?.abort();active=null;},
  };
}
