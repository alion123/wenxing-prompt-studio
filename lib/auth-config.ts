export function publicAuthConfig(env:{SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string}):{url:string|null;publishableKey:string|null}{
 const url=env.SUPABASE_URL?.trim(),key=env.SUPABASE_PUBLISHABLE_KEY?.trim(),none={url:null,publishableKey:null};
 if(!url||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))return none;
 let isPublic=/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
 if(!isPublic)try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));isPublic=key.split('.').length===3&&payload.role==='anon';}catch{}
 return isPublic?{url:url.replace(/\/$/,''),publishableKey:key}:none;
}
