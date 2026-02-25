import { initialize, svg2png } from "https://esm.sh/svg2png-wasm@0.6.1";

const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/bungeeshade/BungeeShade-Regular.ttf";

let initialized = false;
let fontData: Uint8Array | null = null;

async function init() {
  if (initialized) return;
  
  const [wasmRes, fontRes] = await Promise.all([
    fetch("https://esm.sh/svg2png-wasm@0.6.1/svg2png_wasm_bg.wasm"),
    fetch(FONT_URL),
  ]);
  
  fontData = new Uint8Array(await fontRes.arrayBuffer());
  await initialize(wasmRes);
  initialized = true;
}

function generateConfetti(count: number, width: number, height: number): string {
  const colors = [
    "#FF6B6B", // red
    "#FFB347", // orange
    "#FFD700", // gold
    "#55C78E", // brand green
    "#4ECDC4", // teal
    "#A78BFA", // purple
    "#F472B6", // pink
    "#60A5FA", // blue
    "#FBBF24", // yellow
    "#34D399", // emerald
  ];

  const shapes: string[] = [];

  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const rotation = Math.random() * 360;
    const opacity = 0.5 + Math.random() * 0.5;
    const shapeType = Math.floor(Math.random() * 3);

    if (shapeType === 0) {
      // Rectangle confetti
      const w = 6 + Math.random() * 10;
      const h = 3 + Math.random() * 6;
      shapes.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}" transform="rotate(${rotation} ${x + w/2} ${y + h/2})" rx="1" />`
      );
    } else if (shapeType === 1) {
      // Circle confetti
      const r = 3 + Math.random() * 5;
      shapes.push(
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`
      );
    } else {
      // Triangle confetti
      const size = 6 + Math.random() * 8;
      const x1 = x, y1 = y - size;
      const x2 = x - size * 0.866, y2 = y + size * 0.5;
      const x3 = x + size * 0.866, y3 = y + size * 0.5;
      shapes.push(
        `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${color}" opacity="${opacity}" transform="rotate(${rotation} ${x} ${y})" />`
      );
    }
  }

  return shapes.join("\n    ");
}

Deno.serve(async (_req) => {
  try {
    await init();

    const width = 1200;
    const height = 630;
    const bgColor = "#24382D";
    const textColor = "#55C78E";
    const confetti = generateConfetti(80, width, height);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bgColor}" />
  <g>
    ${confetti}
  </g>
  <text
    x="${width / 2}"
    y="${height / 2}"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="Bungee Shade"
    font-size="120"
    letter-spacing="6"
    fill="${textColor}"
  >parade</text>
</svg>`;

    const png = await svg2png(svg, {
      width,
      height,
      fonts: [fontData!],
    });

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