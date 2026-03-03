// @deno-types="https://esm.sh/@types/react@18.2.0"
import React from "https://esm.sh/react@18.2.0";
import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";

// jsdelivr CDN for reliable direct TTF access
const BUNGEE_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bungee/Bungee-Regular.ttf";
const BUNGEE_SHADE_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bungeeshade/BungeeShade-Regular.ttf";

let bungeeCache: ArrayBuffer | null = null;
let bungeeShadeCache: ArrayBuffer | null = null;

async function getFonts() {
  const [bungee, bungeeShade] = await Promise.all([
    bungeeCache ?? fetch(BUNGEE_URL).then(r => { if (!r.ok) throw new Error("Bungee fetch failed"); return r.arrayBuffer(); }),
    bungeeShadeCache ?? fetch(BUNGEE_SHADE_URL).then(r => { if (!r.ok) throw new Error("BungeeShade fetch failed"); return r.arrayBuffer(); }),
  ]);
  bungeeCache = bungee;
  bungeeShadeCache = bungeeShade;
  return { bungee, bungeeShade };
}

export async function handler(_req: Request): Promise<Response> {
  try {
    const { bungee, bungeeShade } = await getFonts();

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111E16",
            padding: "60px",
          }}
        >
          <div
            style={{
              fontFamily: "BungeeShade",
              fontSize: "52px",
              color: "#55C78E",
              letterSpacing: "4px",
              marginBottom: "24px",
            }}
          >
            parade
          </div>
          <div
            style={{
              fontFamily: "Bungee",
              fontSize: "82px",
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 1.1,
              marginBottom: "28px",
            }}
          >
            {"You're Invited!"}
          </div>
          <div
            style={{
              fontFamily: "Bungee",
              fontSize: "24px",
              color: "#55C78E",
              textAlign: "center",
            }}
          >
            Tap to view the plan and RSVP
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: "Bungee", data: bungee, style: "normal" as const },
          { name: "BungeeShade", data: bungeeShade, style: "normal" as const },
        ],
      }
    );
  } catch (err) {
    console.error("OG image generation error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
