import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map time slots to start hours (used when no specific start_time is set)
const TIME_SLOT_START_HOUR: Record<string, number> = {
  'early-morning': 6,
  'late-morning': 9,
  'early-afternoon': 12,
  'late-afternoon': 15,
  'evening': 18,
  'late-night': 22,
};

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

    // Get today's date in ISO format for querying
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch all plans for today that have push-subscribed users
    const { data: todayPlans, error: plansError } = await admin
      .from('plans')
      .select('id, user_id, title, date, time_slot, start_time, activity')
      .gte('date', todayStart.toISOString())
      .lte('date', todayEnd.toISOString());

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return new Response(JSON.stringify({ error: plansError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!todayPlans || todayPlans.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine which plans are starting in ~25-35 minutes
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const windowStart = nowMinutes + 25;
    const windowEnd = nowMinutes + 35;

    const plansInWindow = todayPlans.filter((plan) => {
      let planStartMinutes: number;

      if (plan.start_time) {
        // start_time is "HH:MM:SS" or "HH:MM" format
        const parts = plan.start_time.split(':').map(Number);
        planStartMinutes = parts[0] * 60 + (parts[1] || 0);
      } else {
        // Use time slot start hour
        const slotKey = plan.time_slot;
        const startHour = TIME_SLOT_START_HOUR[slotKey];
        if (startHour === undefined) return false;
        planStartMinutes = startHour * 60;
      }

      return planStartMinutes >= windowStart && planStartMinutes <= windowEnd;
    });

    if (plansInWindow.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get plan IDs to check which reminders were already sent
    const planIds = plansInWindow.map((p) => p.id);

    const { data: alreadySent } = await admin
      .from('plan_reminders_sent')
      .select('plan_id, user_id')
      .in('plan_id', planIds);

    const sentSet = new Set(
      (alreadySent || []).map((r) => `${r.plan_id}:${r.user_id}`)
    );

    // For each plan, collect all users who should be notified:
    // 1. The plan owner
    // 2. All participants
    let totalSent = 0;
    const remindersToInsert: { plan_id: string; user_id: string }[] = [];

    for (const plan of plansInWindow) {
      const usersToNotify = new Set<string>();
      usersToNotify.add(plan.user_id);

      // Get participants
      const { data: participants } = await admin
        .from('plan_participants')
        .select('friend_id')
        .eq('plan_id', plan.id)
        .eq('status', 'accepted');

      if (participants) {
        for (const p of participants) {
          usersToNotify.add(p.friend_id);
        }
      }

      // Check user preference for plan_reminders
      const userIds = Array.from(usersToNotify);
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, plan_reminders')
        .in('user_id', userIds);

      const reminderEnabledUsers = new Set(
        (profiles || [])
          .filter((p) => p.plan_reminders !== false)
          .map((p) => p.user_id)
      );

      for (const userId of usersToNotify) {
        const key = `${plan.id}:${userId}`;
        if (sentSet.has(key)) continue; // Already sent
        if (!reminderEnabledUsers.has(userId)) continue; // User opted out

        // Get push subscriptions for this user
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId);

        if (!subs || subs.length === 0) {
          // Still mark as sent to avoid retrying
          remindersToInsert.push({ plan_id: plan.id, user_id: userId });
          continue;
        }

        const startTimeDisplay = plan.start_time
          ? formatTime12(plan.start_time)
          : null;

        const payload = JSON.stringify({
          title: `📅 ${plan.title}`,
          body: startTimeDisplay
            ? `Starting in 30 minutes at ${startTimeDisplay}`
            : `Starting soon`,
          url: `/plan/${plan.id}`,
          icon: '/icon-192.png',
          badge: '/favicon.png',
          tag: `plan-reminder-${plan.id}`,
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );
            totalSent++;
          } catch (err: any) {
            console.error('Push error:', err.statusCode, err.message);
            if (err.statusCode === 404 || err.statusCode === 410) {
              await admin
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
            }
          }
        }

        remindersToInsert.push({ plan_id: plan.id, user_id: userId });
      }
    }

    // Mark reminders as sent
    if (remindersToInsert.length > 0) {
      await admin.from('plan_reminders_sent').insert(remindersToInsert);
    }

    console.log(`Plan reminders: processed ${plansInWindow.length} plans, sent ${totalSent} notifications`);

    return new Response(
      JSON.stringify({ processed: plansInWindow.length, sent: totalSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Plan reminders error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatTime12(time: string): string {
  const parts = time.split(':').map(Number);
  const h = parts[0];
  const m = parts[1] || 0;
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}
