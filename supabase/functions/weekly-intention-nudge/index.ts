import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Calculate upcoming Monday (next week_start)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    // Next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
    const weekStart = nextMonday.toISOString().split('T')[0];

    // Get VAPID keys
    const { data: config } = await admin
      .from('push_config')
      .select('vapid_public_key, vapid_private_key')
      .eq('id', 'default')
      .single();

    if (!config) {
      return new Response(JSON.stringify({ error: 'Push not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(
      'mailto:hello@parade.app',
      config.vapid_public_key,
      config.vapid_private_key
    );

    // Get all users with push subscriptions who have plan_reminders enabled
    const { data: subscribers } = await admin
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth');

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique user IDs
    const userIds = [...new Set(subscribers.map(s => s.user_id))];

    // Check which users already set intentions for the upcoming week
    const { data: existingIntentions } = await admin
      .from('weekly_intentions')
      .select('user_id')
      .eq('week_start', weekStart)
      .in('user_id', userIds);

    const alreadySet = new Set((existingIntentions || []).map(i => i.user_id));

    // Check notification preferences - respect plan_reminders setting
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, plan_reminders, timezone')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Filter to users who haven't set intentions and have reminders on
    const eligibleSubs = subscribers.filter(sub => {
      if (alreadySet.has(sub.user_id)) return false;
      const profile = profileMap.get(sub.user_id);
      if (profile && profile.plan_reminders === false) return false;
      // Check if it's afternoon (1-5 PM) in user's timezone
      if (profile?.timezone) {
        try {
          const userTime = new Date(now.toLocaleString('en-US', { timeZone: profile.timezone }));
          const hour = userTime.getHours();
          if (hour < 13 || hour >= 17) return false;
        } catch { /* fall through */ }
      }
      return true;
    });

    const payload = JSON.stringify({
      title: 'Plan your week! 🗓️',
      body: 'Set your social intentions for the week ahead',
      url: '/',
      icon: '/icon-192.png',
      badge: '/favicon.png',
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(eligibleSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }));

    if (staleEndpoints.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
    }

    return new Response(JSON.stringify({ sent, eligible: eligibleSubs.length, weekStart }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Weekly intention nudge error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
