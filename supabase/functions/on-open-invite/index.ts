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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claims.claims.sub;

    const body = (await req.json()) as RequestBody;
    if (!body.open_invite_id || typeof body.open_invite_id !== 'string') {
      return json({ error: 'open_invite_id required' }, 400);
    }

    // Service role for cross-user lookups + notification dispatch
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: invite, error: inviteErr } = await admin
      .from('open_invites')
      .select('*')
      .eq('id', body.open_invite_id)
      .single();

    if (inviteErr || !invite) {
      return json({ error: 'Invite not found' }, 404);
    }
    if (invite.user_id !== userId) {
      return json({ error: 'Forbidden' }, 403);
    }

    // Resolve target user ids based on audience_type
    const recipientIds = new Set<string>();

    if (invite.audience_type === 'all_friends') {
      const { data: friends } = await admin
        .from('friendships')
        .select('friend_user_id')
        .eq('user_id', userId)
        .eq('status', 'connected');
      friends?.forEach((f) => f.friend_user_id && recipientIds.add(f.friend_user_id));
    } else if (invite.audience_type === 'pod' && invite.audience_ref) {
      const { data: members } = await admin
        .from('pod_members')
        .select('friend_user_id')
        .eq('pod_id', invite.audience_ref);
      members?.forEach((m) => m.friend_user_id && recipientIds.add(m.friend_user_id));
    } else if (invite.audience_type === 'interest' && invite.audience_ref) {
      // Match friends whose profile interests include the tag
      const { data: friends } = await admin
        .from('friendships')
        .select('friend_user_id')
        .eq('user_id', userId)
        .eq('status', 'connected');
      const friendIds = (friends || [])
        .map((f) => f.friend_user_id)
        .filter((id): id is string => !!id);
      if (friendIds.length > 0) {
        const { data: matches } = await admin
          .from('profiles')
          .select('user_id, interests')
          .in('user_id', friendIds)
          .contains('interests', [invite.audience_ref]);
        matches?.forEach((m) => recipientIds.add(m.user_id));
      }
    }

    recipientIds.delete(userId);

    // Look up sender display name
    const { data: senderProfile } = await admin
      .from('profiles')
      .select('display_name, first_name')
      .eq('user_id', userId)
      .maybeSingle();
    const senderName =
      senderProfile?.first_name || senderProfile?.display_name || 'Someone';

    // Fire push notifications (fire-and-forget)
    const projectUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const title = `${senderName} is looking for someone to join`;
    const bodyText = `${invite.title} · tap to claim`;

    const sendPromises = Array.from(recipientIds).map((rid) =>
      fetch(`${projectUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: rid,
          title,
          body: bodyText,
          url: '/',
          tag: `open-invite-${invite.id}`,
          data: { type: 'open_invite', open_invite_id: invite.id, url: '/' },
        }),
      }).catch(() => null)
    );

    // Don't await - fire and forget
    Promise.all(sendPromises);

    // If anchored to an existing plan or trip, surface that context for downstream handlers.
    // (Claim/RSVP processing happens elsewhere; this function only handles broadcast.)
    if (invite.plan_id) {
      console.log('[on-open-invite] anchored to plan', invite.plan_id);
    }
    if (invite.trip_id) {
      console.log('[on-open-invite] anchored to trip', invite.trip_id);
    }

    // Update notified_count
    await admin
      .from('open_invites')
      .update({ notified_count: recipientIds.size })
      .eq('id', invite.id);

    return json({ success: true, notified: recipientIds.size }, 200);
  } catch (e) {
    console.error('[on-open-invite] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
