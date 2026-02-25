import { initialize, svg2png } from "https://esm.sh/svg2png-wasm@0.6.1";

// TTF version of Bungee Shade from Google Fonts (resvg needs TTF, not woff2)
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
  console.log("Font loaded, size:", fontData.length);
  
  await initialize(wasmRes);
  initialized = true;
}

Deno.serve(async (_req) => {
  try {
    await init();

    const width = 1200;
    const height = 630;
    // Exact colors from the app's index.css
    // Background: hsl(150, 22%, 18%) = rgb(36, 56, 45)  
    // Text: hsl(150, 50%, 55%) = rgb(85, 199, 142)
    const bgColor = "#24382D";
    const textColor = "#55C78E";

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bgColor}" />
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

    console.log("Rendering SVG to PNG...");
    const png = await svg2png(svg, {
      width,
      height,
      fonts: [fontData!],
    });
    console.log("PNG generated, size:", png.length);

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