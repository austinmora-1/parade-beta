import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TIME_SLOT_START_HOUR: Record<string, number> = {
  'early-morning': 6,
  'late-morning': 9,
  'early-afternoon': 12,
  'late-afternoon': 15,
  'evening': 18,
  'late-night': 22,
};

// ── City → IANA timezone map ──
const CITY_TZ: Record<string, string> = {
  'new york': 'America/New_York', nyc: 'America/New_York', manhattan: 'America/New_York',
  brooklyn: 'America/New_York', queens: 'America/New_York', bronx: 'America/New_York',
  boston: 'America/New_York', philadelphia: 'America/New_York', philly: 'America/New_York',
  washington: 'America/New_York', dc: 'America/New_York', miami: 'America/New_York',
  atlanta: 'America/New_York', charlotte: 'America/New_York', orlando: 'America/New_York',
  tampa: 'America/New_York', jacksonville: 'America/New_York', pittsburgh: 'America/New_York',
  baltimore: 'America/New_York', raleigh: 'America/New_York', richmond: 'America/New_York',
  detroit: 'America/New_York', cleveland: 'America/New_York', columbus: 'America/New_York',
  cincinnati: 'America/New_York', indianapolis: 'America/New_York',
  hartford: 'America/New_York', providence: 'America/New_York', newark: 'America/New_York',
  'jersey city': 'America/New_York', hoboken: 'America/New_York', stamford: 'America/New_York',
  buffalo: 'America/New_York', rochester: 'America/New_York', syracuse: 'America/New_York',
  albany: 'America/New_York', savannah: 'America/New_York', charleston: 'America/New_York',
  nashville: 'America/New_York', knoxville: 'America/New_York', louisville: 'America/New_York',
  lexington: 'America/New_York', norfolk: 'America/New_York', 'virginia beach': 'America/New_York',
  chicago: 'America/Chicago', houston: 'America/Chicago', dallas: 'America/Chicago',
  'san antonio': 'America/Chicago', austin: 'America/Chicago', 'fort worth': 'America/Chicago',
  memphis: 'America/Chicago', milwaukee: 'America/Chicago', minneapolis: 'America/Chicago',
  'st. paul': 'America/Chicago', 'saint paul': 'America/Chicago',
  'kansas city': 'America/Chicago', 'st. louis': 'America/Chicago', 'saint louis': 'America/Chicago',
  'new orleans': 'America/Chicago', 'oklahoma city': 'America/Chicago', omaha: 'America/Chicago',
  'des moines': 'America/Chicago', madison: 'America/Chicago', birmingham: 'America/Chicago',
  'little rock': 'America/Chicago', 'baton rouge': 'America/Chicago', tulsa: 'America/Chicago',
  wichita: 'America/Chicago',
  denver: 'America/Denver', 'colorado springs': 'America/Denver', boulder: 'America/Denver',
  'salt lake city': 'America/Denver', slc: 'America/Denver', albuquerque: 'America/Denver',
  'el paso': 'America/Denver', boise: 'America/Denver', billings: 'America/Denver',
  cheyenne: 'America/Denver', tucson: 'America/Denver',
  phoenix: 'America/Phoenix', scottsdale: 'America/Phoenix', tempe: 'America/Phoenix',
  mesa: 'America/Phoenix', chandler: 'America/Phoenix', gilbert: 'America/Phoenix',
  'glendale az': 'America/Phoenix', flagstaff: 'America/Phoenix', sedona: 'America/Phoenix',
  'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles', sf: 'America/Los_Angeles',
  'san diego': 'America/Los_Angeles', 'san jose': 'America/Los_Angeles',
  seattle: 'America/Los_Angeles', portland: 'America/Los_Angeles',
  sacramento: 'America/Los_Angeles', oakland: 'America/Los_Angeles',
  'long beach': 'America/Los_Angeles', fresno: 'America/Los_Angeles',
  'las vegas': 'America/Los_Angeles', vegas: 'America/Los_Angeles',
  reno: 'America/Los_Angeles', 'santa monica': 'America/Los_Angeles',
  pasadena: 'America/Los_Angeles', berkeley: 'America/Los_Angeles',
  'palo alto': 'America/Los_Angeles', 'mountain view': 'America/Los_Angeles',
  'santa barbara': 'America/Los_Angeles', irvine: 'America/Los_Angeles',
  anaheim: 'America/Los_Angeles', tacoma: 'America/Los_Angeles', eugene: 'America/Los_Angeles',
  anchorage: 'America/Anchorage', fairbanks: 'America/Anchorage', juneau: 'America/Anchorage',
  honolulu: 'Pacific/Honolulu', hawaii: 'Pacific/Honolulu', maui: 'Pacific/Honolulu',
  london: 'Europe/London', paris: 'Europe/Paris', berlin: 'Europe/Berlin',
  amsterdam: 'Europe/Amsterdam', rome: 'Europe/Rome', madrid: 'Europe/Madrid',
  barcelona: 'Europe/Madrid', lisbon: 'Europe/Lisbon', dublin: 'Europe/Dublin',
  zurich: 'Europe/Zurich', vienna: 'Europe/Vienna', prague: 'Europe/Prague',
  warsaw: 'Europe/Warsaw', copenhagen: 'Europe/Copenhagen', stockholm: 'Europe/Stockholm',
  oslo: 'Europe/Oslo', helsinki: 'Europe/Helsinki', athens: 'Europe/Athens',
  istanbul: 'Europe/Istanbul', moscow: 'Europe/Moscow',
  dubai: 'Asia/Dubai', 'abu dhabi': 'Asia/Dubai',
  mumbai: 'Asia/Kolkata', delhi: 'Asia/Kolkata', bangalore: 'Asia/Kolkata', kolkata: 'Asia/Kolkata',
  bangkok: 'Asia/Bangkok', singapore: 'Asia/Singapore', 'hong kong': 'Asia/Hong_Kong',
  tokyo: 'Asia/Tokyo', osaka: 'Asia/Tokyo', seoul: 'Asia/Seoul',
  shanghai: 'Asia/Shanghai', beijing: 'Asia/Shanghai',
  sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne',
  brisbane: 'Australia/Brisbane', perth: 'Australia/Perth',
  auckland: 'Pacific/Auckland', toronto: 'America/Toronto', montreal: 'America/Toronto',
  vancouver: 'America/Vancouver', calgary: 'America/Edmonton', edmonton: 'America/Edmonton',
  'mexico city': 'America/Mexico_City', cancun: 'America/Cancun',
  'sao paulo': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires',
  lima: 'America/Lima', bogota: 'America/Bogota', santiago: 'America/Santiago',
  havana: 'America/Havana', 'san juan': 'America/Puerto_Rico', caribbean: 'America/Puerto_Rico',
};

function normalizeCity(location: string): string {
  return location
    .toLowerCase()
    .replace(/,?\s*(usa|us|united states|u\.s\.a?\.?)$/i, '')
    .replace(/,?\s*[A-Z]{2}\s*\d{5}(-\d{4})?$/, '')
    .replace(/,?\s*\d{5}(-\d{4})?$/, '')
    .replace(/,?\s*[A-Z]{2}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTimezoneForCity(location: string | null | undefined): string {
  const FALLBACK = 'America/New_York';
  if (!location) return FALLBACK;
  const normalized = normalizeCity(location);
  if (CITY_TZ[normalized]) return CITY_TZ[normalized];
  const parts = normalized.split(',').map(s => s.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    if (CITY_TZ[parts[i]]) return CITY_TZ[parts[i]];
  }
  if (parts.length > 1 && CITY_TZ[parts[0]]) return CITY_TZ[parts[0]];
  for (const [city, tz] of Object.entries(CITY_TZ)) {
    if (normalized.includes(city)) return tz;
  }
  return FALLBACK;
}

function getNowInTimezone(tz: string): { hours: number; minutes: number; dateStr: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric', minute: 'numeric', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);

  let h = 0, m = 0, year = '', month = '', day = '';
  for (const p of parts) {
    if (p.type === 'hour') h = Number(p.value);
    if (p.type === 'minute') m = Number(p.value);
    if (p.type === 'year') year = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
  }
  if (h === 24) h = 0;
  return { hours: h, minutes: m, dateStr: `${year}-${month}-${day}` };
}

function resolveUserTimezone(
  profile: { home_address: string | null; location_status: string | null } | undefined,
  todayAvail: { location_status: string | null; trip_location: string | null } | undefined,
): string {
  const locStatus = todayAvail?.location_status ?? profile?.location_status ?? 'home';
  if (locStatus === 'away' && todayAvail?.trip_location) {
    return getTimezoneForCity(todayAvail.trip_location);
  }
  return getTimezoneForCity(profile?.home_address);
}

function formatTime12(time: string): string {
  const parts = time.split(':').map(Number);
  const h = parts[0];
  const m = parts[1] || 0;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m > 0 ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get VAPID keys
    const { data: pushConfig } = await admin
      .from('push_config')
      .select('vapid_public_key, vapid_private_key')
      .eq('id', 'default')
      .single();

    if (!pushConfig) {
      return new Response(JSON.stringify({ error: 'Push not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(
      'mailto:hello@parade.app',
      pushConfig.vapid_public_key,
      pushConfig.vapid_private_key
    );

    // Wide window for timezone coverage
    const now = new Date();
    const yesterdayStart = new Date(now);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    yesterdayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 1);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    // Fetch candidate plans
    const { data: candidatePlans, error: plansError } = await admin
      .from('plans')
      .select('id, user_id, title, date, time_slot, start_time, activity')
      .gte('date', yesterdayStart.toISOString())
      .lte('date', tomorrowEnd.toISOString());

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return new Response(JSON.stringify({ error: plansError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!candidatePlans || candidatePlans.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect owner IDs and fetch profiles + availability in parallel
    const ownerIds = [...new Set(candidatePlans.map(p => p.user_id))];
    const [profilesRes, availRes] = await Promise.all([
      admin.from('profiles').select('user_id, home_address, location_status').in('user_id', ownerIds),
      admin.from('availability').select('user_id, location_status, trip_location, date').in('user_id', ownerIds),
    ]);

    const profileMap = new Map<string, { home_address: string | null; location_status: string | null }>();
    for (const p of (profilesRes.data || [])) {
      profileMap.set(p.user_id, { home_address: p.home_address, location_status: p.location_status });
    }

    const availByUser = new Map<string, Array<{ location_status: string | null; trip_location: string | null; date: string }>>();
    for (const a of (availRes.data || [])) {
      if (!availByUser.has(a.user_id)) availByUser.set(a.user_id, []);
      availByUser.get(a.user_id)!.push(a);
    }

    // Filter plans to those in the 25-35 min reminder window
    const plansInWindow: typeof candidatePlans = [];

    for (const plan of candidatePlans) {
      const profile = profileMap.get(plan.user_id);
      const prelimTz = getTimezoneForCity(profile?.home_address);
      const localNow = getNowInTimezone(prelimTz);
      const userAvails = availByUser.get(plan.user_id) || [];
      const todayAvail = userAvails.find(a => a.date === localNow.dateStr);
      const userTz = resolveUserTimezone(profile, todayAvail ?? undefined);
      const localTime = getNowInTimezone(userTz);

      const planDate = new Date(plan.date);
      const planDateStr = `${planDate.getUTCFullYear()}-${String(planDate.getUTCMonth() + 1).padStart(2, '0')}-${String(planDate.getUTCDate()).padStart(2, '0')}`;
      if (planDateStr !== localTime.dateStr) continue;

      let planStartMinutes: number;
      if (plan.start_time) {
        const parts = plan.start_time.split(':').map(Number);
        planStartMinutes = parts[0] * 60 + (parts[1] || 0);
      } else {
        const startHour = TIME_SLOT_START_HOUR[plan.time_slot];
        if (startHour === undefined) continue;
        planStartMinutes = startHour * 60;
      }

      const localNowMinutes = localTime.hours * 60 + localTime.minutes;
      const diff = planStartMinutes - localNowMinutes;
      if (diff >= 25 && diff <= 35) {
        plansInWindow.push(plan);
      }
    }

    if (plansInWindow.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const planIds = plansInWindow.map(p => p.id);

    // ── BATCH FETCH: participants, profiles, subscriptions, already-sent ──
    const [alreadySentRes, allParticipantsRes] = await Promise.all([
      admin.from('plan_reminders_sent').select('plan_id, user_id').in('plan_id', planIds),
      admin.from('plan_participants').select('plan_id, friend_id').in('plan_id', planIds).eq('status', 'accepted'),
    ]);

    const sentSet = new Set(
      (alreadySentRes.data || []).map(r => `${r.plan_id}:${r.user_id}`)
    );

    // Build planId → participant set
    const participantsByPlan = new Map<string, Set<string>>();
    for (const plan of plansInWindow) {
      if (!participantsByPlan.has(plan.id)) participantsByPlan.set(plan.id, new Set());
      participantsByPlan.get(plan.id)!.add(plan.user_id);
    }
    for (const pp of (allParticipantsRes.data || [])) {
      participantsByPlan.get(pp.plan_id)?.add(pp.friend_id);
    }

    // Collect all user IDs that need profiles and subscriptions
    const allUserIds = new Set<string>();
    for (const [, members] of participantsByPlan) {
      for (const uid of members) allUserIds.add(uid);
    }
    const allUserIdsArr = Array.from(allUserIds);

    // Batch fetch profiles and push subscriptions
    const [profilesForReminders, subsRes] = await Promise.all([
      admin.from('profiles').select('user_id, plan_reminders').in('user_id', allUserIdsArr),
      admin.from('push_subscriptions').select('*').in('user_id', allUserIdsArr),
    ]);

    const reminderEnabledUsers = new Set(
      (profilesForReminders.data || [])
        .filter(p => p.plan_reminders !== false)
        .map(p => p.user_id)
    );

    // Build userId → subscriptions map
    const subsByUser = new Map<string, Array<any>>();
    for (const sub of (subsRes.data || [])) {
      if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
      subsByUser.get(sub.user_id)!.push(sub);
    }

    // ── SEND NOTIFICATIONS ──
    let totalSent = 0;
    const remindersToInsert: { plan_id: string; user_id: string }[] = [];
    const expiredSubIds: string[] = [];
    const pushPromises: Promise<void>[] = [];

    for (const plan of plansInWindow) {
      const members = participantsByPlan.get(plan.id) || new Set();

      for (const userId of members) {
        const key = `${plan.id}:${userId}`;
        if (sentSet.has(key)) continue;
        if (!reminderEnabledUsers.has(userId)) continue;

        remindersToInsert.push({ plan_id: plan.id, user_id: userId });

        const subs = subsByUser.get(userId);
        if (!subs || subs.length === 0) continue;

        const startTimeDisplay = plan.start_time ? formatTime12(plan.start_time) : null;
        const payload = JSON.stringify({
          title: `📅 ${plan.title}`,
          body: startTimeDisplay ? `Starting in 30 minutes at ${startTimeDisplay}` : `Starting soon`,
          url: `/plan/${plan.id}`,
          icon: '/icon-192.png',
          badge: '/favicon.png',
          tag: `plan-reminder-${plan.id}`,
        });

        for (const sub of subs) {
          pushPromises.push(
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            ).then(() => { totalSent++; })
            .catch((err: any) => {
              if (err.statusCode === 404 || err.statusCode === 410) {
                expiredSubIds.push(sub.id);
              }
            })
          );
        }
      }
    }

    // Send all push notifications in parallel (batches of 50)
    for (let i = 0; i < pushPromises.length; i += 50) {
      await Promise.allSettled(pushPromises.slice(i, i + 50));
    }

    // Batch operations: insert reminders sent, delete expired subs
    const [insertResult] = await Promise.all([
      remindersToInsert.length > 0
        ? admin.from('plan_reminders_sent').insert(remindersToInsert)
        : Promise.resolve(null),
      expiredSubIds.length > 0
        ? admin.from('push_subscriptions').delete().in('id', expiredSubIds)
        : Promise.resolve(null),
    ]);

    console.log(`Plan reminders: processed ${plansInWindow.length} plans, sent ${totalSent} notifications`);

    return new Response(
      JSON.stringify({ processed: plansInWindow.length, sent: totalSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Plan reminders error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
