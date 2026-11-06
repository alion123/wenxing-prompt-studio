'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {createClient,type Session,type SupabaseClient} from '@supabase/supabase-js';
import {accountStorageKey} from '@/lib/account-workspace';
import {createAccountFetch} from '@/lib/account-fetch';

type Account={client:SupabaseClient|null;session:Session|null;recovery:boolean;finishRecovery:()=>void};
const Context=createContext<Account>({client:null,session:null,recovery:false,finishRecovery:()=>{}});
export const useAccount=()=>useContext(Context);

export function AccountSession({children}:{children:(storageKey:string)=>ReactNode}){
  const [account,setAccount]=useState<{client:SupabaseClient|null;session:Session|null;recovery:boolean}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true,unsubscribe=()=>{};
    const fail=()=>{if(live){setAccount(null);setError('无法确认账号状态。为保护本地工作区，请刷新重试。');}};
    void(async()=>{
      try{
        const accountFetch=createAccountFetch();
        const response=await accountFetch('/api/auth-config',{cache:'no-store'});
        if(!response.ok)throw Error();
        const body:unknown=await response.json();
        if(!body||typeof body!=='object'||!('url' in body)||!('publishableKey' in body))throw Error();
        const config=body as {url:unknown;publishableKey:unknown};
        if(!live)return;
        if(config.url===null&&config.publishableKey===null){setAccount({client:null,session:null,recovery:false});return;}
        if(typeof config.url!=='string'||typeof config.publishableKey!=='string'||!config.publishableKey)throw Error();
        const url=new URL(config.url);
        if(url.protocol!=='https:'||url.username||url.password)throw Error();
        const client=createClient(url.origin,config.publishableKey,{global:{fetch:accountFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        let events=0,initialized=false;
        let latest:{session:Session|null;recovery:boolean}|null=null;
        const {data}=client.auth.onAuthStateChange((event,session)=>{
          events++;
          latest={session,recovery:event==='PASSWORD_RECOVERY'||(!!session&&!!latest?.recovery)};
          if(live&&initialized)setAccount(previous=>({client,session,recovery:event==='PASSWORD_RECOVERY'||(!!session&&!!previous?.recovery)}));
        });
        unsubscribe=()=>{data.subscription.unsubscribe();client.auth.stopAutoRefresh();};
        const result=await client.auth.getSession();
        if(result.error)throw result.error;
        initialized=true;
        if(live)setAccount({client,...(events&&latest?latest:{session:result.data.session,recovery:false})});
      }catch{fail();}
    })();
    return()=>{live=false;unsubscribe();};
  },[]);
  if(error)return <main className="account-loading"><p role="alert">{error}</p><button className="secondary" onClick={()=>location.reload()}>刷新重试</button></main>;
  if(!account)return <main className="account-loading" role="status">正在确认工作区…</main>;
  return <Context.Provider value={{...account,finishRecovery:()=>setAccount(previous=>previous?{...previous,recovery:false}:previous)}}>{children(accountStorageKey(account.session?.user.id??null))}</Context.Provider>;
}
