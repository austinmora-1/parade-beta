// @deno-types="https://esm.sh/@types/react@18.2.0"
import React from "https://esm.sh/react@18.2.0";
import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";

// jsdelivr CDN for reliable direct TTF access
const BUNGEE_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bungee/Bungee-Regular.ttf";

let fontCache: ArrayBuffer | null = null;

async function getFont() {
  if (fontCache) return fontCache;
  const res = await fetch(BUNGEE_URL);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status} ${await res.text()}`);
  fontCache = await res.arrayBuffer();
  return fontCache;
}

export async function handler(_req: Request): Promise<Response> {
  try {
    const bungeeData = await getFont();

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
              fontFamily: "Bungee",
              fontSize: "52px",
              color: "#45B87A",
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
          { name: "Bungee", data: bungeeData, style: "normal" as const },
        ],
      }
    );
  } catch (err) {
    console.error("OG image generation error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
