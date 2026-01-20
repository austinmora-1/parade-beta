import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Nylas OAuth error:", error);
      return new Response(getErrorHtml("Authorization was denied"), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !stateParam) {
      return new Response(getErrorHtml("Missing authorization code"), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // URLSearchParams already decoded the state, just parse JSON
    const state = JSON.parse(stateParam);
    const { userId, origin } = state;

    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID");
    const nylasApiKey = Deno.env.get("NYLAS_API_KEY");
    const rawApiUri = Deno.env.get("NYLAS_API_URI");

    const nylasApiUri = (() => {
      try {
        return rawApiUri ? new URL(rawApiUri).origin : "https://api.us.nylas.com";
      } catch {
        return "https://api.us.nylas.com";
      }
    })();

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/nylas-callback`;

    if (!nylasClientId || !nylasApiKey) {
      return new Response(getErrorHtml("Nylas not configured"), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`${nylasApiUri}/v3/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${nylasClientId}:${nylasApiKey}`)}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return new Response(getErrorHtml("Failed to exchange token"), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, grant_id, expires_in } = tokenData;

    console.log("Nylas token exchange success", {
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      hasGrantId: !!grant_id,
      expiresIn: expires_in,
    });

    // Calculate expiry
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // Store in database using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Store grant_id properly in the grant_id column
    const { error: dbError } = await supabaseAdmin.rpc("upsert_calendar_connection", {
      p_user_id: userId,
      p_provider: "nylas",
      p_access_token: access_token,
      // IMPORTANT: store NULL when missing (don't store empty string)
      p_refresh_token: refresh_token ?? null,
      p_expires_at: expiresAt,
      p_grant_id: grant_id ?? null,
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(getErrorHtml("Failed to save connection"), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Redirect back to app
    const redirectUrl = `${origin}/settings?calendar=connected`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch (error) {
    console.error("Nylas callback error:", error);
    return new Response(getErrorHtml(error instanceof Error ? error.message : "Unknown error"), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});

function getErrorHtml(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><title>Calendar Connection Error</title></head>
      <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
        <div style="text-align: center; padding: 20px;">
          <h2>Connection Failed</h2>
          <p>${message}</p>
          <p><a href="javascript:window.close()">Close this window</a></p>
        </div>
      </body>
    </html>
  `;
}
