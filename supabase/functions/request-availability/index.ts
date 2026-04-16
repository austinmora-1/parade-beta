import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  friendUserId: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid session" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const requesterId = claimsData.claims.sub as string;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rateCheck = await checkRateLimit(admin, requesterId, "request-availability", 10, 3600);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter!, corsHeaders);

    const body: Payload = await req.json();
    const { friendUserId, message } = body;

    if (!friendUserId || typeof friendUserId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing friendUserId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (friendUserId === requesterId) {
      return new Response(
        JSON.stringify({ error: "Cannot request from yourself" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify they are connected friends (in either direction)
    const { data: friendship } = await admin
      .from("friendships")
      .select("id")
      .or(
        `and(user_id.eq.${requesterId},friend_user_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_user_id.eq.${requesterId})`
      )
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!friendship) {
      return new Response(
        JSON.stringify({ error: "You must be connected friends to request availability" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get requester's display name for the nudge message
    const { data: requesterProfile } = await admin
      .from("profiles")
      .select("display_name, first_name")
      .eq("user_id", requesterId)
      .single();

    const requesterName =
      (requesterProfile as any)?.first_name ||
      (requesterProfile as any)?.display_name ||
      "A friend";

    // Avoid duplicate active nudges in the last 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from("smart_nudges")
      .select("id")
      .eq("user_id", friendUserId)
      .eq("friend_user_id", requesterId)
      .eq("nudge_type", "availability_request")
      .is("dismissed_at", null)
      .is("acted_on_at", null)
      .gte("created_at", dayAgo)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, alreadySent: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create the nudge for the friend
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: nudgeError } = await admin.from("smart_nudges").insert({
      user_id: friendUserId,
      friend_user_id: requesterId,
      nudge_type: "availability_request",
      title: `${requesterName} wants to see your availability`,
      message:
        message?.trim() ||
        `${requesterName} would like to know when you're free this week. Share your availability to help them plan.`,
      expires_at: expiresAt,
      metadata: { requester_id: requesterId },
    });

    if (nudgeError) {
      console.error("nudge insert error", nudgeError);
      return new Response(
        JSON.stringify({ error: "Could not create nudge" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Best-effort push notification
    try {
      const { data: pushConfig } = await admin
        .from("push_config")
        .select("vapid_public_key, vapid_private_key")
        .eq("id", "default")
        .single();

      if (pushConfig) {
        const { data: pushSubs } = await admin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", friendUserId);

        if (pushSubs && pushSubs.length > 0) {
          const { default: webpush } = await import("npm:web-push@3.6.7");
          webpush.setVapidDetails(
            "mailto:hello@parade.app",
            pushConfig.vapid_public_key,
            pushConfig.vapid_private_key
          );

          const payload = JSON.stringify({
            title: `${requesterName} wants to see your availability`,
            body: "Tap to share your week.",
            url: "/availability",
            icon: "/icon-192.png",
            badge: "/favicon.png",
          });

          for (const sub of pushSubs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              );
            } catch (pushErr: any) {
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await admin
                  .from("push_subscriptions")
                  .delete()
                  .eq("user_id", friendUserId)
                  .eq("endpoint", sub.endpoint);
              }
            }
          }
        }
      }
    } catch (pushError) {
      console.error("Push notification error:", pushError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("request-availability error", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
