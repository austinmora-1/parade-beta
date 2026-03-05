import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { latitude, longitude } = await req.json();

    // 1. Fetch user's friends
    const { data: friends } = await supabase
      .from("friendships")
      .select("friend_user_id, friend_name")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .not("friend_user_id", "is", null);

    if (!friends || friends.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch mutual availability for next 7 days
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const friendIds = friends.map((f) => f.friend_user_id).filter(Boolean) as string[];

    const { data: friendAvail } = await supabase
      .from("availability")
      .select("user_id, date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night")
      .in("user_id", friendIds)
      .in("date", dates);

    const { data: myAvail } = await supabase
      .from("availability")
      .select("date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night")
      .eq("user_id", user.id)
      .in("date", dates);

    // 3. Get weather from Open-Meteo (free, no key)
    let weatherInfo = "Weather data unavailable.";
    if (latitude && longitude) {
      try {
        const weatherResp = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`
        );
        if (weatherResp.ok) {
          const weather = await weatherResp.json();
          const weatherCodes: Record<number, string> = {
            0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Foggy", 48: "Foggy", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
            61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
            80: "Light showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm",
          };
          weatherInfo = weather.daily.time
            .map((date: string, i: number) => {
              const code = weather.daily.weathercode[i];
              const desc = weatherCodes[code] || "Unknown";
              const high = weather.daily.temperature_2m_max[i];
              const low = weather.daily.temperature_2m_min[i];
              return `${date}: ${desc}, ${low}°–${high}°C`;
            })
            .join("\n");
        }
      } catch {
        // weather fetch failed, continue without it
      }
    }

    // 4. Build context for AI
    const friendNameMap = Object.fromEntries(friends.map((f) => [f.friend_user_id, f.friend_name]));
    const slots = ["early_morning", "late_morning", "early_afternoon", "late_afternoon", "evening", "late_night"];
    const slotLabels: Record<string, string> = {
      early_morning: "6–9am", late_morning: "9am–12pm",
      early_afternoon: "12–3pm", late_afternoon: "3–6pm",
      evening: "6–9pm", late_night: "9pm–12am",
    };

    // Find mutual free slots
    const myAvailMap: Record<string, Record<string, boolean>> = {};
    for (const a of myAvail || []) {
      myAvailMap[a.date] = {};
      for (const s of slots) {
        myAvailMap[a.date][s] = (a as any)[s] !== false;
      }
    }

    const mutualSlots: string[] = [];
    for (const date of dates) {
      const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
      const myDay = myAvailMap[date];
      if (!myDay) continue;

      for (const slot of slots) {
        if (!myDay[slot]) continue;
        // Find friends free in this slot
        const freeFriends = (friendAvail || [])
          .filter((a) => a.date === date && (a as any)[slot] !== false)
          .map((a) => friendNameMap[a.user_id] || "a friend");
        
        if (freeFriends.length > 0) {
          const names = freeFriends.slice(0, 3).join(", ");
          mutualSlots.push(`${dayName} ${date} ${slotLabels[slot]}: You + ${names} are free`);
        }
      }
    }

    if (mutualSlots.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Call AI for suggestions
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a social planner assistant. Based on the user's mutual availability with friends and weather forecast, suggest 3-4 fun, specific hangout ideas. Be creative, casual, and brief.

MUTUAL FREE SLOTS (next 7 days):
${mutualSlots.slice(0, 15).join("\n")}

WEATHER FORECAST:
${weatherInfo}

Return suggestions as a JSON array using the suggest_plans tool. Each suggestion should feel personal and mention the friend(s) by name. Use weather to inform outdoor/indoor choices. Keep descriptions to 1 sentence.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_plans",
              description: "Return hangout suggestions",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        emoji: { type: "string", description: "Single emoji for the activity" },
                        title: { type: "string", description: "Short catchy title e.g. 'Dinner with Marcus'" },
                        description: { type: "string", description: "1-sentence description" },
                        friend_names: { type: "array", items: { type: "string" }, description: "Friend names involved" },
                        day: { type: "string", description: "Day name e.g. 'Friday'" },
                        time_slot: { type: "string", description: "Time description e.g. 'evening'" },
                      },
                      required: ["emoji", "title", "description", "friend_names", "day", "time_slot"],
                    },
                  },
                },
                required: ["suggestions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_plans" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let suggestions: any[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = parsed.suggestions || [];
      } catch {
        suggestions = [];
      }
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("event-suggestions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
