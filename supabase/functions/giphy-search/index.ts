import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const limit = url.searchParams.get("limit") || "20";
    const offset = url.searchParams.get("offset") || "0";

    const apiKey = Deno.env.get("GIPHY_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GIPHY_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = q
      ? "https://api.giphy.com/v1/gifs/search"
      : "https://api.giphy.com/v1/gifs/trending";

    const params = new URLSearchParams({
      api_key: apiKey,
      limit,
      offset,
      rating: "pg-13",
    });
    if (q) params.set("q", q);

    const res = await fetch(`${endpoint}?${params.toString()}`);
    const data = await res.json();

    const gifs = (data.data || []).map((g: any) => ({
      id: g.id,
      title: g.title || "",
      url: g.images?.original?.url || g.images?.downsized_medium?.url || "",
      preview: g.images?.fixed_width?.url || g.images?.preview_gif?.url || "",
      width: parseInt(g.images?.original?.width || "0", 10),
      height: parseInt(g.images?.original?.height || "0", 10),
    }));

    return new Response(JSON.stringify({ gifs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("giphy-search error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch GIFs" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
