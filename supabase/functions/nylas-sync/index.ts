import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize to Nylas API origin only
function normalizeNylasOrigin(value: string | undefined) {
  if (!value) return "https://api.us.nylas.com";
  try {
    const u = new URL(value);
    return u.origin;
  } catch {
    return value.startsWith("https://") ? value : `https://${value}`;
  }
}

// Map hour to time slot
function getTimeSlot(hour: number): string {
  if (hour >= 2 && hour < 9) return "early_morning";
  if (hour >= 9 && hour < 12) return "late_morning";
  if (hour >= 12 && hour < 15) return "early_afternoon";
  if (hour >= 15 && hour < 18) return "late_afternoon";
  if (hour >= 18 && hour < 21) return "evening";
  return "late_night";
}

// Get all time slots an event spans
function getEventTimeSlots(startTime: Date, endTime: Date): string[] {
  const slots = new Set<string>();
  let current = new Date(startTime);
  
  while (current < endTime) {
    slots.add(getTimeSlot(current.getHours()));
    current = new Date(current.getTime() + 60 * 60 * 1000); // Add 1 hour
  }
  
  return Array.from(slots);
}

// Format date to YYYY-MM-DD
function getDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Format a Date to HH:MM
function formatTimeHHMM(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

// Get all dates an event spans
function getEventDates(startTime: Date, endTime: Date): string[] {
  const dates: string[] = [];
  let current = new Date(startTime);
  current.setHours(0, 0, 0, 0);
  
  const endDate = new Date(endTime);
  endDate.setHours(0, 0, 0, 0);
  
  while (current <= endDate) {
    dates.push(getDateString(current));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return dates;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

async function handleEventsSync({
  adminClient,
  userId,
  events,
}: {
  adminClient: any;
  userId: string;
  events: CalendarEvent[];
}): Promise<{ updatedCount: number }> {
  const busySlots: Record<string, Set<string>> = {};
  
  for (const event of events) {
    let startTime: Date;
    let endTime: Date;
    
    if (event.start.dateTime) {
      startTime = new Date(event.start.dateTime);
      endTime = new Date(event.end.dateTime || event.start.dateTime);
    } else if (event.start.date) {
      // All-day event
      startTime = new Date(event.start.date);
      startTime.setHours(6, 0, 0, 0);
      endTime = new Date(event.end.date || event.start.date);
      endTime.setHours(21, 0, 0, 0);
    } else {
      continue;
    }
    
    const dates = getEventDates(startTime, endTime);
    const slots = getEventTimeSlots(startTime, endTime);
    
    for (const date of dates) {
      if (!busySlots[date]) {
        busySlots[date] = new Set();
      }
      for (const slot of slots) {
        busySlots[date].add(slot);
      }
    }
  }
  
  let updatedCount = 0;
  
  for (const [date, slots] of Object.entries(busySlots)) {
    const updateData: Record<string, boolean> = {};
    for (const slot of slots) {
      updateData[slot] = false; // Mark as unavailable
    }
    
    const { error } = await adminClient
      .from("availability")
      .upsert({
        user_id: userId,
        date,
        ...updateData,
      }, {
        onConflict: "user_id,date",
      });
    
    if (!error) {
      updatedCount++;
    }
  }
  
  return { updatedCount };
}

// Refresh access token using Nylas API (requires refresh_token)
async function refreshAccessToken(
  refreshToken: string,
  nylasClientId: string,
  nylasApiKey: string,
  nylasApiOrigin: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const response = await fetch(`${nylasApiOrigin}/v3/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${nylasClientId}:${nylasApiKey}`)}`,
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
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
      return new Response(JSON.stringify({ synced: false, message: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ synced: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get tokens
    const { data: tokens, error: tokenError } = await supabaseAdmin.rpc("get_calendar_tokens", {
      p_user_id: user.id,
      p_provider: "nylas",
    });

    if (tokenError || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ synced: false, message: "Not connected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token, refresh_token, grant_id } = tokens[0];

    // Back-compat: older rows stored grant_id in refresh_token
    const effectiveGrantId = grant_id || refresh_token;
    const effectiveRefreshToken = grant_id ? refresh_token : null;

    const nylasApiOrigin = normalizeNylasOrigin(Deno.env.get("NYLAS_API_URI"));
    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID") || "";
    const nylasApiKey = Deno.env.get("NYLAS_API_KEY") || "";

    if (!effectiveGrantId) {
      return new Response(JSON.stringify({ synced: false, message: "Missing grant ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch events
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const params = new URLSearchParams({
      start: Math.floor(now.getTime() / 1000).toString(),
      end: Math.floor(thirtyDaysLater.getTime() / 1000).toString(),
      limit: "200",
    });

    let eventsResponse = await fetch(
      `${nylasApiOrigin}/v3/grants/${effectiveGrantId}/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Handle 401/403 - try to refresh token
    if (eventsResponse.status === 401 || eventsResponse.status === 403) {
      console.log("Token expired during sync, attempting refresh...");

      if (!effectiveRefreshToken) {
        return new Response(
          JSON.stringify({ synced: false, message: "Session expired. Please reconnect your calendar." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const refreshResult = await refreshAccessToken(
        effectiveRefreshToken,
        nylasClientId,
        nylasApiKey,
        nylasApiOrigin
      );

      if (refreshResult) {
        const expiresAt = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
        await supabaseAdmin.rpc("update_calendar_access_token", {
          p_user_id: user.id,
          p_provider: "nylas",
          p_access_token: refreshResult.access_token,
          p_expires_at: expiresAt,
        });

        eventsResponse = await fetch(
          `${nylasApiOrigin}/v3/grants/${effectiveGrantId}/events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${refreshResult.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        return new Response(
          JSON.stringify({ synced: false, message: "Session expired. Please reconnect your calendar." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("Nylas sync fetch failed:", errorText);
      return new Response(JSON.stringify({ synced: false, message: "Failed to fetch events" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventsData = await eventsResponse.json();
    const events = (eventsData.data || []).map((event: any) => {
      const startDt = event.when?.start_time ? new Date(event.when.start_time * 1000) : null;
      const endDt = event.when?.end_time ? new Date(event.when.end_time * 1000) : null;
      return {
        id: event.id,
        summary: event.title,
        start: {
          dateTime: startDt ? startDt.toISOString() : undefined,
          date: event.when?.date,
        },
        end: {
          dateTime: endDt ? endDt.toISOString() : undefined,
          date: event.when?.date,
        },
        // Store raw start/end for time extraction
        _startTime: startDt ? formatTimeHHMM(startDt) : null,
        _endTime: endDt ? formatTimeHHMM(endDt) : null,
      };
    });

    const { updatedCount } = await handleEventsSync({
      adminClient: supabaseAdmin,
      userId: user.id,
      events,
    });

    return new Response(JSON.stringify({
      synced: true,
      eventsProcessed: events.length,
      datesUpdated: updatedCount,
      message: `Synced ${events.length} events across ${updatedCount} days`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Nylas sync error:", error);
    return new Response(JSON.stringify({ synced: false, message: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
