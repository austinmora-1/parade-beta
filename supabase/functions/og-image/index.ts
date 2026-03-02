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

// v2 - fixed duplicate supabaseUrl declaration
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const token = url.searchParams.get("token");
    const width = 1200;
    const height = 630;

    // Route: invite-card — branded "You're invited!" image (no dynamic data needed)
    if (type === "invite-card") {
      await init();
      const bg = "#1A2B22";
      const accent = "#55C78E", accentDim = "#3D8C6C";
      const confetti = generateConfetti(60, width, height);

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F1A14"/><stop offset="100%" stop-color="${bg}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="#4ECDC4"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <g>${confetti}</g>
  <text x="${width / 2}" y="220" font-family="Bungee Shade" font-size="80" fill="${accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="4">parade</text>
  <rect x="${width / 2 - 200}" y="290" width="400" height="4" rx="2" fill="url(#accentGrad)" opacity="0.6"/>
  <text x="${width / 2}" y="360" font-family="Inter" font-weight="700" font-size="48" fill="#E8F5EE" text-anchor="middle" dominant-baseline="central">You&apos;re Invited!</text>
  <text x="${width / 2}" y="430" font-family="Inter" font-size="26" fill="#9BB8A8" text-anchor="middle" dominant-baseline="central">Tap to view details and RSVP</text>
  <rect x="${width / 2 - 120}" y="480" width="240" height="56" rx="28" fill="url(#accentGrad)"/>
  <text x="${width / 2}" y="515" font-family="Inter" font-weight="700" font-size="22" fill="#0F1A14" text-anchor="middle">View Plan</text>
</svg>`;

      const png = await svg2png(svg, { width, height, fonts: [displayFontData!, bodyFontData!] });
      return new Response(png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Default: branded Parade OG image
    await init();
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
