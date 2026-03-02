const APP_URL = "https://helloparade.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    const planInviteUrl = `${APP_URL}/plan-invite/${token}`;
    const ogImageUrl = `${SUPABASE_URL}/functions/v1/og-image?type=invite-card`;

    const ogTitle = "You&#39;re Invited! — Parade";
    const ogDescription = "You&#39;ve been invited to join a plan on Parade — tap to view details and RSVP!";

    // User-agent detection: crawlers get HTML with OG tags, browsers get redirected
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    const isCrawler = /bot|crawl|spider|facebook|whatsapp|telegram|slack|discord|twitter|linkedin|preview|fetch|curl|wget/i.test(ua);

    if (!isCrawler) {
      return Response.redirect(planInviteUrl, 302);
    }

    // Crawlers: serve HTML with OG meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${ogTitle}</title>
<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${ogDescription}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="Parade" />
<meta property="og:url" content="${escapeHtml(planInviteUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${ogTitle}" />
<meta name="twitter:description" content="${ogDescription}" />
<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
<meta http-equiv="refresh" content="0;url=${escapeHtml(planInviteUrl)}" />
</head>
<body><p>Redirecting...</p></body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    return Response.redirect(`${APP_URL}/plan-invite/${token}`, 302);
  }
});
