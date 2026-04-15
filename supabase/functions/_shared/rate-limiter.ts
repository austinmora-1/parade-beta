import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

export async function checkRateLimit(
  admin: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await admin
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart);

  const currentCount = count ?? 0;

  if (currentCount >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: windowSeconds };
  }

  // Log this request (fire-and-forget for performance)
  admin.from('rate_limit_log').insert({ user_id: userId, action }).then(() => {});

  return { allowed: true, remaining: maxRequests - currentCount - 1 };
}

export function rateLimitResponse(retryAfter: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    retryAfter,
  }), {
    status: 429,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
  });
}
