import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://helloparade.app";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const mode = url.searchParams.get("mode"); // "generate" = return URL as JSON

    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const planInviteUrl = `${APP_URL}/plan-invite/${token}`;
    const ogImageUrl = `${SUPABASE_URL}/functions/v1/og-image?type=invite-card`;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>You're Invited! — Parade</title>
<meta property="og:title" content="You're Invited! — Parade" />
<meta property="og:description" content="You've been invited to join a plan on Parade — tap to view details and RSVP!" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="Parade" />
<meta property="og:url" content="${escapeHtml(planInviteUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="You're Invited! — Parade" />
<meta name="twitter:description" content="You've been invited to join a plan on Parade — tap to view details and RSVP!" />
<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
<meta http-equiv="refresh" content="0;url=${escapeHtml(planInviteUrl)}" />
</head>
<body><p>Redirecting to Parade...</p></body>
</html>`;

    // Upload to public storage bucket with correct Content-Type
    const filePath = `invite-${token}.html`;
    const { error: uploadError } = await supabase.storage
      .from("og-pages")
      .upload(filePath, html, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      if (mode === "generate") {
        return new Response(JSON.stringify({ url: planInviteUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return Response.redirect(planInviteUrl, 302);
    }

    const { data: publicUrlData } = supabase.storage
      .from("og-pages")
      .getPublicUrl(filePath);

    const shareableUrl = publicUrlData.publicUrl;

    if (mode === "generate") {
      // Called from the app: return the shareable URL as JSON
      return new Response(JSON.stringify({ url: shareableUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Direct hit (shouldn't happen often): redirect to the storage HTML
    return Response.redirect(shareableUrl, 302);
  } catch (error) {
    console.error("Error:", error);
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    const planInviteUrl = `${APP_URL}/plan-invite/${token}`;
    return Response.redirect(planInviteUrl, 302);
  }
});
