import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfWeek, addWeeks, isSunday, isAfter, format } from 'date-fns';

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
  // If it's Sunday, target next week
  if (isSunday(now)) {
    const nextMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
    return format(nextMonday, 'yyyy-MM-dd');
  }
  return getCurrentWeekStart();
}

export function useWeeklyIntentions() {
  const { session } = useAuth();
  const [intention, setIntention] = useState<WeeklyIntention | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = getUpcomingWeekStart();

  const fetchIntention = useCallback(async () => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('weekly_intentions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('week_start', weekStart)
      .maybeSingle();
    setIntention(data as WeeklyIntention | null);
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

  return { intention, loading, upsertIntention, weekStart, refetch: fetchIntention };
}
