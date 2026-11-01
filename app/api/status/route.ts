import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
export async function GET() {
  const runtime = env as unknown as Record<string, string | undefined>;
  return Response.json({ configured: Boolean(runtime.DEEPSEEK_API_KEY?.trim()) }, { headers: { 'Cache-Control': 'no-store' } });
}
