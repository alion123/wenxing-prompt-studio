import {publicAuthConfig} from '@/lib/auth-config';
export function GET(){return Response.json(publicAuthConfig({SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY}),{headers:{'Cache-Control':'no-store'}});}
