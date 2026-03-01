import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ACTIVITY_LABELS: Record<string, string> = {
  dinner: "Dinner", lunch: "Lunch", brunch: "Brunch", breakfast: "Breakfast",
  coffee: "Coffee", drinks: "Drinks", "happy-hour": "Happy Hour",
  movie: "Movie", concert: "Concert", "live-music": "Live Music",
  hiking: "Hiking", biking: "Biking", running: "Running", yoga: "Yoga",
  gym: "Gym", swimming: "Swimming", climbing: "Climbing", tennis: "Tennis",
  golf: "Golf", basketball: "Basketball", soccer: "Soccer", volleyball: "Volleyball",
  "board-games": "Board Games", gaming: "Gaming", karaoke: "Karaoke",
  "art-class": "Art Class", museum: "Museum", theater: "Theater",
  shopping: "Shopping", spa: "Spa", picnic: "Picnic", bbq: "BBQ",
  "beach-day": "Beach Day", camping: "Camping", travel: "Travel",
  "road-trip": "Road Trip", "book-club": "Book Club", study: "Study",
  coworking: "Coworking", meetup: "Meetup", party: "Party",
  birthday: "Birthday", wedding: "Wedding", potluck: "Potluck",
  other: "Activity",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const origin = url.searchParams.get("origin") || "https://parade.lovable.app";

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("get_plan_invite_details", { p_token: token });

  let title = "You're invited to a plan on Parade";
  let description = "Join your friend's plan on Parade — the social planner for real-life hangs.";
  let ogImageUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/og-image`;

  if (!error && data && data.length > 0) {
    const invite = data[0];
    const activityLabel = ACTIVITY_LABELS[invite.plan_activity] || "Activity";
    title = escapeHtml(`${invite.invited_by_name} invited you: ${invite.plan_title}`);
    description = escapeHtml(`Join for ${activityLabel} — tap to view details and RSVP on Parade.`);
    ogImageUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/plan-invite-og?token=${token}`;
  }

  const redirectUrl = `${origin}/plan-invite/${token}`;

  // Serve HTML with OG tags, then redirect JS-capable browsers to the SPA
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${ogImageUrl}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${redirectUrl}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="${ogImageUrl}"/>
  <meta http-equiv="refresh" content="0;url=${redirectUrl}"/>
</head>
<body>
  <p>Redirecting to <a href="${redirectUrl}">Parade</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
