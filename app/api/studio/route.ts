import { env } from 'cloudflare:workers';
import { handleStudio } from '@/lib/deepseek';
import { checkStudioAccess } from '@/lib/studio-access';
import { withQuotaHeaders } from '@/lib/quota';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const settings = env as unknown as Record<string, string | undefined>;
  const quotaHeaders = new Headers();
  const denied = await checkStudioAccess(request, {
    SUPABASE_URL: settings.SUPABASE_URL ?? process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: settings.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
  },fetch,quotaHeaders);
  return withQuotaHeaders(denied ?? await handleStudio(request, settings),quotaHeaders);
}
