import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type CalendarEvent,
  classifyActivity,
  extractFlightDepartureCity,
  extractFlightDestination,
  extractHotelLocation,
  fetchAllGoogleEvents,
  type FlightInfo,
  formatTimeHHMM,
  getAllDayDateRange,
  getDateString,
  getEventDates,
  getEventTimeSlots,
  getHourInTimezone,
  getPlanDurationMinutes,
  getTimeSlot,
  type HotelStay,
  isCityMatchingHome,
  isFlightEvent,
  isHotelEvent,
  parseAllDayDate,
  reconcilePlans,
  resolveLocationsByDate,
  resolveSlotLocations,
  resolveToCity,
  upsertAvailabilityWithLocation,
} from "../_shared/calendar-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GCalEvent extends CalendarEvent {}

async function handleEventsSync(params: {
  adminClient: any;
  userId: string;
  events: GCalEvent[];
  timezone?: string;
}): Promise<
  {
    updatedCount: number;
    pendingReturnTrips: { destination: string; departureDate: string }[];
  }
> {
  const { adminClient, userId, events, timezone } = params;

  const { data: profileData } = await adminClient
    .from("profiles")
    .select("home_address")
    .eq("user_id", userId)
    .single();
  const homeAddress: string | null = profileData?.home_address || null;

  const busySlotsByDate: Map<string, Set<string>> = new Map();
  const allFlights: FlightInfo[] = [];
  const hotelStays: HotelStay[] = [];

  for (const event of events) {
    if (!event.start.dateTime || !event.end.dateTime) {
      if (event.start.date && event.end.date) {
        const startParsed = parseAllDayDate(event.start.date);
        const endDate = new Date(event.end.date + "T12:00:00Z");
        endDate.setDate(endDate.getDate() - 1);
        const endDateStr = endDate.toISOString().split("T")[0];
        const dates = getAllDayDateRange(startParsed.dateString, endDateStr);
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set());
          [
            "early_morning",
            "late_morning",
            "early_afternoon",
            "late_afternoon",
            "evening",
            "late_night",
          ].forEach(
            (slot) => busySlotsByDate.get(date)!.add(slot),
          );
        }
        if (isHotelEvent(event.summary, event.location)) {
          const hotelCity = resolveToCity(
            extractHotelLocation(event.summary, event.location),
          );
          if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
            hotelStays.push({
              startDate: startParsed.dateString,
              endDate: endDateStr,
              city: hotelCity,
            });
          }
        }
      }
      continue;
    }

    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);
    const dates = getEventDates(startTime, endTime, timezone);
    for (const date of dates) {
      if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set());
      const slots = getEventTimeSlots(startTime, endTime, timezone);
      slots.forEach((slot) => busySlotsByDate.get(date)!.add(slot));
    }

    if (isFlightEvent(event)) {
      const city = resolveToCity(extractFlightDestination(event.summary));
      const departureCity = resolveToCity(
        extractFlightDepartureCity(event.summary),
      );
      const isReturn = city ? isCityMatchingHome(city, homeAddress) : false;
      const rawDateTime = event.start.dateTime || event.start.date || null;
      const sd = rawDateTime ? new Date(rawDateTime) : null;
      if (!sd || isNaN(sd.getTime())) continue;
      const endRaw = event.end.dateTime || event.end.date || null;
      const ed = endRaw ? new Date(endRaw) : sd;
      const dateStr = getDateString(sd, timezone);
      const ts = sd.getTime();
      console.log(
        `[FLIGHT] "${event.summary}" | raw=${rawDateTime} | parsed=${sd.toISOString()} | ts=${ts} | dateStr=${dateStr} | city=${city} | departureCity=${departureCity} | isReturn=${isReturn}`,
      );
      allFlights.push({
        date: dateStr,
        timestamp: ts,
        arrivalTimestamp: ed.getTime(),
        city,
        departureCity,
        isReturn,
      });
      continue;
    }

    if (isHotelEvent(event.summary, event.location)) {
      const hotelCity = resolveToCity(
        extractHotelLocation(event.summary, event.location),
      );
      if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
        hotelStays.push({
          startDate: getDateString(startTime, timezone),
          endDate: getDateString(endTime, timezone),
          city: hotelCity,
        });
      }
    }
  }

  // Fetch existing trips for resolveLocationsByDate
  const { data: existingTrips } = await adminClient
    .from("trips")
    .select("id, location, start_date, end_date, needs_return_date")
    .eq("user_id", userId);

  // Use shared segment-based location resolution
  const {
    locationByDate,
    returnHomeDates,
    outboundFlightDates,
    pendingReturnTrips,
  } = resolveLocationsByDate({
    allFlights,
    hotelStays,
    homeAddress,
    existingTrips: existingTrips || [],
  });

  // Resolve per-slot locations for flight days
  const slotLocationsByDate = resolveSlotLocations({
    allFlights,
    locationByDate,
    homeAddress,
    timezone,
  });

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAhead = new Date(now);
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);
  const syncRangeStart = getDateString(threeMonthsAgo, timezone);
  const syncRangeEnd = getDateString(threeMonthsAhead, timezone);

  // Use shared availability upsert logic
  const updatedCount = await upsertAvailabilityWithLocation({
    adminClient,
    userId,
    busySlotsByDate,
    locationByDate,
    returnHomeDates,
    outboundFlightDates,
    pendingReturnTrips,
    homeAddress,
    syncRangeStart,
    syncRangeEnd,
    slotLocationsByDate,
  });

  // ── Sync plans using shared reconciliation ──
  const incomingEventIds = new Set<string>();
  const planRowsByEventId = new Map<string, any>();

  for (const event of events) {
    let localDateStr: string;
    let hour: number;
    let startTimeStr: string | null;
    let endTimeStr: string | null;
    let durationMinutes = 60;

    // Prefer the event's own timezone (Google returns it per event) over the viewer's tz
    const eventTimezone = event.start.timeZone || timezone;

    if (event.start.dateTime) {
      const startDate = new Date(event.start.dateTime);
      const endDate = event.end.dateTime ? new Date(event.end.dateTime) : null;
      hour = getHourInTimezone(startDate, eventTimezone);
      localDateStr = getDateString(startDate, eventTimezone);
      startTimeStr = formatTimeHHMM(startDate, eventTimezone);
      endTimeStr = endDate ? formatTimeHHMM(endDate, eventTimezone) : null;
      durationMinutes = getPlanDurationMinutes(startDate, endDate);
    } else if (event.start.date) {
      localDateStr = event.start.date;
      hour = 12;
      startTimeStr = null;
      endTimeStr = null;
    } else {
      continue;
    }

    const timeSlotHyphen = getTimeSlot(hour).replace("_", "-");
    const planDate = `${localDateStr}T12:00:00+00:00`;

    incomingEventIds.add(event.id);
    planRowsByEventId.set(event.id, {
      user_id: userId,
      title: event.summary || "Gcal imported event",
      activity: classifyActivity(event.summary, isFlightEvent(event)),
      date: planDate,
      time_slot: timeSlotHyphen,
      duration: durationMinutes,
      source: "gcal",
      source_event_id: event.id,
      start_time: startTimeStr,
      end_time: endTimeStr,
      source_timezone: eventTimezone || null,
    });
  }

  await reconcilePlans({
    adminClient,
    userId,
    source: "gcal",
    planRowsByEventId,
    incomingEventIds,
  });

  return { updatedCount, pendingReturnTrips };
}

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
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    let timezone: string | undefined;
    try {
      const body = await req.json();
      timezone = body?.timezone;
    } catch { /* no body or invalid JSON */ }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
          synced: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokenData = tokens[0];
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
            synced: false,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      accessToken = refreshedToken;
    }

    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAhead = new Date(now);
    threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

    let events: CalendarEvent[];
    try {
      events = await fetchAllGoogleEvents(
        accessToken,
        threeMonthsAgo.toISOString(),
        threeMonthsAhead.toISOString(),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Calendar API error:", message);

      if (message.includes("401") || message.includes("403")) {
        return new Response(
          JSON.stringify({
            error:
              "Google denied access (403). Please disconnect + reconnect Google Calendar.",
            connected: true,
            synced: false,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: "Failed to fetch events",
          connected: true,
          synced: false,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { updatedCount, pendingReturnTrips } = await handleEventsSync({
      adminClient,
      userId,
      events,
      timezone,
    });

    return new Response(
      JSON.stringify({
        connected: true,
        synced: true,
        eventsProcessed: events.length,
        datesUpdated: updatedCount,
        pendingReturnTrips,
        message: `Synced ${events.length} events, updated ${updatedCount} days`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, synced: false }), {
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
