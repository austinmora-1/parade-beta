import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RecurringPlan {
  id: string;
  title: string;
  activity: string;
  timeSlot: string;
  duration: number;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek: number;
  weekOfMonth?: number;
  startsOn: string;
  endsOn?: string;
  maxOccurrences?: number;
  isActive: boolean;
  feedVisibility: string;
  createdAt: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getRecurrenceLabel(rp: RecurringPlan): string {
  const day = DAY_NAMES[rp.dayOfWeek];
  if (rp.frequency === 'weekly') return `Every ${day}`;
  if (rp.frequency === 'biweekly') return `Every other ${day}`;
  if (rp.frequency === 'monthly' && rp.weekOfMonth) {
    const ordinal = ['', '1st', '2nd', '3rd', '4th', '5th'][rp.weekOfMonth];
    return `${ordinal} ${day} of the month`;
  }
  return rp.frequency;
}

export function useRecurringPlans() {
  const { user } = useAuth();
  const [recurringPlans, setRecurringPlans] = useState<RecurringPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecurringPlans = useCallback(async () => {
    if (!user?.id) {
      setRecurringPlans([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('recurring_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recurring plans:', error);
      setLoading(false);
      return;
    }

    setRecurringPlans(
      (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        activity: r.activity,
        timeSlot: r.time_slot,
        duration: r.duration,
        startTime: r.start_time || undefined,
        endTime: r.end_time || undefined,
        location: r.location || undefined,
        notes: r.notes || undefined,
        frequency: r.frequency,
        dayOfWeek: r.day_of_week ?? 0,
        weekOfMonth: r.week_of_month || undefined,
        startsOn: r.starts_on,
        endsOn: r.ends_on || undefined,
        maxOccurrences: r.max_occurrences || undefined,
        isActive: r.is_active,
        feedVisibility: r.feed_visibility || 'private',
        createdAt: r.created_at,
      }))
    );
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchRecurringPlans();
  }, [fetchRecurringPlans]);

  const createRecurringPlan = async (plan: Omit<RecurringPlan, 'id' | 'isActive' | 'createdAt'>) => {
    if (!user?.id) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('user_id', user.id)
      .single();

    const { error } = await supabase.from('recurring_plans').insert({
      user_id: user.id,
      title: plan.title,
      activity: plan.activity,
      time_slot: plan.timeSlot,
      duration: plan.duration,
      start_time: plan.startTime || null,
      end_time: plan.endTime || null,
      location: plan.location || null,
      notes: plan.notes || null,
      frequency: plan.frequency,
      day_of_week: plan.dayOfWeek,
      week_of_month: plan.weekOfMonth || null,
      starts_on: plan.startsOn,
      ends_on: plan.endsOn || null,
      max_occurrences: plan.maxOccurrences || null,
      feed_visibility: plan.feedVisibility || 'private',
      source_timezone: (profileData as any)?.timezone || null,
    } as any);

    if (error) throw error;

    // Trigger immediate generation
    try {
      await supabase.functions.invoke('generate-recurring-plans');
    } catch (e) {
      console.warn('Could not trigger immediate generation:', e);
    }

    await fetchRecurringPlans();
  };

  const pauseRecurringPlan = async (id: string) => {
    const { error } = await supabase
      .from('recurring_plans')
      .update({ is_active: false } as any)
      .eq('id', id);
    if (error) throw error;
    setRecurringPlans(prev => prev.map(rp => rp.id === id ? { ...rp, isActive: false } : rp));
  };

  const resumeRecurringPlan = async (id: string) => {
    const { error } = await supabase
      .from('recurring_plans')
      .update({ is_active: true } as any)
      .eq('id', id);
    if (error) throw error;
    setRecurringPlans(prev => prev.map(rp => rp.id === id ? { ...rp, isActive: true } : rp));
  };

  const deleteRecurringPlan = async (id: string, deleteFutureInstances: boolean = false) => {
    if (deleteFutureInstances) {
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('plans')
        .delete()
        .eq('recurring_plan_id', id)
        .gte('date', `${today}T00:00:00+00:00`);
    }

    const { error } = await supabase.from('recurring_plans').delete().eq('id', id);
    if (error) throw error;
    setRecurringPlans(prev => prev.filter(rp => rp.id !== id));
  };

  return {
    recurringPlans,
    loading,
    createRecurringPlan,
    pauseRecurringPlan,
    resumeRecurringPlan,
    deleteRecurringPlan,
    refetch: fetchRecurringPlans,
  };
}
