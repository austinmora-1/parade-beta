import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 500;
const MS_PER_DAY = 86400000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const batchOffset = body.batch_offset ?? 0;

    // Get a batch of users
    const { data: users, error: usersErr } = await admin
      .from('profiles')
      .select('user_id')
      .range(batchOffset, batchOffset + BATCH_SIZE - 1)
      .order('user_id');

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ done: true, processed_offset: batchOffset }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = users.map(u => u.user_id);

    // Get all plans owned by these users in last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * MS_PER_DAY).toISOString();
    const now = new Date().toISOString();

    const { data: plans } = await admin
      .from('plans')
      .select('id, user_id, date')
      .in('user_id', userIds)
      .gte('date', ninetyDaysAgo)
      .lt('date', now);

    if (!plans || plans.length === 0) {
      // Chain to next batch if more users
      if (users.length === BATCH_SIZE) {
        await chainNextBatch(admin, batchOffset + BATCH_SIZE);
      }
      return new Response(JSON.stringify({ batch_offset: batchOffset, pairs: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const planIds = plans.map(p => p.id);

    // Get accepted participants for these plans
    const { data: participants } = await admin
      .from('plan_participants')
      .select('plan_id, friend_id')
      .in('plan_id', planIds)
      .eq('status', 'accepted');

    // Build plan -> all participant set (including owner)
    const planParticipants = new Map<string, Set<string>>();
    const planDates = new Map<string, Date>();

    for (const p of plans) {
      if (!planParticipants.has(p.id)) planParticipants.set(p.id, new Set());
      planParticipants.get(p.id)!.add(p.user_id);
      planDates.set(p.id, new Date(p.date));
    }
    for (const pp of (participants || [])) {
      planParticipants.get(pp.plan_id)?.add(pp.friend_id);
    }

    // For each plan, for each pair of participants, track latest date
    const pairMap = new Map<string, { date: Date; planId: string }>();

    for (const [planId, members] of planParticipants) {
      const planDate = planDates.get(planId)!;
      const arr = Array.from(members);
      // Only compute pairs where at least one member is in our batch
      const batchSet = new Set(userIds);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (!batchSet.has(arr[i]) && !batchSet.has(arr[j])) continue;
          
          const key1 = `${arr[i]}:${arr[j]}`;
          const key2 = `${arr[j]}:${arr[i]}`;
          
          for (const key of [key1, key2]) {
            const existing = pairMap.get(key);
            if (!existing || planDate > existing.date) {
              pairMap.set(key, { date: planDate, planId });
            }
          }
        }
      }
    }

    // Upsert into cache
    if (pairMap.size > 0) {
      const rows = Array.from(pairMap.entries()).map(([key, val]) => {
        const [userId, friendId] = key.split(':');
        return {
          user_id: userId,
          friend_user_id: friendId,
          last_plan_date: val.date.toISOString(),
          last_plan_id: val.planId,
          updated_at: new Date().toISOString(),
        };
      });

      // Upsert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await admin
          .from('last_hung_out_cache')
          .upsert(chunk, { onConflict: 'user_id,friend_user_id' });
        if (error) console.error('Cache upsert error:', error);
      }
    }

    // Chain to next batch
    if (users.length === BATCH_SIZE) {
      await chainNextBatch(admin, batchOffset + BATCH_SIZE);
    }

    return new Response(
      JSON.stringify({ batch_offset: batchOffset, users: users.length, pairs: pairMap.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('update-last-hung-out error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function chainNextBatch(admin: any, nextOffset: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    await fetch(`${supabaseUrl}/functions/v1/update-last-hung-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ batch_offset: nextOffset }),
    });
  } catch (err) {
    console.error('Failed to chain next batch:', err);
  }
}
