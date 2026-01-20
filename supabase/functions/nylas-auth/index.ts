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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID");
    const nylasApiUri = Deno.env.get("NYLAS_API_URI") || "https://api.us.nylas.com";
    
    if (!nylasClientId) {
      return new Response(JSON.stringify({ error: "Nylas not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the origin for redirect
    const origin = req.headers.get("origin") || "https://parade.lovable.app";
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/nylas-callback`;
    
    // Build Nylas OAuth URL
    const state = JSON.stringify({ userId: user.id, origin });
    const params = new URLSearchParams({
      client_id: nylasClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      provider: "google",
      state: encodeURIComponent(state),
    });

    const authUrl = `${nylasApiUri}/v3/connect/auth?${params.toString()}`;

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Nylas auth error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
