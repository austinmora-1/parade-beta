import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map hour to time slot
function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 9) return "early_morning";
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

    const { access_token, refresh_token: grantId } = tokens[0];
    const nylasApiUri = Deno.env.get("NYLAS_API_URI") || "https://api.us.nylas.com";

    // Fetch events
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const params = new URLSearchParams({
      start: Math.floor(now.getTime() / 1000).toString(),
      end: Math.floor(thirtyDaysLater.getTime() / 1000).toString(),
      limit: "200",
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
      console.error("Nylas sync fetch failed:", errorText);
      return new Response(JSON.stringify({ synced: false, message: "Failed to fetch events" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventsData = await eventsResponse.json();
    const events = (eventsData.data || []).map((event: any) => ({
      id: event.id,
      summary: event.title,
      start: {
        dateTime: event.when?.start_time ? new Date(event.when.start_time * 1000).toISOString() : undefined,
        date: event.when?.date,
      },
      end: {
        dateTime: event.when?.end_time ? new Date(event.when.end_time * 1000).toISOString() : undefined,
        date: event.when?.date,
      },
    }));

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
