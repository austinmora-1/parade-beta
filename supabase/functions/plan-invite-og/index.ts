const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APP_URL = "https://helloparade.app";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const mode = url.searchParams.get("mode");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planInviteUrl = `${APP_URL}/plan-invite/${token}`;
    const ogImageUrl = `${SUPABASE_URL}/functions/v1/og-image?type=invite-card&v=6`;

    // Build the HTML page with OG meta tags that auto-redirects to the app
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>You're Invited! - Parade</title>
<meta property="og:title" content="You're Invited! - Parade" />
<meta property="og:description" content="You've been invited to join a plan on Parade. Tap to view details and RSVP!" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="Parade" />
<meta property="og:url" content="${escapeHtml(planInviteUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="You're Invited! - Parade" />
<meta name="twitter:description" content="You've been invited to join a plan on Parade. Tap to view details and RSVP!" />
<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
<meta http-equiv="refresh" content="0;url=${escapeHtml(planInviteUrl)}" />
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0F1A14;color:#55C78E;}a{color:#55C78E;}</style>
</head>
<body><p>Redirecting to <a href="${escapeHtml(planInviteUrl)}">Parade</a>...</p></body>
</html>`;

    if (mode === "generate") {
      // Return the edge function URL itself as the shareable link
      // When iMessage/crawlers hit this URL, they'll get the HTML above with OG tags
      const shareableUrl = `${SUPABASE_URL}/functions/v1/plan-invite-og?token=${encodeURIComponent(token)}`;
      return new Response(JSON.stringify({ url: shareableUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Direct hit from a crawler or user — serve the HTML with OG tags
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("plan-invite-og error:", error);
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    return new Response(`<html><head><meta http-equiv="refresh" content="0;url=${APP_URL}/plan-invite/${token}" /></head><body>Redirecting...</body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
