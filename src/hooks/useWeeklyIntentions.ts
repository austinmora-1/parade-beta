import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfWeek, addWeeks, addDays, isSunday, format } from 'date-fns';
import { TRAVEL_ACTIVITIES } from '@/types/planner';

export interface WeeklyIntention {
  id: string;
  user_id: string;
  week_start: string;
  social_energy: string | null;
  target_hangouts: number | null;
  vibes: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

function getUpcomingWeekStart(): string {
  const now = new Date();
  if (isSunday(now)) {
    const nextMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
    return format(nextMonday, 'yyyy-MM-dd');
  }
  return getCurrentWeekStart();
}

export function useWeeklyIntentions() {
  const { session } = useAuth();
  const [intention, setIntention] = useState<WeeklyIntention | null>(null);
  const [completedHangouts, setCompletedHangouts] = useState(0);
  const [loading, setLoading] = useState(true);

  const weekStart = getUpcomingWeekStart();

  const fetchIntention = useCallback(async () => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);

    // Fetch intention and completed hangouts in parallel
    const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd');
    const weekStartTs = `${weekStart}T00:00:00Z`;
    const weekEndTs = `${weekEnd}T23:59:59Z`;

    const [intentionRes, plansRes] = await Promise.all([
      supabase
        .from('weekly_intentions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('week_start', weekStart)
        .maybeSingle(),
      // Count social hangouts (plans with participants, excluding travel logistics)
      supabase
        .from('plans')
        .select('id, activity, plan_participants!inner(id)')
        .eq('user_id', session.user.id)
        .gte('date', weekStartTs)
        .lte('date', weekEndTs)
        .neq('status', 'cancelled')
        .not('activity', 'in', `(${TRAVEL_ACTIVITIES.join(',')})`),
    ]);

    setIntention(intentionRes.data as WeeklyIntention | null);
    setCompletedHangouts(plansRes.data?.length || 0);
    setLoading(false);
  }, [session?.user, weekStart]);

  useEffect(() => { fetchIntention(); }, [fetchIntention]);

  const upsertIntention = useCallback(async (values: {
    social_energy: string;
    target_hangouts: number;
    vibes: string[];
    notes: string;
  }) => {
    if (!session?.user) return;
    const payload = {
      user_id: session.user.id,
      week_start: weekStart,
      ...values,
    };

    if (intention) {
      const { data } = await supabase
        .from('weekly_intentions')
        .update(payload)
        .eq('id', intention.id)
        .select()
        .single();
      if (data) setIntention(data as WeeklyIntention);
    } else {
      const { data } = await supabase
        .from('weekly_intentions')
        .insert(payload)
        .select()
        .single();
      if (data) setIntention(data as WeeklyIntention);
    }
  }, [session?.user, weekStart, intention]);

  return { intention, loading, upsertIntention, weekStart, completedHangouts, refetch: fetchIntention };
}
