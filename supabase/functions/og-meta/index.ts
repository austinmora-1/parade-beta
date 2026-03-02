import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIVITY_LABELS: Record<string, string> = {
  drinks: "Drinks", "getting-food": "Getting Food", coffee: "Coffee",
  events: "Events", movies: "Movies", "other-events": "Other Events",
  "me-time": "Me Time", reading: "Reading", watching: "Watching", "making-food": "Cooking",
  "workout-in": "Home Workout", "workout-out": "Gym/Outdoor",
  chores: "Chores", errands: "Errands", shopping: "Shopping", doctor: "Appointment",
  flight: "Flight", custom: "Custom",
  dinner: "Dinner", lunch: "Lunch", brunch: "Brunch", breakfast: "Breakfast",
  "happy-hour": "Happy Hour", movie: "Movie", concert: "Concert",
  hiking: "Hiking", yoga: "Yoga", gym: "Gym",
  bbq: "BBQ", picnic: "Picnic", party: "Party", birthday: "Birthday",
  other: "Other",
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const origin = url.searchParams.get("origin") || "https://parade.lovable.app";

    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data } = await supabase.rpc("get_plan_invite_details", { p_token: token });
    const invite = data && data.length > 0 ? data[0] : null;

    let titleText = "You're invited to a plan on Parade 🎉";
    let description = "Join your friend's plan on Parade — the social planner for real-life hangs.";
    const ogImageUrl = `${supabaseUrl}/functions/v1/og-image?type=plan-invite&token=${token}`;

    if (invite) {
      const activityLabel = ACTIVITY_LABELS[invite.plan_activity] || invite.plan_activity.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      titleText = `${invite.invited_by_name} invited you: ${invite.plan_title}`;
      description = `Join for ${activityLabel} — tap to view details and RSVP on Parade.`;
    }

    const redirectUrl = `${origin}/plan-invite/${token}`;

    // Build HTML with proper escaping
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeXml(titleText)}</title>
<meta name="description" content="${escapeXml(description)}"/>
<meta property="og:title" content="${escapeXml(titleText)}"/>
<meta property="og:description" content="${escapeXml(description)}"/>
<meta property="og:image" content="${ogImageUrl}"/>
<meta property="og:image:type" content="image/png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${redirectUrl}"/>
<meta property="og:site_name" content="Parade"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeXml(titleText)}"/>
<meta name="twitter:description" content="${escapeXml(description)}"/>
<meta name="twitter:image" content="${ogImageUrl}"/>
<meta http-equiv="refresh" content="0;url=${redirectUrl}"/>
</head>
<body><p>Redirecting to <a href="${redirectUrl}">Parade</a>...</p></body>
</html>`;

    // Upload HTML as a Blob with explicit content type
    const filePath = `${token}.html`;

    // Use the Supabase client upload with Blob to ensure proper binary handling
    const htmlBlob = new Blob([html], { type: "text/html; charset=utf-8" });
    
    const { error: uploadError } = await supabase.storage
      .from("og-pages")
      .upload(filePath, htmlBlob, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
        cacheControl: "public, max-age=3600",
      });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      return new Response(JSON.stringify({ error: "Upload failed", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/og-pages/${filePath}`;

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
