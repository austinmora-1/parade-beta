import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MS_PER_DAY = 86400000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

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

    // Get all users with connected friendships
    const { data: allProfiles } = await admin
      .from('profiles')
      .select('user_id, display_name, plan_reminders');

    if (!allProfiles || allProfiles.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileMap = new Map(allProfiles.map(p => [p.user_id, p]));

    // Get all connected friendships
    const { data: allFriendships } = await admin
      .from('friendships')
      .select('user_id, friend_user_id, friend_name')
      .eq('status', 'connected')
      .not('friend_user_id', 'is', null);

    if (!allFriendships || allFriendships.length === 0) {
      return new Response(JSON.stringify({ processed: 0, reason: 'no friendships' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build friendship map: userId -> [{friendUserId, friendName}]
    const friendshipMap = new Map<string, Array<{ friendUserId: string; friendName: string }>>();
    for (const f of allFriendships) {
      if (!f.friend_user_id) continue;
      if (!friendshipMap.has(f.user_id)) friendshipMap.set(f.user_id, []);
      friendshipMap.get(f.user_id)!.push({ friendUserId: f.friend_user_id, friendName: f.friend_name });
    }

    // Get all past plans with participants (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * MS_PER_DAY).toISOString();
    const now = new Date().toISOString();

    const { data: recentPlans } = await admin
      .from('plans')
      .select('id, user_id, date')
      .gte('date', ninetyDaysAgo)
      .lt('date', now);

    const { data: recentParticipants } = await admin
      .from('plan_participants')
      .select('plan_id, friend_id')
      .eq('status', 'accepted');

    // Build: for each pair (userId, friendId) -> most recent shared plan date
    const planDateMap = new Map<string, Date>();
    for (const p of (recentPlans || [])) {
      planDateMap.set(p.id, new Date(p.date));
    }

    // Map: "userId:friendId" -> latest date
    const lastHungOut = new Map<string, Date>();

    const planOwnerMap = new Map<string, string>();
    for (const p of (recentPlans || [])) {
      planOwnerMap.set(p.id, p.user_id);
    }

    // Build plan -> participant set
    const planParticipantMap = new Map<string, Set<string>>();
    for (const p of (recentPlans || [])) {
      const s = new Set<string>();
      s.add(p.user_id); // owner is always a participant
      planParticipantMap.set(p.id, s);
    }
    for (const pp of (recentParticipants || [])) {
      planParticipantMap.get(pp.plan_id)?.add(pp.friend_id);
    }

    // For each plan, for each pair of participants, update lastHungOut
    for (const [planId, participants] of planParticipantMap) {
      const planDate = planDateMap.get(planId);
      if (!planDate) continue;
      const arr = Array.from(participants);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key1 = `${arr[i]}:${arr[j]}`;
          const key2 = `${arr[j]}:${arr[i]}`;
          if (!lastHungOut.has(key1) || planDate > lastHungOut.get(key1)!) {
            lastHungOut.set(key1, planDate);
          }
          if (!lastHungOut.has(key2) || planDate > lastHungOut.get(key2)!) {
            lastHungOut.set(key2, planDate);
          }
        }
      }
    }

    // ── TRIP OVERLAP DATA ──
    // Get all availability entries with away status in the next 35 days
    const today = new Date();
    const thirtyFiveDaysOut = new Date(Date.now() + 35 * MS_PER_DAY);
    const todayStr = today.toISOString().split('T')[0];
    const thirtyFiveStr = thirtyFiveDaysOut.toISOString().split('T')[0];

    const { data: upcomingAwayData } = await admin
      .from('availability')
      .select('user_id, date, location_status, trip_location')
      .eq('location_status', 'away')
      .gte('date', todayStr)
      .lte('date', thirtyFiveStr)
      .not('trip_location', 'is', null);

    // Build: userId -> [{date, trip_location}]
    const tripMap = new Map<string, Array<{ date: string; location: string }>>();
    for (const a of (upcomingAwayData || [])) {
      if (!a.trip_location) continue;
      if (!tripMap.has(a.user_id)) tripMap.set(a.user_id, []);
      tripMap.get(a.user_id)!.push({ date: a.date, location: a.trip_location.toLowerCase().trim() });
    }

    // Get friend profiles' home base locations for overlap detection
    const { data: allProfilesFull } = await admin
      .from('profiles')
      .select('user_id, display_name, home_address, location_status');

    const homeBaseMap = new Map<string, string>();
    for (const p of (allProfilesFull || [])) {
      if (p.home_address) {
        homeBaseMap.set(p.user_id, p.home_address.toLowerCase().trim());
      }
    }

    // Normalize city for fuzzy matching
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

    // Get upcoming weekend availability
    const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
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
      .in('date', [satStr, sunStr]);

    // Map: userId -> is available this weekend
    const weekendFreeUsers = new Set<string>();
    for (const a of (weekendAvail || [])) {
      if (a.early_afternoon || a.late_afternoon || a.evening) {
        weekendFreeUsers.add(a.user_id);
      }
    }

    // Delete expired nudges
    await admin
      .from('smart_nudges')
      .delete()
      .lt('expires_at', now);

    // Get existing active nudges to avoid duplicates
    const { data: existingNudges } = await admin
      .from('smart_nudges')
      .select('user_id, nudge_type, friend_user_id, metadata')
      .is('dismissed_at', null)
      .is('acted_on_at', null);

    const existingSet = new Set(
      (existingNudges || []).map(n => `${n.user_id}:${n.nudge_type}:${n.friend_user_id || 'group'}`)
    );

    // For trip_overlap, track existing nudges by user:friend:location:threshold
    const existingTripNudgeSet = new Set(
      (existingNudges || [])
        .filter(n => n.nudge_type === 'trip_overlap')
        .map(n => {
          const m = n.metadata as any;
          return `${n.user_id}:${n.friend_user_id}:${m?.trip_location || ''}:${m?.days_before || ''}`;
        })
    );

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

    // Check when each user last received a fading_friendship nudge (weekly throttle)
    const { data: recentFadingNudges } = await admin
      .from('smart_nudges')
      .select('user_id, created_at')
      .eq('nudge_type', 'fading_friendship')
      .gte('created_at', new Date(Date.now() - 7 * MS_PER_DAY).toISOString());

    const lastFadingNudgeByUser = new Map<string, Date>();
    for (const n of (recentFadingNudges || [])) {
      const existing = lastFadingNudgeByUser.get(n.user_id);
      const d = new Date(n.created_at);
      if (!existing || d > existing) lastFadingNudgeByUser.set(n.user_id, d);
    }

    // Process each user
    for (const [userId, friends] of friendshipMap) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      // ── FADING FRIENDSHIP NUDGES ──
      // Throttle: only send once per week per user
      const lastFadingSent = lastFadingNudgeByUser.get(userId);
      if (!lastFadingSent || (Date.now() - lastFadingSent.getTime()) >= 7 * MS_PER_DAY) {
        const userHomeBase = homeBaseMap.get(userId);

        // Score and rank friends: prioritize same location, then by days since last hung out
        const scoredFriends: Array<{
          friend: typeof friends[0];
          daysSince: number;
          sameLocation: boolean;
        }> = [];

        for (const friend of friends) {
          const key = `${userId}:${friend.friendUserId}`;
          const lastDate = lastHungOut.get(key);
          const daysSince = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / MS_PER_DAY) : 30;

          if (daysSince < 14) continue; // Not fading yet

          const nudgeKey = `${userId}:fading_friendship:${friend.friendUserId}`;
          if (existingSet.has(nudgeKey)) continue;

          // Check if friend is in the same home location
          const friendHome = homeBaseMap.get(friend.friendUserId);
          const sameLocation = !!(userHomeBase && friendHome && citiesMatch(userHomeBase, friendHome));

          scoredFriends.push({ friend, daysSince, sameLocation });
        }

        // Sort: same location first, then by days since (descending = most overdue first)
        scoredFriends.sort((a, b) => {
          if (a.sameLocation !== b.sameLocation) return a.sameLocation ? -1 : 1;
          return b.daysSince - a.daysSince;
        });

        // Only pick top 2 friends per week
        const MAX_FADING_PER_WEEK = 2;
        const picked = scoredFriends.slice(0, MAX_FADING_PER_WEEK);

        for (const { friend, daysSince } of picked) {
          const lastDate = lastHungOut.get(`${userId}:${friend.friendUserId}`);

          let title: string;
          let message: string;
          let urgency: string;

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

          const expiresAt = new Date(Date.now() + 7 * MS_PER_DAY).toISOString();

          nudgesToInsert.push({
            user_id: userId,
            nudge_type: 'fading_friendship',
            friend_user_id: friend.friendUserId,
            title,
            message,
            metadata: { days_since: daysSince, urgency, last_hung_out: lastDate?.toISOString() || null },
            expires_at: expiresAt,
          });

          if ((urgency === 'high' || urgency === 'medium') && profile.plan_reminders !== false) {
            pushToSend.push({
              userId,
              title: `💛 ${title}`,
              body: message,
              url: `/friend/${friend.friendUserId}`,
            });
          }
        }
      }

      // ── TRIP OVERLAP NUDGES ──
      const userTrips = tripMap.get(userId) || [];
      for (const trip of userTrips) {
        const tripDate = new Date(trip.date + 'T12:00:00Z');
        const daysUntilTrip = Math.floor((tripDate.getTime() - Date.now()) / MS_PER_DAY);

        // Find matching threshold
        const matchedThreshold = TRIP_THRESHOLDS.find(t => {
          // Allow a 2-day window around each threshold
          return Math.abs(daysUntilTrip - t) <= 1;
        });
        if (!matchedThreshold) continue;

        // Find friends in that location (home address or also traveling there)
        for (const friend of friends) {
          const friendHomeBase = homeBaseMap.get(friend.friendUserId);
          const friendTrips = tripMap.get(friend.friendUserId) || [];

          let friendInLocation = false;

          // Check if friend's home base is in the trip location
          if (friendHomeBase && citiesMatch(trip.location, friendHomeBase)) {
            friendInLocation = true;
          }

          // Check if friend is also traveling to the same place around the same time
          if (!friendInLocation) {
            for (const ft of friendTrips) {
              if (citiesMatch(trip.location, ft.location)) {
                const ftDate = new Date(ft.date + 'T12:00:00Z');
                const daysDiff = Math.abs(tripDate.getTime() - ftDate.getTime()) / MS_PER_DAY;
                if (daysDiff <= 3) {
                  friendInLocation = true;
                  break;
                }
              }
            }
          }

          if (!friendInLocation) continue;

          // Check for existing nudge at this threshold
          const tripNudgeKey = `${userId}:${friend.friendUserId}:${trip.location}:${matchedThreshold}`;
          if (existingTripNudgeSet.has(tripNudgeKey)) continue;

          const urgency = matchedThreshold <= 7 ? 'high' : matchedThreshold <= 14 ? 'medium' : 'low';
          const friendDisplayName = friend.friendName;
          const locationDisplay = trip.location.split(',')[0].replace(/^\w/, c => c.toUpperCase());

          let title: string;
          let message: string;

          if (matchedThreshold <= 7) {
            title = `${friendDisplayName} is in ${locationDisplay}!`;
            message = `Your trip to ${locationDisplay} is in ${daysUntilTrip} days. Reach out to ${friendDisplayName} to meet up!`;
          } else if (matchedThreshold <= 14) {
            title = `Visiting ${locationDisplay} soon?`;
            message = `${friendDisplayName} is in ${locationDisplay} — you'll be there in ${daysUntilTrip} days. Plan something together?`;
          } else {
            title = `${friendDisplayName} in ${locationDisplay}`;
            message = `You're heading to ${locationDisplay} in ${daysUntilTrip} days. ${friendDisplayName} lives there — want to connect?`;
          }

          nudgesToInsert.push({
            user_id: userId,
            nudge_type: 'trip_overlap',
            friend_user_id: friend.friendUserId,
            title,
            message,
            metadata: {
              urgency,
              days_before: matchedThreshold,
              days_until_trip: daysUntilTrip,
              trip_location: trip.location,
              trip_date: trip.date,
            },
            expires_at: new Date(tripDate.getTime() + 2 * MS_PER_DAY).toISOString(),
          });

          if (profile.plan_reminders !== false) {
            pushToSend.push({
              userId,
              title: `✈️ ${title}`,
              body: message,
              url: `/friend/${friend.friendUserId}`,
            });
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

          const title = `${freeFriends.length} friends are free this weekend`;
          const message = `${nameStr} ${freeFriends.length === 1 ? 'is' : 'are'} available. Make plans?`;

          nudgesToInsert.push({
            user_id: userId,
            nudge_type: 'friends_available',
            friend_user_id: null,
            title,
            message,
            metadata: {
              friend_count: freeFriends.length,
              friend_ids: freeFriends.map(f => f.friendUserId),
              friend_names: freeFriends.map(f => f.friendName),
              weekend_date: satStr,
            },
            expires_at: sunday.toISOString(),
          });

          if (profile.plan_reminders !== false) {
            pushToSend.push({
              userId,
              title: `🎉 ${title}`,
              body: message,
              url: '/plans',
            });
          }
        }
      }
    }
    // Batch insert nudges
    if (nudgesToInsert.length > 0) {
      const { error: insertError } = await admin.from('smart_nudges').insert(nudgesToInsert);
      if (insertError) console.error('Error inserting nudges:', insertError);
    }

    // Send push notifications (batch by user)
    let totalPushSent = 0;
    if (pushConfig && pushToSend.length > 0) {
      for (const push of pushToSend) {
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', push.userId);

        if (!subs || subs.length === 0) continue;

        const payload = JSON.stringify({
          title: push.title,
          body: push.body,
          url: push.url,
          icon: '/icon-192.png',
          badge: '/favicon.png',
          tag: `smart-nudge-${push.userId}`,
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            totalPushSent++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await admin.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      }
    }

    console.log(`Smart nudges: ${nudgesToInsert.length} created, ${totalPushSent} push sent`);

    return new Response(
      JSON.stringify({ nudges_created: nudgesToInsert.length, push_sent: totalPushSent }),
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
