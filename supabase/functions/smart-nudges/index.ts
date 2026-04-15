import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MS_PER_DAY = 86400000;
const BATCH_SIZE = 500;

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

    // Get VAPID keys for push
    const { data: pushConfig } = await admin
      .from('push_config')
      .select('vapid_public_key, vapid_private_key')
      .eq('id', 'default')
      .single();

    if (pushConfig) {
      webpush.setVapidDetails(
        'mailto:hello@parade.app',
        pushConfig.vapid_public_key,
        pushConfig.vapid_private_key
      );
    }

    // Get a batch of users
    const { data: batchProfiles } = await admin
      .from('profiles')
      .select('user_id, display_name, plan_reminders, home_address, location_status')
      .range(batchOffset, batchOffset + BATCH_SIZE - 1)
      .order('user_id');

    if (!batchProfiles || batchProfiles.length === 0) {
      return new Response(JSON.stringify({ done: true, batch_offset: batchOffset }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = batchProfiles.map(p => p.user_id);
    const profileMap = new Map(batchProfiles.map(p => [p.user_id, p]));

    // Get friendships for this batch only
    const { data: batchFriendships } = await admin
      .from('friendships')
      .select('user_id, friend_user_id, friend_name')
      .eq('status', 'connected')
      .not('friend_user_id', 'is', null)
      .in('user_id', userIds);

    if (!batchFriendships || batchFriendships.length === 0) {
      if (batchProfiles.length === BATCH_SIZE) {
        await chainNextBatch(batchOffset + BATCH_SIZE);
      }
      return new Response(JSON.stringify({ batch_offset: batchOffset, nudges_created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build friendship map for this batch
    const friendshipMap = new Map<string, Array<{ friendUserId: string; friendName: string }>>();
    const allFriendIds = new Set<string>();
    for (const f of batchFriendships) {
      if (!f.friend_user_id) continue;
      if (!friendshipMap.has(f.user_id)) friendshipMap.set(f.user_id, []);
      friendshipMap.get(f.user_id)!.push({ friendUserId: f.friend_user_id, friendName: f.friend_name });
      allFriendIds.add(f.friend_user_id);
    }

    // Read from pre-computed last_hung_out_cache instead of computing O(n²)
    const { data: cacheData } = await admin
      .from('last_hung_out_cache')
      .select('user_id, friend_user_id, last_plan_date')
      .in('user_id', userIds);

    const lastHungOut = new Map<string, Date>();
    for (const c of (cacheData || [])) {
      lastHungOut.set(`${c.user_id}:${c.friend_user_id}`, new Date(c.last_plan_date));
    }

    // Get friend home bases for location matching
    const friendIdsArr = Array.from(allFriendIds);
    const { data: friendProfiles } = await admin
      .from('profiles')
      .select('user_id, home_address')
      .in('user_id', friendIdsArr.slice(0, 1000)); // limit to prevent huge queries

    const homeBaseMap = new Map<string, string>();
    for (const p of batchProfiles) {
      if (p.home_address) homeBaseMap.set(p.user_id, p.home_address.toLowerCase().trim());
    }
    for (const p of (friendProfiles || [])) {
      if (p.home_address) homeBaseMap.set(p.user_id, p.home_address.toLowerCase().trim());
    }

    // ── TRIP OVERLAP DATA ──
    const today = new Date();
    const thirtyFiveDaysOut = new Date(Date.now() + 35 * MS_PER_DAY);
    const todayStr = today.toISOString().split('T')[0];
    const thirtyFiveStr = thirtyFiveDaysOut.toISOString().split('T')[0];

    // Only fetch trip data for batch users and their friends
    const relevantUserIds = [...userIds, ...friendIdsArr.slice(0, 500)];
    const { data: upcomingAwayData } = await admin
      .from('availability')
      .select('user_id, date, location_status, trip_location')
      .eq('location_status', 'away')
      .gte('date', todayStr)
      .lte('date', thirtyFiveStr)
      .not('trip_location', 'is', null)
      .in('user_id', relevantUserIds);

    const tripMap = new Map<string, Array<{ date: string; location: string }>>();
    for (const a of (upcomingAwayData || [])) {
      if (!a.trip_location) continue;
      if (!tripMap.has(a.user_id)) tripMap.set(a.user_id, []);
      tripMap.get(a.user_id)!.push({ date: a.date, location: a.trip_location.toLowerCase().trim() });
    }

    // Weekend availability (only for batch users' friends)
    const dayOfWeek = today.getDay();
    const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSat);
    const satStr = saturday.toISOString().split('T')[0];
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    const sunStr = sunday.toISOString().split('T')[0];

    const { data: weekendAvail } = await admin
      .from('availability')
      .select('user_id, date, early_afternoon, late_afternoon, evening')
      .in('date', [satStr, sunStr])
      .in('user_id', relevantUserIds);

    const weekendFreeUsers = new Set<string>();
    for (const a of (weekendAvail || [])) {
      if (a.early_afternoon || a.late_afternoon || a.evening) {
        weekendFreeUsers.add(a.user_id);
      }
    }

    // Delete expired nudges (global, fine to do once per batch)
    const now = new Date().toISOString();
    if (batchOffset === 0) {
      await admin.from('smart_nudges').delete().lt('expires_at', now);
    }

    // Get existing active nudges for batch users
    const { data: existingNudges } = await admin
      .from('smart_nudges')
      .select('user_id, nudge_type, friend_user_id, metadata')
      .in('user_id', userIds)
      .is('dismissed_at', null)
      .is('acted_on_at', null);

    const existingSet = new Set(
      (existingNudges || []).map(n => `${n.user_id}:${n.nudge_type}:${n.friend_user_id || 'group'}`)
    );

    const existingTripNudgeSet = new Set(
      (existingNudges || [])
        .filter(n => n.nudge_type === 'trip_overlap')
        .map(n => {
          const m = n.metadata as any;
          return `${n.user_id}:${n.friend_user_id}:${m?.trip_location || ''}:${m?.days_before || ''}`;
        })
    );

    // Check recent fading nudges for throttling
    const { data: recentFadingNudges } = await admin
      .from('smart_nudges')
      .select('user_id, created_at')
      .eq('nudge_type', 'fading_friendship')
      .in('user_id', userIds)
      .gte('created_at', new Date(Date.now() - 7 * MS_PER_DAY).toISOString());

    const lastFadingNudgeByUser = new Map<string, Date>();
    for (const n of (recentFadingNudges || [])) {
      const existing = lastFadingNudgeByUser.get(n.user_id);
      const d = new Date(n.created_at);
      if (!existing || d > existing) lastFadingNudgeByUser.set(n.user_id, d);
    }

    const nudgesToInsert: Array<{
      user_id: string;
      nudge_type: string;
      friend_user_id: string | null;
      title: string;
      message: string;
      metadata: Record<string, unknown>;
      expires_at: string;
    }> = [];

    const pushToSend: Array<{ userId: string; title: string; body: string; url: string }> = [];

    const TRIP_THRESHOLDS = [30, 21, 14, 7];

    const normalizeCity = (loc: string): string => {
      return loc
        .replace(/,?\s*(usa|us|united states|uk|united kingdom|canada|australia)$/i, '')
        .replace(/\s+(city|metro|area|county|borough|district)$/i, '')
        .trim();
    };

    const citiesMatch = (a: string, b: string): boolean => {
      const na = normalizeCity(a);
      const nb = normalizeCity(b);
      return na === nb || na.includes(nb) || nb.includes(na);
    };

    // Process each user in the batch
    for (const [userId, friends] of friendshipMap) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      // ── FADING FRIENDSHIP NUDGES ──
      const lastFadingSent = lastFadingNudgeByUser.get(userId);
      if (!lastFadingSent || (Date.now() - lastFadingSent.getTime()) >= 7 * MS_PER_DAY) {
        const userHomeBase = homeBaseMap.get(userId);

        const scoredFriends: Array<{
          friend: typeof friends[0];
          daysSince: number;
          sameLocation: boolean;
        }> = [];

        for (const friend of friends) {
          const key = `${userId}:${friend.friendUserId}`;
          const lastDate = lastHungOut.get(key);
          const daysSince = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / MS_PER_DAY) : 30;

          if (daysSince < 14) continue;

          const nudgeKey = `${userId}:fading_friendship:${friend.friendUserId}`;
          if (existingSet.has(nudgeKey)) continue;

          const friendHome = homeBaseMap.get(friend.friendUserId);
          const sameLocation = !!(userHomeBase && friendHome && citiesMatch(userHomeBase, friendHome));

          scoredFriends.push({ friend, daysSince, sameLocation });
        }

        scoredFriends.sort((a, b) => {
          if (a.sameLocation !== b.sameLocation) return a.sameLocation ? -1 : 1;
          return b.daysSince - a.daysSince;
        });

        const picked = scoredFriends.slice(0, 2);

        for (const { friend, daysSince } of picked) {
          const lastDate = lastHungOut.get(`${userId}:${friend.friendUserId}`);
          let title: string, message: string, urgency: string;

          if (daysSince >= 60) {
            title = `It's been a while with ${friend.friendName}`;
            message = `You haven't hung out with ${friend.friendName} in over 2 months. Want to reach out?`;
            urgency = 'high';
          } else if (daysSince >= 30) {
            title = `Miss ${friend.friendName}?`;
            message = `It's been about a month since you last made plans with ${friend.friendName}.`;
            urgency = 'medium';
          } else if (daysSince >= 21) {
            title = `${friend.friendName} misses you`;
            message = `3 weeks since your last hangout with ${friend.friendName}. Time to catch up?`;
            urgency = 'medium';
          } else {
            title = `Catch up with ${friend.friendName}?`;
            message = `It's been 2 weeks since you saw ${friend.friendName}. How about making plans?`;
            urgency = 'low';
          }

          nudgesToInsert.push({
            user_id: userId,
            nudge_type: 'fading_friendship',
            friend_user_id: friend.friendUserId,
            title,
            message,
            metadata: { days_since: daysSince, urgency, last_hung_out: lastDate?.toISOString() || null },
            expires_at: new Date(Date.now() + 7 * MS_PER_DAY).toISOString(),
          });

          if ((urgency === 'high' || urgency === 'medium') && profile.plan_reminders !== false) {
            pushToSend.push({ userId, title: `💛 ${title}`, body: message, url: `/friend/${friend.friendUserId}` });
          }
        }
      }

      // ── TRIP OVERLAP NUDGES ──
      const userTrips = tripMap.get(userId) || [];
      for (const trip of userTrips) {
        const tripDate = new Date(trip.date + 'T12:00:00Z');
        const daysUntilTrip = Math.floor((tripDate.getTime() - Date.now()) / MS_PER_DAY);

        const matchedThreshold = TRIP_THRESHOLDS.find(t => Math.abs(daysUntilTrip - t) <= 1);
        if (!matchedThreshold) continue;

        for (const friend of friends) {
          const friendHomeBase = homeBaseMap.get(friend.friendUserId);
          const friendTrips = tripMap.get(friend.friendUserId) || [];

          let friendInLocation = false;
          if (friendHomeBase && citiesMatch(trip.location, friendHomeBase)) friendInLocation = true;

          if (!friendInLocation) {
            for (const ft of friendTrips) {
              if (citiesMatch(trip.location, ft.location)) {
                const daysDiff = Math.abs(tripDate.getTime() - new Date(ft.date + 'T12:00:00Z').getTime()) / MS_PER_DAY;
                if (daysDiff <= 3) { friendInLocation = true; break; }
              }
            }
          }

          if (!friendInLocation) continue;

          const tripNudgeKey = `${userId}:${friend.friendUserId}:${trip.location}:${matchedThreshold}`;
          if (existingTripNudgeSet.has(tripNudgeKey)) continue;

          const urgency = matchedThreshold <= 7 ? 'high' : matchedThreshold <= 14 ? 'medium' : 'low';
          const locationDisplay = trip.location.split(',')[0].replace(/^\w/, c => c.toUpperCase());
          let title: string, message: string;

          if (matchedThreshold <= 7) {
            title = `${friend.friendName} is in ${locationDisplay}!`;
            message = `Your trip to ${locationDisplay} is in ${daysUntilTrip} days. Reach out to ${friend.friendName} to meet up!`;
          } else if (matchedThreshold <= 14) {
            title = `Visiting ${locationDisplay} soon?`;
            message = `${friend.friendName} is in ${locationDisplay} — you'll be there in ${daysUntilTrip} days. Plan something together?`;
          } else {
            title = `${friend.friendName} in ${locationDisplay}`;
            message = `You're heading to ${locationDisplay} in ${daysUntilTrip} days. ${friend.friendName} lives there — want to connect?`;
          }

          nudgesToInsert.push({
            user_id: userId,
            nudge_type: 'trip_overlap',
            friend_user_id: friend.friendUserId,
            title,
            message,
            metadata: { urgency, days_before: matchedThreshold, days_until_trip: daysUntilTrip, trip_location: trip.location, trip_date: trip.date },
            expires_at: new Date(tripDate.getTime() + 2 * MS_PER_DAY).toISOString(),
          });

          if (profile.plan_reminders !== false) {
            pushToSend.push({ userId, title: `✈️ ${title}`, body: message, url: `/friend/${friend.friendUserId}` });
          }
        }
      }

      // ── FRIENDS AVAILABLE THIS WEEKEND ──
      const freeFriends = friends.filter(f => weekendFreeUsers.has(f.friendUserId));
      if (freeFriends.length >= 2) {
        const nudgeKey = `${userId}:friends_available:group`;
        if (!existingSet.has(nudgeKey)) {
          const names = freeFriends.slice(0, 3).map(f => f.friendName);
          const nameStr = names.length === freeFriends.length
            ? names.join(' and ')
            : `${names.join(', ')} and ${freeFriends.length - names.length} more`;

          nudgesToInsert.push({
            user_id: userId,
            nudge_type: 'friends_available',
            friend_user_id: null,
            title: `${freeFriends.length} friends are free this weekend`,
            message: `${nameStr} ${freeFriends.length === 1 ? 'is' : 'are'} available. Make plans?`,
            metadata: { friend_count: freeFriends.length, friend_ids: freeFriends.map(f => f.friendUserId), friend_names: freeFriends.map(f => f.friendName), weekend_date: satStr },
            expires_at: sunday.toISOString(),
          });

          if (profile.plan_reminders !== false) {
            pushToSend.push({ userId, title: `🎉 ${freeFriends.length} friends are free this weekend`, body: `${nameStr} are available. Make plans?`, url: '/plans' });
          }
        }
      }
    }

    // Batch insert nudges
    if (nudgesToInsert.length > 0) {
      const { error: insertError } = await admin.from('smart_nudges').insert(nudgesToInsert);
      if (insertError) console.error('Error inserting nudges:', insertError);
    }

    // Send push notifications in parallel batches of 50
    let totalPushSent = 0;
    if (pushConfig && pushToSend.length > 0) {
      // Batch-fetch all subscriptions for push users
      const pushUserIds = [...new Set(pushToSend.map(p => p.userId))];
      const { data: allSubs } = await admin
        .from('push_subscriptions')
        .select('*')
        .in('user_id', pushUserIds);

      const subsByUser = new Map<string, typeof allSubs>();
      for (const sub of (allSubs || [])) {
        if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
        subsByUser.get(sub.user_id)!.push(sub);
      }

      const expiredSubIds: string[] = [];

      for (let i = 0; i < pushToSend.length; i += 50) {
        const batch = pushToSend.slice(i, i + 50);
        const results = await Promise.allSettled(
          batch.flatMap(push => {
            const subs = subsByUser.get(push.userId) || [];
            return subs.map(async sub => {
              const payload = JSON.stringify({
                title: push.title,
                body: push.body,
                url: push.url,
                icon: '/icon-192.png',
                badge: '/favicon.png',
                tag: `smart-nudge-${push.userId}`,
              });
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  payload
                );
                totalPushSent++;
              } catch (err: any) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                  expiredSubIds.push(sub.id);
                }
              }
            });
          })
        );
      }

      // Batch-delete expired subscriptions
      if (expiredSubIds.length > 0) {
        await admin.from('push_subscriptions').delete().in('id', expiredSubIds);
      }
    }

    console.log(`Smart nudges batch ${batchOffset}: ${nudgesToInsert.length} created, ${totalPushSent} push sent`);

    // Chain to next batch
    if (batchProfiles.length === BATCH_SIZE) {
      await chainNextBatch(batchOffset + BATCH_SIZE);
    }

    return new Response(
      JSON.stringify({ batch_offset: batchOffset, nudges_created: nudgesToInsert.length, push_sent: totalPushSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Smart nudges error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function chainNextBatch(nextOffset: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    await fetch(`${supabaseUrl}/functions/v1/smart-nudges`, {
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
