import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns a map of friendUserId -> last shared plan date (most recent past plan).
 * A "shared plan" is one where the current user owns/participates and the friend also participates/owns.
 */
export function useLastHungOut(friendUserIds: string[]) {
  const { user } = useAuth();
  const [lastDates, setLastDates] = useState<Record<string, Date>>({});

  useEffect(() => {
    if (!user || friendUserIds.length === 0) return;

    const fetch = async () => {
      const now = new Date().toISOString();

      // Get plans where user is owner and friend is participant
      const { data: ownedPlans } = await supabase
        .from('plans')
        .select('id, date, user_id')
        .eq('user_id', user.id)
        .lt('date', now);

      // Get plans where user is participant
      const { data: participatedPlanIds } = await supabase
        .from('plan_participants')
        .select('plan_id')
        .eq('friend_id', user.id);

      const allRelevantPlanIds = [
        ...(ownedPlans || []).map(p => p.id),
        ...(participatedPlanIds || []).map(p => p.plan_id),
      ];

      if (allRelevantPlanIds.length === 0) {
        setLastDates({});
        return;
      }

      // Get participants for those plans that are our friends
      const { data: participants } = await supabase
        .from('plan_participants')
        .select('plan_id, friend_id')
        .in('plan_id', allRelevantPlanIds)
        .in('friend_id', friendUserIds);

      // Also check plans owned by friends (where we're a participant)
      const participatedIds = (participatedPlanIds || []).map(p => p.plan_id);
      const { data: friendOwnedPlans } = participatedIds.length > 0
        ? await supabase
            .from('plans')
            .select('id, date, user_id')
            .in('id', participatedIds)
            .in('user_id', friendUserIds)
            .lt('date', now)
        : { data: [] };

      // Build plan date lookup — normalize noon-UTC dates to local calendar day at end-of-day
      // so relative time shows "today" / "yesterday" instead of "12 hours ago"
      const planDateMap: Record<string, Date> = {};
      const toLocalEndOfDay = (isoStr: string): Date => {
        const raw = new Date(isoStr);
        // Use UTC parts to avoid timezone day-shift (dates stored as noon UTC)
        return new Date(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate(), 23, 59, 59);
      };
      (ownedPlans || []).forEach(p => { planDateMap[p.id] = toLocalEndOfDay(p.date); });
      (friendOwnedPlans || []).forEach(p => { planDateMap[p.id] = toLocalEndOfDay(p.date); });

      // For each friend, find the most recent date
      const result: Record<string, Date> = {};

      // From participants on our owned plans
      (participants || []).forEach(p => {
        const d = planDateMap[p.plan_id];
        if (!d) return;
        if (d > new Date()) return; // future plan
        if (!result[p.friend_id] || d > result[p.friend_id]) {
          result[p.friend_id] = d;
        }
      });

      // From friend-owned plans we participated in
      (friendOwnedPlans || []).forEach(p => {
        const d = planDateMap[p.id];
        if (!d) return;
        if (!result[p.user_id] || d > result[p.user_id]) {
          result[p.user_id] = d;
        }
      });

      setLastDates(result);
    };

    fetch();
  }, [user, friendUserIds.join(',')]);

  return lastDates;
}
