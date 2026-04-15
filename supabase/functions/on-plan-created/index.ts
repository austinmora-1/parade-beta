import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { createLogger, generateRequestId } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const requestId = generateRequestId();
  const log = createLogger('on-plan-created', requestId);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { plan_id, creator_id, participant_ids, plan_title, notification_title, notification_body, notification_url } = body;

    if (!plan_id || !creator_id || !plan_title) {
      return new Response(JSON.stringify({ error: 'plan_id, creator_id, and plan_title required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetIds: string[] = (participant_ids || []).filter((id: string) => id !== creator_id);
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up creator name server-side
    const { data: creatorProfile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('user_id', creator_id)
      .single();
    const creatorName = creatorProfile?.display_name || 'Someone';

    // Build notification payload
    const title = notification_title || 'New Plan Invite! 📅';
    const notifBody = notification_body || `${creatorName} invited you to "${plan_title}"`;
    const url = notification_url || `/plan/${plan_id}`;

    // Get VAPID config
    const { data: config } = await admin
      .from('push_config')
      .select('vapid_public_key, vapid_private_key')
      .eq('id', 'default')
      .single();

    if (!config) {
      log.warn('Push not configured, skipping notifications');
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(
      'mailto:hello@parade.app',
      config.vapid_public_key,
      config.vapid_private_key
    );

    // Get all subscriptions for target users
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetIds);

    if (!subscriptions || subscriptions.length === 0) {
      log.info('No push subscriptions found', { plan_id, targets: targetIds.length });
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title,
      body: notifBody,
      url,
      icon: '/icon-192.png',
      badge: '/favicon.png',
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    await Promise.allSettled(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          log.warn('Push send error', { endpoint: sub.endpoint.slice(-20), statusCode: err.statusCode });
        }
      }
    }));

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
    }

    log.info('Plan post-processing complete', { plan_id, sent, targets: targetIds.length });

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('on-plan-created failed', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
