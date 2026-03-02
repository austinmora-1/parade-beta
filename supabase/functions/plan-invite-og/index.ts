import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://helloparade.app";

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

    // Fetch plan details using the RPC
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: details } = await supabase.rpc("get_plan_invite_details", { p_token: token });

    const plan = details && (details as any[]).length > 0 ? (details as any[])[0] : null;

    // Build dynamic OG image URL with plan details
    const ogParams = new URLSearchParams({ type: "plan-invite" });
    if (plan) {
      ogParams.set("title", plan.plan_title || "A Plan");
      ogParams.set("activity", plan.plan_activity || "other");
      ogParams.set("inviter", plan.invited_by_name || "A friend");
      if (plan.plan_date) {
        ogParams.set("date", plan.plan_date.split("T")[0]);
      }
      if (plan.plan_time_slot) {
        ogParams.set("time", plan.plan_time_slot);
      }
      if (plan.plan_location) {
        ogParams.set("location", plan.plan_location);
      }
    }
    const ogImageUrl = `${SUPABASE_URL}/functions/v1/og-image?${ogParams.toString()}`;

    const ogTitle = plan
      ? escapeHtml(`${plan.invited_by_name || "A friend"} invited you to "${plan.plan_title}"`)
      : "You&#39;re invited to a plan on Parade";

    const ogDescription = plan
      ? escapeHtml(`Join "${plan.plan_title}" on Parade — tap to view details and RSVP!`)
      : "Join your friend&#39;s plan on Parade — the social planner for real-life hangs.";

    // User-agent detection: crawlers get HTML with OG tags, browsers get redirected
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    const isCrawler = /bot|crawl|spider|facebook|whatsapp|telegram|slack|discord|twitter|linkedin|preview|fetch|curl|wget/i.test(ua);

    if (!isCrawler) {
      // Regular users: immediate redirect
      return Response.redirect(planInviteUrl, 302);
    }

    // Crawlers: serve HTML with OG meta tags
    // Note: Supabase gateway forces text/plain, but most crawlers still parse meta tags
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
    // Fallback: redirect anyway
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    return Response.redirect(`${APP_URL}/plan-invite/${token}`, 302);
  }
});
