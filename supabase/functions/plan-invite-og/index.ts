import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { initialize, svg2png } from "https://esm.sh/svg2png-wasm@0.6.1";

const FONT_URL_DISPLAY = "https://raw.githubusercontent.com/google/fonts/main/ofl/bungeeshade/BungeeShade-Regular.ttf";
const FONT_URL_BODY = "https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf";

let initialized = false;
let fontDisplay: Uint8Array | null = null;
let fontBody: Uint8Array | null = null;

async function init() {
  if (initialized) return;
  const [wasmRes, f1, f2] = await Promise.all([
    fetch("https://esm.sh/svg2png-wasm@0.6.1/svg2png_wasm_bg.wasm"),
    fetch(FONT_URL_DISPLAY),
    fetch(FONT_URL_BODY),
  ]);
  fontDisplay = new Uint8Array(await f1.arrayBuffer());
  fontBody = new Uint8Array(await f2.arrayBuffer());
  await initialize(wasmRes);
  initialized = true;
}

// Activity emoji map
const ACTIVITY_EMOJI: Record<string, string> = {
  dinner: "🍽️", lunch: "🍽️", brunch: "🥂", breakfast: "☕",
  coffee: "☕", drinks: "🍻", "happy-hour": "🍸",
  movie: "🎬", concert: "🎵", "live-music": "🎵",
  hiking: "🥾", biking: "🚴", running: "🏃", yoga: "🧘",
  gym: "💪", swimming: "🏊", climbing: "🧗", tennis: "🎾",
  golf: "⛳", basketball: "🏀", soccer: "⚽", volleyball: "🏐",
  "board-games": "🎲", gaming: "🎮", karaoke: "🎤",
  "art-class": "🎨", museum: "🏛️", theater: "🎭",
  shopping: "🛍️", spa: "💆", picnic: "🧺", bbq: "🔥",
  "beach-day": "🏖️", camping: "⛺", travel: "✈️",
  "road-trip": "🚗", "book-club": "📚", study: "📖",
  coworking: "💻", meetup: "🤝", party: "🎉",
  birthday: "🎂", wedding: "💒", potluck: "🥘",
  other: "✨",
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

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    await init();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("get_plan_invite_details", { p_token: token });
    if (error || !data || data.length === 0) {
      return new Response("Invite not found", { status: 404 });
    }

    const invite = data[0];
    const width = 1200;
    const height = 630;

    const emoji = ACTIVITY_EMOJI[invite.plan_activity] || "✨";
    const title = escapeXml(invite.plan_title.length > 32 ? invite.plan_title.slice(0, 30) + "…" : invite.plan_title);
    const dateStr = escapeXml(formatDate(invite.plan_date));

    let timeStr = "";
    if (invite.plan_start_time) {
      timeStr = formatTime12(invite.plan_start_time);
      if (invite.plan_end_time) timeStr += ` – ${formatTime12(invite.plan_end_time)}`;
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

    // Colors
    const bg = "#1A2B22";          // dark forest
    const cardBg = "#24382D";      // card surface
    const cardStroke = "#3D5C4A";  // subtle border
    const accent = "#55C78E";      // brand green
    const accentDim = "#3D8C6C";   // darker green
    const textPrimary = "#E8F5EE"; // near-white
    const textSecondary = "#9BB8A8"; // muted
    const dividerColor = "#3D5C4A";

    // Card dimensions
    const cardX = 80;
    const cardY = 60;
    const cardW = 1040;
    const cardH = 510;
    const cardR = 24;
    const innerPad = 48;

    // Build detail rows
    const detailStartY = 310;
    const rowHeight = 52;
    let detailRows = "";
    let rowIndex = 0;

    // Date row
    detailRows += `
      <text x="${cardX + innerPad + 40}" y="${detailStartY + rowIndex * rowHeight}" 
        font-family="DM Sans" font-size="26" fill="${textPrimary}" dominant-baseline="central">
        📅  ${dateStr}
      </text>`;
    rowIndex++;

    // Time row
    if (timeStr) {
      detailRows += `
        <text x="${cardX + innerPad + 40}" y="${detailStartY + rowIndex * rowHeight}" 
          font-family="DM Sans" font-size="26" fill="${textPrimary}" dominant-baseline="central">
          🕐  ${timeStr}
        </text>`;
      rowIndex++;
    }

    // Location row
    if (location) {
      detailRows += `
        <text x="${cardX + innerPad + 40}" y="${detailStartY + rowIndex * rowHeight}" 
          font-family="DM Sans" font-size="26" fill="${textPrimary}" dominant-baseline="central">
          📍  ${location}
        </text>`;
      rowIndex++;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F1A14"/>
      <stop offset="100%" stop-color="${bg}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#4ECDC4"/>
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>

  <!-- Subtle dot pattern -->
  <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
    <circle cx="15" cy="15" r="1" fill="${accent}" opacity="0.06"/>
  </pattern>
  <rect width="${width}" height="${height}" fill="url(#dots)"/>

  <!-- Card -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardR}" 
    fill="${cardBg}" stroke="${cardStroke}" stroke-width="1.5" filter="url(#cardShadow)"/>

  <!-- Accent top bar -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="6" rx="0" fill="url(#accentGrad)"/>
  <rect x="${cardX}" y="${cardY}" width="${cardR}" height="${cardR}" fill="${cardBg}"/>
  <rect x="${cardX + cardW - cardR}" y="${cardY}" width="${cardR}" height="${cardR}" fill="${cardBg}"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="6" fill="url(#accentGrad)" 
    clip-path="url(#cardClip)"/>

  <!-- Top section: emoji + title -->
  <text x="${cardX + innerPad}" y="${cardY + 90}" 
    font-size="64" dominant-baseline="central">${emoji}</text>

  <text x="${cardX + innerPad + 86}" y="${cardY + 78}" 
    font-family="DM Sans" font-weight="700" font-size="38" fill="${textPrimary}" 
    dominant-baseline="central">${title}</text>

  <!-- "You're invited" badge -->
  <rect x="${cardX + innerPad}" y="${cardY + 130}" width="200" height="36" rx="18" 
    fill="${accent}" opacity="0.15"/>
  <text x="${cardX + innerPad + 100}" y="${cardY + 148}" 
    font-family="DM Sans" font-weight="600" font-size="16" fill="${accent}" 
    text-anchor="middle" dominant-baseline="central">You're invited!</text>

  <!-- Inviter line -->
  <text x="${cardX + innerPad + 220}" y="${cardY + 148}" 
    font-family="DM Sans" font-size="18" fill="${textSecondary}" dominant-baseline="central">
    from ${inviterName}
  </text>

  <!-- Divider -->
  <line x1="${cardX + innerPad}" y1="${detailStartY - 40}" 
    x2="${cardX + cardW - innerPad}" y2="${detailStartY - 40}" 
    stroke="${dividerColor}" stroke-width="1" stroke-dasharray="6,4"/>

  <!-- Detail rows -->
  ${detailRows}

  <!-- Bottom bar: Parade wordmark -->
  <text x="${width / 2}" y="${height - 36}" 
    font-family="Bungee Shade" font-size="28" fill="${accentDim}" 
    text-anchor="middle" dominant-baseline="central" letter-spacing="3">parade</text>
</svg>`;

    const png = await svg2png(svg, {
      width,
      height,
      fonts: [fontDisplay!, fontBody!],
    });

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error generating plan invite OG image:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
