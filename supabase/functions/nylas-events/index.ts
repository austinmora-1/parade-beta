import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tokens using admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokens, error: tokenError } = await supabaseAdmin.rpc("get_calendar_tokens", {
      p_user_id: user.id,
      p_provider: "nylas",
    });

    if (tokenError || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token, refresh_token: grantId } = tokens[0];
    const nylasApiUri = Deno.env.get("NYLAS_API_URI") || "https://api.us.nylas.com";

    // Fetch events from Nylas
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const params = new URLSearchParams({
      start: Math.floor(now.getTime() / 1000).toString(),
      end: Math.floor(thirtyDaysLater.getTime() / 1000).toString(),
      limit: "100",
    });

    const eventsResponse = await fetch(
      `${nylasApiUri}/v3/grants/${grantId}/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("Nylas events fetch failed:", errorText);
      return new Response(JSON.stringify({ connected: true, events: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventsData = await eventsResponse.json();
    const events = (eventsData.data || []).map((event: any) => ({
      id: event.id,
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.when?.start_time ? new Date(event.when.start_time * 1000).toISOString() : undefined,
        date: event.when?.date,
      },
      end: {
        dateTime: event.when?.end_time ? new Date(event.when.end_time * 1000).toISOString() : undefined,
        date: event.when?.date,
      },
      location: event.location,
    }));

    return new Response(JSON.stringify({ connected: true, events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Nylas events error:", error);
    return new Response(JSON.stringify({ connected: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
