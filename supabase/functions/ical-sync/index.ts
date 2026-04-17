import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  classifyActivity,
  extractFlightDepartureCity,
  extractFlightDestination,
  extractHotelLocation,
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
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
    } catch { /* no body */ }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get the iCal URL from calendar_connections
    const { data: connRows, error: connError } = await adminClient
      .from("calendar_connections")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provider", "ical");

    if (connError || !connRows || connRows.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Apple Calendar not connected",
          connected: false,
          synced: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const icalUrl = connRows[0].access_token;
    if (!icalUrl) {
      return new Response(
        JSON.stringify({
          error: "No iCal URL stored",
          connected: false,
          synced: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch the ICS feed
    const icsResponse = await fetch(icalUrl);
    if (!icsResponse.ok) {
      console.error(
        "iCal fetch error:",
        icsResponse.status,
        await icsResponse.text(),
      );
      return new Response(
        JSON.stringify({
          error: "Failed to fetch iCal feed. The URL may have expired.",
          connected: true,
          synced: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const icsText = await icsResponse.text();
    if (!icsText.includes("BEGIN:VCALENDAR")) {
      return new Response(
        JSON.stringify({
          error: "Invalid iCal data",
          connected: true,
          synced: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse events for ±3 months
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setMonth(rangeStart.getMonth() - 3);
    const rangeEnd = new Date(now);
    rangeEnd.setMonth(rangeEnd.getMonth() + 3);
    const events = parseICS(icsText, rangeStart, rangeEnd);

    // Fetch user's home address for flight detection
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("home_address, timezone, location_status")
      .eq("user_id", userId)
      .single();
    const homeAddress: string | null = profileData?.home_address || null;
    // Resolve timezone with same priority as frontend
    let userTimezone = timezone || profileData?.timezone;
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

    // ── Collect busy slots, flights, hotels ────────────────────────────────
    const busySlotsByDate: Map<string, Set<string>> = new Map();
    const allFlights: FlightInfo[] = [];
    const hotelStays: HotelStay[] = [];

    for (const event of events) {
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
              startDate: startDateStr,
              endDate: endDateStr,
              city: hotelCity,
            });
          }
        }
        continue;
      }

      const dates = getEventDates(event.dtstart, event.dtend, userTimezone);
      for (const date of dates) {
        if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set());
        getEventTimeSlots(event.dtstart, event.dtend, userTimezone).forEach(
          (slot) => busySlotsByDate.get(date)!.add(slot),
        );
      }

      if (isFlightEvent(event.summary)) {
        const city = resolveToCity(extractFlightDestination(event.summary));
        const departureCity = resolveToCity(
          extractFlightDepartureCity(event.summary),
        );
        const isReturn = city ? isCityMatchingHome(city, homeAddress) : false;
        const dateStr = getDateString(event.dtstart, userTimezone);
        const ts = event.dtstart.getTime();
        const arrivalTs = event.dtend.getTime();
        console.log(
          `[FLIGHT] "${event.summary}" | dtstart=${event.dtstart.toISOString()} | ts=${ts} | dateStr=${dateStr} | city=${city} | departureCity=${departureCity} | isReturn=${isReturn}`,
        );
        allFlights.push({
          date: dateStr,
          timestamp: ts,
          arrivalTimestamp: arrivalTs,
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
    }

    // ── Resolve locations using shared segment-based logic ──────────────────
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

    // ── Sync plans using shared reconciliation ────────────────────────────
    const incomingEventIds = new Set<string>();
    const planRowsByEventId = new Map<string, any>();

    for (const event of events) {
      let localDateStr: string;
      let hour: number;

      // Prefer the event's own VTIMEZONE/TZID when present (e.g. ClassPass tags
      // each studio class with the studio's local timezone). Fall back to the
      // viewer's resolved timezone otherwise. This ensures the plan's calendar
      // day and HH:mm reflect the event's actual local time, not the viewer's.
      const eventTimezone = (!event.isAllDay && event.tzid)
        ? event.tzid
        : userTimezone;

      if (event.isAllDay) {
        localDateStr = event.dtstart.toISOString().split("T")[0];
        hour = 12;
      } else {
        hour = getHourInTimezone(event.dtstart, eventTimezone);
        localDateStr = getDateString(event.dtstart, eventTimezone);
      }

      const timeSlot = getTimeSlot(hour).replace("_", "-");
      const planDate = `${localDateStr}T12:00:00+00:00`;
      const startTimeStr = event.isAllDay
        ? null
        : formatTimeHHMM(event.dtstart, eventTimezone);
      const endTimeStr = event.isAllDay
        ? null
        : formatTimeHHMM(event.dtend, eventTimezone);
      const durationMinutes = event.isAllDay
        ? 60
        : getPlanDurationMinutes(event.dtstart, event.dtend);

      incomingEventIds.add(event.uid);
      planRowsByEventId.set(event.uid, {
        user_id: userId,
        title: (event.summary || "iCal imported event").replace(/\s+/g, " ")
          .trim(),
        activity: classifyActivity(event.summary),
        date: planDate,
        time_slot: timeSlot,
        duration: durationMinutes,
        location: event.location || null,
        source: "ical",
        source_event_id: event.uid,
        start_time: startTimeStr,
        end_time: endTimeStr,
        source_timezone: eventTimezone || null,
      });
    }

    await reconcilePlans({
      adminClient,
      userId,
      source: "ical",
      planRowsByEventId,
      incomingEventIds,
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
