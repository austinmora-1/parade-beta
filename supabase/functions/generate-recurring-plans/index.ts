import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// How many days ahead to generate instances
const LOOKAHEAD_DAYS = 30;

function getNextOccurrences(
  frequency: string,
  dayOfWeek: number,
  weekOfMonth: number | null,
  startsOn: string,
  lastGenerated: string | null,
  endsOn: string | null,
  maxOccurrences: number | null,
  existingCount: number
): string[] {
  const dates: string[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lookahead = new Date(today);
  lookahead.setDate(lookahead.getDate() + LOOKAHEAD_DAYS);

  const startDate = new Date(startsOn + "T00:00:00");
  const fromDate = lastGenerated
    ? new Date(lastGenerated + "T00:00:00")
    : new Date(Math.max(startDate.getTime(), today.getTime()));

  // Move fromDate to the day after lastGenerated to avoid duplicates
  if (lastGenerated) {
    fromDate.setDate(fromDate.getDate() + 1);
  }

  const endDate = endsOn ? new Date(endsOn + "T00:00:00") : null;
  let occurrenceCount = existingCount;

  // Iterate day by day from fromDate to lookahead
  const cursor = new Date(fromDate);
  while (cursor <= lookahead) {
    if (endDate && cursor > endDate) break;
    if (maxOccurrences && occurrenceCount >= maxOccurrences) break;
    if (cursor < startDate) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const cursorDay = cursor.getDay(); // 0=Sun

    if (frequency === "weekly" && cursorDay === dayOfWeek) {
      dates.push(formatDate(cursor));
      occurrenceCount++;
    } else if (frequency === "biweekly" && cursorDay === dayOfWeek) {
      // Check if correct week: count weeks since start
      const diffMs = cursor.getTime() - startDate.getTime();
      const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks % 2 === 0) {
        dates.push(formatDate(cursor));
        occurrenceCount++;
      }
    } else if (frequency === "monthly" && cursorDay === dayOfWeek && weekOfMonth) {
      // Check week-of-month
      const dayOfMonth = cursor.getDate();
      const weekNum = Math.ceil(dayOfMonth / 7);
      if (weekNum === weekOfMonth) {
        dates.push(formatDate(cursor));
        occurrenceCount++;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active recurring plans
    const { data: recurringPlans, error: fetchError } = await supabase
      .from("recurring_plans")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    let totalGenerated = 0;

    for (const rp of recurringPlans || []) {
      // Count existing instances
      const { count } = await supabase
        .from("plans")
        .select("id", { count: "exact", head: true })
        .eq("recurring_plan_id", rp.id);

      const dates = getNextOccurrences(
        rp.frequency,
        rp.day_of_week ?? 0,
        rp.week_of_month,
        rp.starts_on,
        rp.last_generated_date,
        rp.ends_on,
        rp.max_occurrences,
        count || 0
      );

      if (dates.length === 0) continue;

      // Create plan instances
      const planRows = dates.map((dateStr) => ({
        user_id: rp.user_id,
        title: rp.title,
        activity: rp.activity,
        date: `${dateStr}T12:00:00+00:00`,
        time_slot: rp.time_slot,
        duration: rp.duration,
        start_time: rp.start_time,
        end_time: rp.end_time,
        location: rp.location,
        notes: rp.notes,
        status: rp.status,
        feed_visibility: rp.feed_visibility,
        source_timezone: rp.source_timezone,
        recurring_plan_id: rp.id,
      }));

      const { error: insertError } = await supabase
        .from("plans")
        .insert(planRows);

      if (insertError) {
        console.error(`Error generating plans for recurring ${rp.id}:`, insertError);
        continue;
      }

      // Update last_generated_date
      const lastDate = dates[dates.length - 1];
      await supabase
        .from("recurring_plans")
        .update({ last_generated_date: lastDate })
        .eq("id", rp.id);

      totalGenerated += dates.length;
    }

    return new Response(
      JSON.stringify({ success: true, generated: totalGenerated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-recurring-plans:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
