const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const APP_URL = "https://parade.lovable.app";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    const ogImageUrl = `${SUPABASE_URL}/functions/v1/og-image?type=invite-card&v=2`;
    const planInviteUrl = `${APP_URL}/plan-invite/${token}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to a plan on Parade</title>
  <meta name="description" content="Join your friend's plan on Parade — the social planner for real-life hangs. Tap to view details and RSVP!" />

  <meta property="og:title" content="You're invited to a plan on Parade 🎉" />
  <meta property="og:description" content="Join your friend's plan on Parade — the social planner for real-life hangs. Tap to view details and RSVP!" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="Parade" />
  <meta property="og:url" content="${planInviteUrl}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@ParadeApp" />
  <meta name="twitter:title" content="You're invited to a plan on Parade 🎉" />
  <meta name="twitter:description" content="Join your friend's plan on Parade — the social planner for real-life hangs." />
  <meta name="twitter:image" content="${ogImageUrl}" />

  <meta http-equiv="refresh" content="0;url=${planInviteUrl}" />
  <script>window.location.replace("${planInviteUrl}");</script>
</head>
<body>
  <p>Redirecting to <a href="${planInviteUrl}">your plan invite</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
});
