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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate
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
    const { title, body: notifBody, url, image } = body;

    // Support both single user_id and array of user_ids
    let userIds: string[] = [];
    if (body.user_ids && Array.isArray(body.user_ids)) {
      userIds = body.user_ids;
    } else if (body.user_id) {
      userIds = [body.user_id];
    }

    if (userIds.length === 0 || !title) {
      return new Response(JSON.stringify({ error: 'user_id(s) and title required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter out self
    userIds = userIds.filter(id => id !== user.id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get VAPID keys
    const { data: config } = await adminClient
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

    // Get all subscriptions for ALL target users in one query
    const { data: subscriptions } = await adminClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notifPayload: Record<string, string> = {
      title,
      body: notifBody || '',
      url: url || '/',
      icon: '/icon-192.png',
      badge: '/favicon.png',
    };
    if (image) {
      notifPayload.image = image;
    }
    const payload = JSON.stringify(notifPayload);

    let sent = 0;
    const staleEndpoints: { user_id: string; endpoint: string }[] = [];

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        console.error('Push send error:', err.statusCode, err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpoints.push({ user_id: sub.user_id, endpoint: sub.endpoint });
        }
      }
    }));

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await adminClient
        .from('push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints.map(s => s.endpoint));
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Send push error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
