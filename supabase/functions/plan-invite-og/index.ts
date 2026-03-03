// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  // The OG image lives in the public folder of the deployed app
  const ogImageUrl = "https://helloparade.app/og-invite.png";
  const redirectUrl = `https://helloparade.app/plan-invite/${encodeURIComponent(token)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>You're Invited! - Parade</title>
<meta property="og:title" content="You're Invited! 🎉" />
<meta property="og:description" content="You've been invited to join a plan on Parade. Tap to view details and RSVP!" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${ogImageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="Parade" />
<meta property="og:url" content="${redirectUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="You're Invited! 🎉" />
<meta name="twitter:description" content="You've been invited to join a plan on Parade. Tap to view details and RSVP!" />
<meta name="twitter:image" content="${ogImageUrl}" />
<meta http-equiv="refresh" content="0;url=${redirectUrl}" />
</head>
<body>
<p>Redirecting to <a href="${redirectUrl}">Parade</a>...</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});
