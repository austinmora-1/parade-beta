import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { initialize, svg2png } from "https://esm.sh/svg2png-wasm@0.6.1";

const DISPLAY_FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/bungeeshade/BungeeShade-Regular.ttf";
const BODY_FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf";

let initialized = false;
let displayFontData: Uint8Array | null = null;
let bodyFontData: Uint8Array | null = null;

async function init() {
  if (initialized) return;
  
  const [wasmRes, displayFontRes, bodyFontRes] = await Promise.all([
    fetch("https://esm.sh/svg2png-wasm@0.6.1/svg2png_wasm_bg.wasm"),
    fetch(DISPLAY_FONT_URL),
    fetch(BODY_FONT_URL),
  ]);
  
  displayFontData = new Uint8Array(await displayFontRes.arrayBuffer());
  bodyFontData = new Uint8Array(await bodyFontRes.arrayBuffer());
  await initialize(wasmRes);
  initialized = true;
}

const ACTIVITY_EMOJI: Record<string, string> = {
  drinks: "🍹", "getting-food": "🍽️", coffee: "☕",
  events: "🎉", movies: "🎬", "other-events": "✨",
  "me-time": "🧘", reading: "📚", watching: "📺", "making-food": "👨‍🍳",
  "workout-in": "💪", "workout-out": "🏋️",
  chores: "🧹", errands: "🏃", shopping: "🛍️", doctor: "🏥",
  flight: "✈️", custom: "✨",
  // Legacy/additional mappings
  dinner: "🍽️", lunch: "🍽️", brunch: "🥂", breakfast: "☕",
  "happy-hour": "🍸", movie: "🎬", concert: "🎵", "live-music": "🎵",
  hiking: "🥾", biking: "🚴", running: "🏃", yoga: "🧘",
  gym: "💪", swimming: "🏊", climbing: "🧗", tennis: "🎾",
  golf: "⛳", basketball: "🏀", soccer: "⚽", volleyball: "🏐",
  "board-games": "🎲", gaming: "🎮", karaoke: "🎤",
  "art-class": "🎨", museum: "🏛️", theater: "🎭",
  spa: "💆", picnic: "🧺", bbq: "🔥",
  "beach-day": "🏖️", camping: "⛺", travel: "✈️",
  "road-trip": "🚗", "book-club": "📚", study: "📖",
  coworking: "💻", meetup: "🤝", party: "🎉",
  birthday: "🎂", wedding: "💒", potluck: "🥘",
  other: "✨",
};

const ACTIVITY_LABELS: Record<string, string> = {
  drinks: "Drinks", "getting-food": "Getting Food", coffee: "Coffee",
  events: "Events", movies: "Movies", "other-events": "Other Events",
  "me-time": "Me Time", reading: "Reading", watching: "Watching", "making-food": "Cooking",
  "workout-in": "Home Workout", "workout-out": "Gym/Outdoor",
  chores: "Chores", errands: "Errands", shopping: "Shopping", doctor: "Appointment",
  flight: "Flight", custom: "Custom",
  // Legacy/additional mappings
  dinner: "Dinner", lunch: "Lunch", brunch: "Brunch", breakfast: "Breakfast",
  "happy-hour": "Happy Hour", movie: "Movie", concert: "Concert", "live-music": "Live Music",
  hiking: "Hiking", biking: "Biking", running: "Running", yoga: "Yoga",
  gym: "Gym", swimming: "Swimming", climbing: "Climbing", tennis: "Tennis",
  golf: "Golf", basketball: "Basketball", soccer: "Soccer", volleyball: "Volleyball",
  "board-games": "Board Games", gaming: "Gaming", karaoke: "Karaoke",
  "art-class": "Art Class", museum: "Museum", theater: "Theater",
  spa: "Spa", picnic: "Picnic", bbq: "BBQ",
  "beach-day": "Beach Day", camping: "Camping", travel: "Travel",
  "road-trip": "Road Trip", "book-club": "Book Club", study: "Study",
  coworking: "Coworking", meetup: "Meetup", party: "Party",
  birthday: "Birthday", wedding: "Wedding", potluck: "Potluck",
  other: "Other",
};

const TIME_LABELS: Record<string, string> = {
  "early-morning": "Early Morning",
  "late-morning": "Late Morning",
  "early-afternoon": "Early Afternoon",
  "late-afternoon": "Late Afternoon",
  evening: "Evening",
  "late-night": "Late Night",
  "all-day": "All Day",
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function generateConfetti(count: number, width: number, height: number): string {
  const colors = ["#FF6B6B", "#FFB347", "#FFD700", "#55C78E", "#4ECDC4", "#A78BFA", "#F472B6", "#60A5FA", "#FBBF24", "#34D399"];
  const shapes: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const rotation = Math.random() * 360;
    const opacity = 0.5 + Math.random() * 0.5;
    const shapeType = Math.floor(Math.random() * 3);
    if (shapeType === 0) {
      const w = 6 + Math.random() * 10;
      const h = 3 + Math.random() * 6;
      shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}" transform="rotate(${rotation} ${x + w/2} ${y + h/2})" rx="1" />`);
    } else if (shapeType === 1) {
      const r = 3 + Math.random() * 5;
      shapes.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`);
    } else {
      const size = 6 + Math.random() * 8;
      shapes.push(`<polygon points="${x},${y - size} ${x - size * 0.866},${y + size * 0.5} ${x + size * 0.866},${y + size * 0.5}" fill="${color}" opacity="${opacity}" transform="rotate(${rotation} ${x} ${y})" />`);
    }
  }
  return shapes.join("\n    ");
}

Deno.serve(async (req) => {
  try {
    await init();

    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const token = url.searchParams.get("token");
    const width = 1200;
    const height = 630;

    // Route: plan-invite meta HTML (serves OG tags + redirect)
    if (type === "meta" && token) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data } = await supabase.rpc("get_plan_invite_details", { p_token: token });
      const invite = data && data.length > 0 ? data[0] : null;
      const origin = url.searchParams.get("origin") || "https://parade.lovable.app";
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

      let titleText = "You're invited to a plan on Parade";
      let description = "Join your friend's plan on Parade — the social planner for real-life hangs.";
      let ogImageUrl = `${supabaseUrl}/functions/v1/og-image`;

      if (invite) {
        const activityLabel = ACTIVITY_LABELS[invite.plan_activity] || invite.plan_activity.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        titleText = escapeXml(`${invite.invited_by_name} invited you: ${invite.plan_title}`);
        description = escapeXml(`Join for ${activityLabel} — tap to view details and RSVP on Parade.`);
        ogImageUrl = `${supabaseUrl}/functions/v1/og-image?type=plan-invite&token=${token}`;
      }

      const redirectUrl = `${origin}/plan-invite/${token}`;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${titleText}</title>
  <meta name="description" content="${description}"/>
  <meta property="og:title" content="${titleText}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${ogImageUrl}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${redirectUrl}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${titleText}"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="${ogImageUrl}"/>
  <meta http-equiv="refresh" content="0;url=${redirectUrl}"/>
</head>
<body><p>Redirecting to <a href="${redirectUrl}">Parade</a>...</p></body>
</html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Route: plan-invite OG image (PNG)
    if (type === "plan-invite" && token) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data, error } = await supabase.rpc("get_plan_invite_details", { p_token: token });
      if (error || !data || data.length === 0) {
        return new Response("Invite not found", { status: 404 });
      }

      const invite = data[0];
      const emoji = ACTIVITY_EMOJI[invite.plan_activity] || "✨";
      const title = escapeXml(invite.plan_title.length > 32 ? invite.plan_title.slice(0, 30) + "…" : invite.plan_title);
      const dateStr = invite.plan_date ? escapeXml(formatDate(String(invite.plan_date).split("T")[0])) : "";

      let timeStr = "";
      if (invite.plan_start_time) {
        timeStr = formatTime12(invite.plan_start_time);
        if (invite.plan_end_time) timeStr += ` - ${formatTime12(invite.plan_end_time)}`;
      } else if (invite.plan_time_slot && TIME_LABELS[invite.plan_time_slot]) {
        timeStr = TIME_LABELS[invite.plan_time_slot];
      }
      timeStr = escapeXml(timeStr);

      const location = invite.plan_location ? escapeXml(
        invite.plan_location.length > 40 ? invite.plan_location.slice(0, 38) + "…" : invite.plan_location
      ) : "";

      const inviterName = escapeXml(
        invite.invited_by_name.length > 24 ? invite.invited_by_name.slice(0, 22) + "…" : invite.invited_by_name
      );

      const bg = "#1A2B22", cardBg = "#24382D", cardStroke = "#3D5C4A";
      const accent = "#55C78E", accentDim = "#3D8C6C";
      const textPrimary = "#E8F5EE", textSecondary = "#9BB8A8";
      const cardX = 80, cardY = 60, cardW = 1040, cardH = 510, cardR = 24, innerPad = 48;
      const detailStartY = 310, rowHeight = 52;

      let detailRows = "";
      let ri = 0;
      detailRows += `<text x="${cardX + innerPad + 40}" y="${detailStartY + ri * rowHeight}" font-family="Inter" font-size="26" fill="${textPrimary}" dominant-baseline="central">Date:  ${dateStr}</text>`;
      ri++;
      if (timeStr) {
        detailRows += `<text x="${cardX + innerPad + 40}" y="${detailStartY + ri * rowHeight}" font-family="Inter" font-size="26" fill="${textPrimary}" dominant-baseline="central">Time:  ${timeStr}</text>`;
        ri++;
      }
      if (location) {
        detailRows += `<text x="${cardX + innerPad + 40}" y="${detailStartY + ri * rowHeight}" font-family="Inter" font-size="26" fill="${textPrimary}" dominant-baseline="central">Location:  ${location}</text>`;
        ri++;
      }

      const activityLabel = ACTIVITY_LABELS[invite.plan_activity] || invite.plan_activity.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F1A14"/><stop offset="100%" stop-color="${bg}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="#4ECDC4"/>
    </linearGradient>
    <filter id="cs" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#000" flood-opacity="0.4"/>
    </filter>
    <filter id="btnShadow" x="-10%" y="-20%" width="120%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${accent}" flood-opacity="0.35"/>
    </filter>
    <filter id="btnShadowOutline" x="-10%" y="-20%" width="120%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="1" fill="${accent}" opacity="0.06"/></pattern>
  <rect width="${width}" height="${height}" fill="url(#dots)"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardR}" fill="${cardBg}" stroke="${cardStroke}" stroke-width="1.5" filter="url(#cs)"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="6" fill="url(#accentGrad)"/>
  <text x="${cardX + innerPad}" y="${cardY + 78}" font-family="Inter" font-weight="700" font-size="38" fill="${textPrimary}" dominant-baseline="central">${title}</text>
  <rect x="${cardX + innerPad}" y="${cardY + 120}" width="200" height="36" rx="18" fill="${accent}" opacity="0.15"/>
  <text x="${cardX + innerPad + 100}" y="${cardY + 138}" font-family="Inter" font-weight="600" font-size="16" fill="${accent}" text-anchor="middle" dominant-baseline="central">You're invited!</text>
  <text x="${cardX + innerPad + 220}" y="${cardY + 138}" font-family="Inter" font-size="18" fill="${textSecondary}" dominant-baseline="central">from ${inviterName}</text>
  <rect x="${cardX + innerPad}" y="${cardY + 180}" width="auto" height="30" rx="15" fill="${accent}" opacity="0.1"/>
  <text x="${cardX + innerPad + 16}" y="${cardY + 195}" font-family="Inter" font-weight="600" font-size="20" fill="${accent}" dominant-baseline="central">${escapeXml(activityLabel)}</text>
  <line x1="${cardX + innerPad}" y1="${detailStartY - 40}" x2="${cardX + cardW - innerPad}" y2="${detailStartY - 40}" stroke="${cardStroke}" stroke-width="1" stroke-dasharray="6,4"/>
  ${detailRows}
  <rect x="${cardX + innerPad}" y="${cardY + cardH - 86}" width="220" height="52" rx="26" fill="url(#accentGrad)" filter="url(#btnShadow)"/>
  <text x="${cardX + innerPad + 110}" y="${cardY + cardH - 60}" font-family="Inter" font-weight="700" font-size="19" fill="#0F1A14" text-anchor="middle" dominant-baseline="central">Accept</text>
  <rect x="${cardX + innerPad + 240}" y="${cardY + cardH - 86}" width="220" height="52" rx="26" fill="none" stroke="${textSecondary}" stroke-width="2" filter="url(#btnShadowOutline)"/>
  <text x="${cardX + innerPad + 350}" y="${cardY + cardH - 60}" font-family="Inter" font-weight="700" font-size="19" fill="${textSecondary}" text-anchor="middle" dominant-baseline="central">Decline</text>
  <text x="${width / 2}" y="${height - 36}" font-family="Bungee Shade" font-size="28" fill="${accentDim}" text-anchor="middle" dominant-baseline="central" letter-spacing="3">parade</text>
</svg>`;

      const allFonts = [displayFontData!, bodyFontData!];
      const png = await svg2png(svg, { width, height, fonts: allFonts });
      return new Response(png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Default: branded Parade OG image
    const bgColor = "#24382D";
    const textColor = "#55C78E";
    const confetti = generateConfetti(80, width, height);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bgColor}" />
  <g>${confetti}</g>
  <text x="${width / 2}" y="${height / 2}" dominant-baseline="central" text-anchor="middle"
    font-family="Bungee Shade" font-size="120" letter-spacing="6" fill="${textColor}">parade</text>
</svg>`;

    const png = await svg2png(svg, { width, height, fonts: [displayFontData!] });
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
