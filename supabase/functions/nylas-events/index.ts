import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Refresh access token using Nylas API
async function refreshAccessToken(
  grantId: string,
  nylasClientId: string,
  nylasApiKey: string,
  nylasApiUri: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    // For Nylas v3, we use the token endpoint with grant_id
    const response = await fetch(`${nylasApiUri}/v3/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${nylasClientId}:${nylasApiKey}`)}`,
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: grantId, // In Nylas v3, grant_id can be used as refresh token
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return null;
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in || 3600,
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

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

    let { access_token, grant_id } = tokens[0];
    const nylasApiUri = Deno.env.get("NYLAS_API_URI") || "https://api.us.nylas.com";
    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID") || "";
    const nylasApiKey = Deno.env.get("NYLAS_API_KEY") || "";

    // Fallback: if grant_id is not in dedicated column, check refresh_token
    if (!grant_id) {
      grant_id = tokens[0].refresh_token;
    }

    if (!grant_id) {
      console.error("No grant_id found for user");
      return new Response(JSON.stringify({ connected: false, error: "Missing grant ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch events from Nylas
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const params = new URLSearchParams({
      start: Math.floor(now.getTime() / 1000).toString(),
      end: Math.floor(thirtyDaysLater.getTime() / 1000).toString(),
      limit: "100",
    });

    let eventsResponse = await fetch(
      `${nylasApiUri}/v3/grants/${grant_id}/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Handle 401/403 - try to refresh token
    if (eventsResponse.status === 401 || eventsResponse.status === 403) {
      console.log("Token expired, attempting refresh...");
      
      const refreshResult = await refreshAccessToken(
        grant_id,
        nylasClientId,
        nylasApiKey,
        nylasApiUri
      );

      if (refreshResult) {
        // Update token in database
        const expiresAt = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
        await supabaseAdmin.rpc("update_calendar_access_token", {
          p_user_id: user.id,
          p_provider: "nylas",
          p_access_token: refreshResult.access_token,
          p_expires_at: expiresAt,
        });

        // Retry with new token
        eventsResponse = await fetch(
          `${nylasApiUri}/v3/grants/${grant_id}/events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${refreshResult.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        // Token refresh failed - connection may need to be re-established
        return new Response(JSON.stringify({ 
          connected: false, 
          error: "Session expired. Please reconnect your calendar." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("Nylas events fetch failed:", errorText);
      return new Response(JSON.stringify({ connected: true, events: [], error: "Failed to fetch events" }), {
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
