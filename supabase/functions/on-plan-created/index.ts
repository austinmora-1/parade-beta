import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { createLogger, generateRequestId } from '../_shared/logger.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getActivityEmoji(activity: string): string {
  const map: Record<string, string> = {
    drinks: '🍻', 'get-food': '🍽️', concert: '🎵', hiking: '🥾',
    'hanging-out': '✨', museum: '🏛️', sightseeing: '📸',
    'one-on-one': '☕', beach: '🏖️', park: '🌳', gym: '💪',
    yoga: '🧘', running: '🏃', swimming: '🏊', surfing: '🏄',
    movies: '🎬', 'watching-movie': '🎬', 'watching-tv': '📺',
    camping: '⛺', 'video-games': '🎮',
    'sports-event': '🏟️', dancing: '💃', shopping: '🛍️',
    'stand-up-comedy': '😂', 'theme-park': '🎢', facetime: '📱',
    volunteering: '🤝', 'wine-tasting': '🍷', 'listening-music': '🎧',
    reading: '📚', 'walking-dog': '🐕',
  };
  return map[activity] || '📅';
}

function buildPlanInviteHtml(
  inviterName: string,
  planTitle: string,
  planActivity: string,
  planDate: string,
  planTime: string,
  planLocation: string | null,
  planUrl: string,
): string {
  const emoji = getActivityEmoji(planActivity);
  const displayTitle = planTitle || 'a plan';
  const locationRow = planLocation
    ? `<tr><td style="padding:6px 0;vertical-align:top;"><span style="font-size:14px;">📍</span></td><td style="padding:6px 0 6px 8px;font-size:15px;color:#3f3f46;line-height:1.5;">${planLocation}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#ffffff;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background-color:#1a2e22;padding:0;text-align:center;"><img src="https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-wordmark.png" alt="Parade" width="560" style="display:block;width:100%;max-width:560px;height:auto;" /></td></tr>
        <tr><td style="padding:36px 30px;">
          <p style="margin:0 0 20px;font-size:16px;color:#18181b;line-height:1.7;">Hey there 👋</p>
          <p style="margin:0 0 24px;font-size:16px;color:#3f3f46;line-height:1.7;"><strong style="color:#18181b;">${inviterName}</strong> invited you to a plan on Parade:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f5;border-radius:12px;margin:0 0 28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1a2b22;">${emoji} ${displayTitle}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;vertical-align:top;"><span style="font-size:14px;">📅</span></td><td style="padding:6px 0 6px 8px;font-size:15px;color:#3f3f46;line-height:1.5;">${planDate}</td></tr>
                <tr><td style="padding:6px 0;vertical-align:top;"><span style="font-size:14px;">🕐</span></td><td style="padding:6px 0 6px 8px;font-size:15px;color:#3f3f46;line-height:1.5;">${planTime}</td></tr>
                ${locationRow}
              </table>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:0 0 28px;">
              <a href="${planUrl}" style="display:inline-block;background-color:#55C78E;color:#111E16;text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;">View Plan & RSVP</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#8a9b92;">If you weren't expecting this, no worries — just ignore this email.</p>
        </td></tr>
        <tr><td style="padding:0;text-align:center;background-color:#1a6e4a;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-image:url('https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-footer-confetti.png');background-size:cover;background-position:center;">
            <tr><td style="padding:28px 30px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#ffffff;font-weight:500;">Sent via Parade</p>
              <p style="margin:0;font-size:12px;"><a href="https://helloparade.app" style="color:rgba(255,255,255,0.7);text-decoration:none;">helloparade.app</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  'early-morning': 'Early Morning (6–9am)',
  'late-morning': 'Late Morning (9am–12pm)',
  'early-afternoon': 'Early Afternoon (12–3pm)',
  'late-afternoon': 'Late Afternoon (3–6pm)',
  'evening': 'Evening (6–9pm)',
  'late-night': 'Late Night (9pm–12am)',
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
      return new Response(JSON.stringify({ sent: 0, emails_sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up creator name and plan details
    const [creatorResult, planResult] = await Promise.all([
      admin.from('profiles').select('display_name, first_name, last_name').eq('user_id', creator_id).single(),
      admin.from('plans').select('activity, date, time_slot, start_time, end_time, location').eq('id', plan_id).single(),
    ]);

    const cp = creatorResult.data;
    const creatorName = cp?.first_name
      ? (cp.last_name ? `${cp.first_name} ${cp.last_name.charAt(0)}.` : cp.first_name)
      : (cp?.display_name || 'Someone');

    const plan = planResult.data;

    // --- PUSH NOTIFICATIONS ---
    const title = notification_title || 'New Plan Invite! 📅';
    const notifBody = notification_body || `${creatorName} invited you to "${plan_title}"`;
    const url = notification_url || `/plan/${plan_id}`;

    let pushSent = 0;

    const { data: config } = await admin
      .from('push_config')
      .select('vapid_public_key, vapid_private_key')
      .eq('id', 'default')
      .single();

    if (config) {
      webpush.setVapidDetails(
        'mailto:hello@parade.app',
        config.vapid_public_key,
        config.vapid_private_key
      );

      const { data: subscriptions } = await admin
        .from('push_subscriptions')
        .select('*')
        .in('user_id', targetIds);

      if (subscriptions && subscriptions.length > 0) {
        const payload = JSON.stringify({
          title,
          body: notifBody,
          url,
          icon: '/icon-192.png',
          badge: '/favicon.png',
        });

        const staleEndpoints: string[] = [];

        await Promise.allSettled(subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            pushSent++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              staleEndpoints.push(sub.endpoint);
            } else {
              log.warn('Push send error', { endpoint: sub.endpoint.slice(-20), statusCode: err.statusCode });
            }
          }
        }));

        if (staleEndpoints.length > 0) {
          await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
        }
      }
    }

    // --- EMAIL NOTIFICATIONS ---
    let emailsSent = 0;

    if (RESEND_API_KEY && plan) {
      // Get participant emails
      const { data: authUsers } = await admin.auth.admin.listUsers();
      const targetEmails = new Map<string, string>();
      if (authUsers?.users) {
        for (const u of authUsers.users) {
          if (targetIds.includes(u.id) && u.email) {
            targetEmails.set(u.id, u.email);
          }
        }
      }

      if (targetEmails.size > 0) {
        // Format plan details
        const planDate = plan.date
          ? new Date(plan.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
          : 'TBD';

        let planTime = TIME_SLOT_LABELS[plan.time_slot] || plan.time_slot || 'TBD';
        if (plan.start_time) {
          const formatTime = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            const ampm = h >= 12 ? 'pm' : 'am';
            const hr = h % 12 || 12;
            return m ? `${hr}:${m.toString().padStart(2, '0')}${ampm}` : `${hr}${ampm}`;
          };
          planTime = plan.end_time
            ? `${formatTime(plan.start_time)} – ${formatTime(plan.end_time)}`
            : formatTime(plan.start_time);
        }

        const planUrl = `https://helloparade.app/plan/${plan_id}`;
        const emoji = getActivityEmoji(plan.activity);
        const subject = `${creatorName} invited you to "${plan_title}" ${emoji}`;

        const html = buildPlanInviteHtml(
          creatorName,
          plan_title,
          plan.activity,
          planDate,
          planTime,
          plan.location,
          planUrl,
        );

        const plainText = `Hey there!\n\n${creatorName} invited you to a plan on Parade:\n\n${emoji} ${plan_title}\n📅 ${planDate}\n🕐 ${planTime}${plan.location ? `\n📍 ${plan.location}` : ''}\n\nView Plan & RSVP: ${planUrl}\n\nSent via Parade — helloparade.app`;

        await Promise.allSettled(
          Array.from(targetEmails.entries()).map(async ([_, email]) => {
            try {
              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: "Parade <hello@helloparade.app>",
                  reply_to: "hello@helloparade.app",
                  to: [email],
                  subject,
                  headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
                  html,
                  text: plainText,
                }),
              });
              if (res.ok) emailsSent++;
              else log.warn('Email send failed', { email: email.slice(0, 3) + '...', status: res.status });
            } catch (err) {
              log.warn('Email send error', { error: String(err) });
            }
          })
        );
      }
    }

    log.info('Plan post-processing complete', { plan_id, pushSent, emailsSent, targets: targetIds.length });

    return new Response(JSON.stringify({ sent: pushSent, emails_sent: emailsSent }), {
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
