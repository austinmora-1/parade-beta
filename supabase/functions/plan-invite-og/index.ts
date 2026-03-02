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

    // Redirect immediately - OG tags are handled by the app's index.html
    return Response.redirect(planInviteUrl, 302);
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
});
