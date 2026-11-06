export function createAccountFetch(fetcher:typeof fetch=fetch,timeoutMs=15000):typeof fetch{
  return async(input,options)=>{
    const deadline=new AbortController();
    const timer=setTimeout(()=>deadline.abort(new DOMException('Account request timed out','TimeoutError')),timeoutMs);
    const original=options?.signal??(input instanceof Request?input.signal:undefined);
    const signal=original?AbortSignal.any([original,deadline.signal]):deadline.signal;
    try{
      const response=await fetcher(input,{...options,signal});
      const bytes=await response.arrayBuffer();
      return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
    }catch(error){
      if(deadline.signal.aborted){
        const url=input instanceof Request?input.url:String(input);
        // Refresh failures must stay retryable so the SDK preserves an existing session.
        return Response.json({code:'request_timeout',error_code:'request_timeout',msg:'Account request timed out'},{status:url.includes('grant_type=refresh_token')?503:408});
      }
      throw error;
    }finally{clearTimeout(timer);}
  };
}
