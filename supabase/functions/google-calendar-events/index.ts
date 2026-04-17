import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Use getUser() instead of getClaims() (supabase-js v2)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Use service role to read tokens
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get decrypted tokens via RPC
    const { data: tokens, error: connError } = await adminClient.rpc(
      "get_calendar_tokens",
      {
        p_user_id: userId,
        p_provider: "google",
      },
    );

    if (connError || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Google Calendar not connected",
          connected: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokenData = tokens[0];

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) < new Date()) {
      const refreshedToken = await refreshAccessToken(
        tokenData.refresh_token,
        adminClient,
        userId,
      );
      if (!refreshedToken) {
        return new Response(
          JSON.stringify({
            error: "Failed to refresh token",
            connected: false,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      accessToken = refreshedToken;
    }

    // Fetch calendar events
    const url = new URL(req.url);
    const timeMin = url.searchParams.get("timeMin") || new Date().toISOString();
    const timeMax = url.searchParams.get("timeMax") ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = url.searchParams.get("maxResults") || "50";

    const calendarUrl = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    calendarUrl.searchParams.set("timeMin", timeMin);
    calendarUrl.searchParams.set("timeMax", timeMax);
    calendarUrl.searchParams.set("maxResults", maxResults);
    calendarUrl.searchParams.set("singleEvents", "true");
    calendarUrl.searchParams.set("orderBy", "startTime");

    const calendarResponse = await fetch(calendarUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error("Calendar API error:", calendarResponse.status, errorText);

      // Return a helpful message for the common 403 case.
      if (calendarResponse.status === 401 || calendarResponse.status === 403) {
        return new Response(
          JSON.stringify({
            error:
              "Google denied access (403). Please disconnect and reconnect Google Calendar (and ensure Calendar API is enabled for the Google OAuth client).",
            connected: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to fetch events", connected: true }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const calendarData = await calendarResponse.json();

    return new Response(
      JSON.stringify({
        connected: true,
        events: calendarData.items || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function refreshAccessToken(
  refreshToken: string,
  supabase: any,
  userId: string,
): Promise<string | null> {
  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await response.json();

    if (tokens.error) {
      console.error("Token refresh error:", tokens);
      return null;
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
      .toISOString();

    await supabase.rpc("update_calendar_access_token", {
      p_user_id: userId,
      p_provider: "google",
      p_access_token: tokens.access_token,
      p_expires_at: expiresAt,
    });

    return tokens.access_token;
  } catch (error) {
    console.error("Refresh token error:", error);
    return null;
  }
}
