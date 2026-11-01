import { env } from 'cloudflare:workers';
import { handleStudio } from '@/lib/deepseek';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handleStudio(request, env as unknown as Record<string, string | undefined>);
}
