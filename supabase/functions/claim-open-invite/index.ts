import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  open_invite_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as RequestBody;
    if (!body.open_invite_id || typeof body.open_invite_id !== 'string') {
      return json({ error: 'open_invite_id required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load invite
    const { data: invite, error: inviteErr } = await admin
      .from('open_invites')
      .select('*')
      .eq('id', body.open_invite_id)
      .single();

    if (inviteErr || !invite) return json({ error: 'Invite not found' }, 404);
    if (invite.status !== 'open') return json({ error: 'Invite no longer open' }, 410);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ error: 'Invite expired' }, 410);
    }
    if (invite.user_id === userId) {
      return json({ error: 'Cannot claim your own invite' }, 400);
    }

    // Record the response (idempotent upsert)
    const { error: respErr } = await admin
      .from('open_invite_responses')
      .upsert(
        {
          open_invite_id: invite.id,
          user_id: userId,
          response: 'claimed',
        },
        { onConflict: 'open_invite_id,user_id' }
      );
    if (respErr) {
      console.error('[claim-open-invite] response error', respErr);
      return json({ error: respErr.message }, 500);
    }

    let resultPlanId: string | null = invite.claimed_plan_id ?? null;
    let resultTripId: string | null = invite.trip_id ?? null;

    // ---- Branch A: anchored to an existing plan ----
    if (invite.plan_id) {
      // Add responder as plan participant if not already
      const { data: existing } = await admin
        .from('plan_participants')
        .select('id, status')
        .eq('plan_id', invite.plan_id)
        .eq('friend_id', userId)
        .maybeSingle();

      if (!existing) {
        await admin.from('plan_participants').insert({
          plan_id: invite.plan_id,
          friend_id: userId,
          status: 'accepted',
          role: 'participant',
          responded_at: new Date().toISOString(),
        });
      } else if (existing.status !== 'accepted') {
        await admin
          .from('plan_participants')
          .update({ status: 'accepted', responded_at: new Date().toISOString() })
          .eq('id', existing.id);
      }
      resultPlanId = invite.plan_id;
    }
    // ---- Branch B: anchored to an existing trip ----
    else if (invite.trip_id) {
      // Add responder to trip_participants if not already
      const { data: existingTp } = await admin
        .from('trip_participants')
        .select('id')
        .eq('trip_id', invite.trip_id)
        .eq('friend_user_id', userId)
        .maybeSingle();

      if (!existingTp) {
        await admin.from('trip_participants').insert({
          trip_id: invite.trip_id,
          friend_user_id: userId,
        });
      }

      // Spawn a plan tied to the open-invite details so they have a concrete hangout
      const { data: newPlan, error: planErr } = await admin
        .from('plans')
        .insert({
          user_id: invite.user_id,
          title: invite.title,
          activity: invite.activity,
          date: invite.date,
          time_slot: invite.time_slot,
          start_time: invite.start_time,
          end_time: invite.end_time,
          duration: invite.duration,
          location: invite.location,
          notes: invite.notes,
          status: 'confirmed',
          feed_visibility: 'private',
        })
        .select()
        .single();

      if (!planErr && newPlan) {
        resultPlanId = newPlan.id;
        // Add both organizer (as accepted) and responder
        await admin.from('plan_participants').insert([
          {
            plan_id: newPlan.id,
            friend_id: invite.user_id,
            status: 'accepted',
            role: 'organizer',
            responded_at: new Date().toISOString(),
          },
          {
            plan_id: newPlan.id,
            friend_id: userId,
            status: 'accepted',
            role: 'participant',
            responded_at: new Date().toISOString(),
          },
        ]);
      } else {
        console.error('[claim-open-invite] plan create error', planErr);
      }
    }
    // ---- Branch C: standalone open invite — spawn a fresh plan ----
    else {
      const { data: newPlan, error: planErr } = await admin
        .from('plans')
        .insert({
          user_id: invite.user_id,
          title: invite.title,
          activity: invite.activity,
          date: invite.date,
          time_slot: invite.time_slot,
          start_time: invite.start_time,
          end_time: invite.end_time,
          duration: invite.duration,
          location: invite.location,
          notes: invite.notes,
          status: 'confirmed',
          feed_visibility: 'private',
        })
        .select()
        .single();

      if (!planErr && newPlan) {
        resultPlanId = newPlan.id;
        await admin.from('plan_participants').insert([
          {
            plan_id: newPlan.id,
            friend_id: invite.user_id,
            status: 'accepted',
            role: 'organizer',
            responded_at: new Date().toISOString(),
          },
          {
            plan_id: newPlan.id,
            friend_id: userId,
            status: 'accepted',
            role: 'participant',
            responded_at: new Date().toISOString(),
          },
        ]);
      } else {
        console.error('[claim-open-invite] plan create error', planErr);
      }
    }

    // Mark invite as claimed
    await admin
      .from('open_invites')
      .update({
        status: 'claimed',
        claimed_plan_id: resultPlanId,
      })
      .eq('id', invite.id);

    // Notify the inviter (fire-and-forget)
    try {
      const { data: claimer } = await admin
        .from('profiles')
        .select('first_name, display_name')
        .eq('user_id', userId)
        .maybeSingle();
      const claimerName =
        claimer?.first_name || claimer?.display_name || 'Someone';

      const projectUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      fetch(`${projectUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: invite.user_id,
          title: `${claimerName} claimed your open invite`,
          body: invite.title,
          url: resultPlanId ? `/plans/${resultPlanId}` : '/',
          tag: `open-invite-claimed-${invite.id}`,
          data: {
            type: 'open_invite_claimed',
            open_invite_id: invite.id,
            plan_id: resultPlanId,
            trip_id: resultTripId,
          },
        }),
      }).catch(() => null);
    } catch (e) {
      console.error('[claim-open-invite] notify error', e);
    }

    return json(
      { success: true, plan_id: resultPlanId, trip_id: resultTripId },
      200
    );
  } catch (e) {
    console.error('[claim-open-invite] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
