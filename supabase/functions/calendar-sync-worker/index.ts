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
  type ICalEvent,
  isCityMatchingHome,
  isFlightEvent,
  isHotelEvent,
  parseAllDayDate,
  parseICS,
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

// ── Shared flight/hotel collection for Google events ────────────────────────

function collectGoogleFlightsAndHotels(
  events: GCalEvent[],
  busySlotsByDate: Map<string, Set<string>>,
  allFlights: FlightInfo[],
  hotelStays: HotelStay[],
  homeAddress: string | null,
  timezone?: string,
) {
  for (const event of events) {
    try {
      if (!event.start.dateTime || !event.end.dateTime) {
        if (event.start.date && event.end.date) {
          const startParsed = parseAllDayDate(event.start.date);
          const endDate = new Date(event.end.date + "T12:00:00Z");
          endDate.setDate(endDate.getDate() - 1);
          const endDateStr = endDate.toISOString().split("T")[0];
          const dates = getAllDayDateRange(startParsed.dateString, endDateStr);
          for (const date of dates) {
            if (!busySlotsByDate.has(date)) {
              busySlotsByDate.set(date, new Set());
            }
            [
              "early_morning",
              "late_morning",
              "early_afternoon",
              "late_afternoon",
              "evening",
              "late_night",
            ].forEach((s) => busySlotsByDate.get(date)!.add(s));
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
        continue; // skip non-timed events for flight detection
      }
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);
      const dates = getEventDates(startTime, endTime, timezone);
      for (const date of dates) {
        if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set());
        getEventTimeSlots(startTime, endTime, timezone).forEach((s) =>
          busySlotsByDate.get(date)!.add(s)
        );
      }

      if (isFlightEvent(event.summary)) {
        const city = resolveToCity(extractFlightDestination(event.summary));
        const departureCity = resolveToCity(
          extractFlightDepartureCity(event.summary),
        );
        const isReturn = city ? isCityMatchingHome(city, homeAddress) : false;
        const dateStr = getDateString(startTime, timezone);
        const arrivalTimestamp = endTime.getTime();
        allFlights.push({
          date: dateStr,
          timestamp: startTime.getTime(),
          arrivalTimestamp,
          city,
          departureCity,
          isReturn,
        });
      } else if (isHotelEvent(event.summary, event.location)) {
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
    } catch (err) {
      console.warn("Skipping malformed Google event", {
        eventId: event.id,
        summary: event.summary?.slice(0, 50),
        error: (err as Error).message,
      });
      // Continue processing remaining events
    }
  }
}

// ── Shared flight/hotel collection for iCal events ──────────────────────────

function collectICalFlightsAndHotels(
  events: ICalEvent[],
  busySlotsByDate: Map<string, Set<string>>,
  allFlights: FlightInfo[],
  hotelStays: HotelStay[],
  homeAddress: string | null,
  userTimezone?: string,
) {
  for (const event of events) {
    try {
      if (event.isAllDay) {
        const startDateStr = event.dtstart.toISOString().split("T")[0];
        const endExcl = new Date(event.dtend);
        endExcl.setDate(endExcl.getDate() - 1);
        const endDateStr = endExcl.toISOString().split("T")[0];
        const dates = getAllDayDateRange(startDateStr, endDateStr);
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set());
          [
            "early_morning",
            "late_morning",
            "early_afternoon",
            "late_afternoon",
            "evening",
            "late_night",
          ].forEach((s) => busySlotsByDate.get(date)!.add(s));
        }
        if (isHotelEvent(event.summary, event.location)) {
          const hotelCity = resolveToCity(
            extractHotelLocation(event.summary, event.location),
          );
          if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
            hotelStays.push({
              startDate: startDateStr,
              endDate: endDateStr,
              city: hotelCity,
            });
          }
        }
        continue;
      }
      for (const date of getEventDates(event.dtstart, event.dtend)) {
        if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set());
        getEventTimeSlots(event.dtstart, event.dtend).forEach((s) =>
          busySlotsByDate.get(date)!.add(s)
        );
      }

      if (isFlightEvent(event.summary)) {
        const city = resolveToCity(extractFlightDestination(event.summary));
        const departureCity = resolveToCity(
          extractFlightDepartureCity(event.summary),
        );
        const isReturn = city ? isCityMatchingHome(city, homeAddress) : false;
        const dateStr = getDateString(event.dtstart, userTimezone);
        allFlights.push({
          date: dateStr,
          timestamp: event.dtstart.getTime(),
          arrivalTimestamp: event.dtend.getTime(),
          city,
          departureCity,
          isReturn,
        });
      } else if (isHotelEvent(event.summary, event.location)) {
        const hotelCity = resolveToCity(
          extractHotelLocation(event.summary, event.location),
        );
        if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
          hotelStays.push({
            startDate: getDateString(event.dtstart, userTimezone),
            endDate: getDateString(event.dtend, userTimezone),
            city: hotelCity,
          });
        }
      }
    } catch (err) {
      console.warn("Skipping malformed iCal event", {
        summary: event.summary?.slice(0, 50),
        error: (err as Error).message,
      });
    }
  }
}

// ── Google Calendar Sync ────────────────────────────────────────────────────

async function syncGoogleCalendar(
  adminClient: any,
  userId: string,
): Promise<{ eventsProcessed: number; datesUpdated: number }> {
  const { data: tokens, error: connError } = await adminClient.rpc(
    "get_calendar_tokens",
    {
      p_user_id: userId,
      p_provider: "google",
    },
  );

  if (connError || !tokens || tokens.length === 0) {
    throw new Error("Google Calendar not connected");
  }

  const tokenData = tokens[0];

  const { data: profileData } = await adminClient
    .from("profiles")
    .select("home_address, timezone, location_status")
    .eq("user_id", userId)
    .single();
  const homeAddress: string | null = profileData?.home_address || null;

  // Resolve timezone using same priority as frontend getUserTimezone():
  // 1. Explicit profile timezone
  // 2. If "away", use today's trip_location timezone
  // 3. Home address timezone
  // 4. Fallback to America/New_York
  let timezone: string | undefined = profileData?.timezone || undefined;
  if (!timezone) {
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: todayAvail } = await adminClient
      .from("availability")
      .select("location_status, trip_location")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle();
    const locStatus = todayAvail?.location_status ||
      profileData?.location_status || "home";
    if (locStatus === "away" && todayAvail?.trip_location) {
      timezone = todayAvail.trip_location; // will be stored as-is; city name used for display
    }
    // If still no timezone, home_address will be stored and resolved on frontend
    // For source_timezone we need an IANA timezone, so just use a fallback
    if (!timezone) {
      timezone = homeAddress || "America/New_York";
    }
  }

  let accessToken = tokenData.access_token;

  if (new Date(tokenData.expires_at) < new Date()) {
    const refreshedToken = await refreshGoogleAccessToken(
      tokenData.refresh_token,
      adminClient,
      userId,
    );
    if (!refreshedToken) throw new Error("Failed to refresh Google token");
    accessToken = refreshedToken;
  }

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAhead = new Date(now);
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

  const events: GCalEvent[] = await fetchAllGoogleEvents(
    accessToken,
    threeMonthsAgo.toISOString(),
    threeMonthsAhead.toISOString(),
  );

  const busySlotsByDate: Map<string, Set<string>> = new Map();
  const allFlights: FlightInfo[] = [];
  const hotelStays: HotelStay[] = [];

  collectGoogleFlightsAndHotels(
    events,
    busySlotsByDate,
    allFlights,
    hotelStays,
    homeAddress,
    timezone,
  );

  const { data: existingTrips } = await adminClient
    .from("trips")
    .select("id, location, start_date, end_date, needs_return_date")
    .eq("user_id", userId);

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

  const slotLocationsByDate = resolveSlotLocations({
    allFlights,
    locationByDate,
    homeAddress,
    timezone,
  });

  const syncRangeStart = getDateString(threeMonthsAgo, timezone);
  const syncRangeEnd = getDateString(threeMonthsAhead, timezone);

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

    incomingEventIds.add(event.id);
    planRowsByEventId.set(event.id, {
      user_id: userId,
      title: event.summary || "Gcal imported event",
      activity: classifyActivity(event.summary),
      date: `${localDateStr}T12:00:00+00:00`,
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

  return { eventsProcessed: events.length, datesUpdated: updatedCount };
}

// ── iCal Sync Logic ─────────────────────────────────────────────────────────

async function syncICalCalendar(
  adminClient: any,
  userId: string,
): Promise<{ eventsProcessed: number; datesUpdated: number }> {
  const { data: connRows, error: connError } = await adminClient
    .from("calendar_connections")
    .select("ical_url")
    .eq("user_id", userId)
    .eq("provider", "ical");

  if (connError || !connRows || connRows.length === 0) {
    throw new Error("iCal not connected");
  }

  const { data: profileData } = await adminClient
    .from("profiles")
    .select("home_address, timezone, location_status")
    .eq("user_id", userId)
    .single();

  const homeAddress: string | null = profileData?.home_address || null;
  // Resolve timezone with same priority as frontend
  let userTimezone: string | undefined = profileData?.timezone || undefined;
  if (!userTimezone) {
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: todayAvail } = await adminClient
      .from("availability")
      .select("location_status, trip_location")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle();
    const locStatus = todayAvail?.location_status ||
      profileData?.location_status || "home";
    if (locStatus === "away" && todayAvail?.trip_location) {
      userTimezone = todayAvail.trip_location;
    }
    if (!userTimezone) {
      userTimezone = homeAddress || "America/New_York";
    }
  }

  const icalUrl = connRows[0].ical_url;
  if (!icalUrl) throw new Error("No iCal URL stored");

  const icsResponse = await fetch(icalUrl);
  if (!icsResponse.ok) throw new Error("Failed to fetch iCal feed");
  const icsText = await icsResponse.text();
  if (!icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error("Invalid iCal data");
  }

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setMonth(rangeStart.getMonth() - 3);
  const rangeEnd = new Date(now);
  rangeEnd.setMonth(rangeEnd.getMonth() + 3);
  const events = parseICS(icsText, rangeStart, rangeEnd);

  const busySlotsByDate: Map<string, Set<string>> = new Map();
  const allFlights: FlightInfo[] = [];
  const hotelStays: HotelStay[] = [];

  collectICalFlightsAndHotels(
    events,
    busySlotsByDate,
    allFlights,
    hotelStays,
    homeAddress,
    userTimezone,
  );

  const { data: existingTrips } = await adminClient
    .from("trips")
    .select("id, location, start_date, end_date, needs_return_date")
    .eq("user_id", userId);

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

  const slotLocationsByDate = resolveSlotLocations({
    allFlights,
    locationByDate,
    homeAddress,
    timezone: userTimezone,
  });

  const syncRangeStart = getDateString(rangeStart, userTimezone);
  const syncRangeEnd = getDateString(rangeEnd, userTimezone);

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

  // ── Sync plans ──
  const incomingEventIds = new Set<string>();
  const planRowsByEventId = new Map<string, any>();

  for (const event of events) {
    let localDateStr: string;
    let hour: number;

    // Prefer the event's own VTIMEZONE/TZID over the viewer's tz so day & HH:mm
    // reflect the event's actual local time (e.g. ClassPass studio timezones).
    const eventTimezone = (!event.isAllDay && event.tzid)
      ? event.tzid
      : userTimezone;

    if (event.isAllDay) {
      localDateStr = event.dtstart.toISOString().split("T")[0];
      hour = 12;
    } else {
      localDateStr = getDateString(event.dtstart, eventTimezone);
      hour = getHourInTimezone(event.dtstart, eventTimezone);
    }

    const icalStartTime = !event.isAllDay
      ? formatTimeHHMM(event.dtstart, eventTimezone)
      : null;
    const icalEndTime = !event.isAllDay && event.dtend
      ? formatTimeHHMM(event.dtend, eventTimezone)
      : null;
    const durationMinutes = event.isAllDay
      ? 60
      : getPlanDurationMinutes(event.dtstart, event.dtend);

    incomingEventIds.add(event.uid);
    planRowsByEventId.set(event.uid, {
      user_id: userId,
      title: (event.summary || "iCal imported event").replace(/\s+/g, " ")
        .trim(),
      activity: classifyActivity(event.summary),
      date: `${localDateStr}T12:00:00+00:00`,
      time_slot: getTimeSlot(hour).replace("_", "-"),
      duration: durationMinutes,
      location: event.location || null,
      source: "ical",
      source_event_id: event.uid,
      source_timezone: eventTimezone || null,
      start_time: icalStartTime,
      end_time: icalEndTime,
    });
  }

  await reconcilePlans({
    adminClient,
    userId,
    source: "ical",
    planRowsByEventId,
    incomingEventIds,
  });

  return { eventsProcessed: events.length, datesUpdated: updatedCount };
}

async function refreshGoogleAccessToken(
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

// ── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, provider } = body;

    if (!userId || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing userId or provider" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let result: { eventsProcessed: number; datesUpdated: number };

    if (provider === "google") {
      result = await syncGoogleCalendar(adminClient, userId);
    } else if (provider === "ical") {
      result = await syncICalCalendar(adminClient, userId);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        synced: true,
        ...result,
        message: `Synced ${result.eventsProcessed} events`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Worker sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, synced: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
