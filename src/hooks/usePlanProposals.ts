import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlannerStore } from '@/stores/plannerStore';
import { PlanProposalOption, PlanProposalVote, TimeSlot } from '@/types/planner';
import { format } from 'date-fns';
import { convertTimeBetweenTimezones } from '@/lib/timezone';

export interface ProposalOptionInput {
  date: Date;
  timeSlot: TimeSlot;
  startTime?: string;
}

export function usePlanProposals() {
  const userId = usePlannerStore((s) => s.userId);
  const loadPlans = usePlannerStore((s) => s.loadPlans);
  const [isLoading, setIsLoading] = useState(false);

  const createProposalOptions = useCallback(async (planId: string, options: ProposalOptionInput[]) => {
    const rows = options.map((opt, i) => ({
      plan_id: planId,
      date: `${format(opt.date, 'yyyy-MM-dd')}T12:00:00+00:00`,
      time_slot: opt.timeSlot,
      start_time: opt.startTime || null,
      sort_order: i,
    }));

    const { error } = await supabase.from('plan_proposal_options' as any).insert(rows);
    if (error) {
      console.error('Error creating proposal options:', error);
      return false;
    }
    return true;
  }, []);

  const loadProposalData = useCallback(async (planId: string): Promise<{
    options: PlanProposalOption[];
    votes: PlanProposalVote[];
  }> => {
    const { data: optionsData, error: optError } = await supabase
      .from('plan_proposal_options' as any)
      .select('*')
      .eq('plan_id', planId)
      .order('sort_order');

    if (optError || !optionsData) return { options: [], votes: [] };

    const optionIds = (optionsData as any[]).map(o => o.id);
    const { data: votesData } = await supabase
      .from('plan_proposal_votes' as any)
      .select('*')
      .in('option_id', optionIds);

    const options: PlanProposalOption[] = (optionsData as any[]).map(o => {
      const d = new Date(o.date);
      const optionDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      let startTime = o.start_time || undefined;
      
      // Convert start_time to the user's current timezone if needed
      const userTimezone = usePlannerStore.getState().userTimezone;
      if (startTime && o.source_timezone && o.source_timezone !== userTimezone) {
        const converted = convertTimeBetweenTimezones(startTime, optionDate, o.source_timezone, userTimezone);
        startTime = converted.time;
      }
      
      return {
        id: o.id,
        planId: o.plan_id,
        date: optionDate,
        timeSlot: o.time_slot as TimeSlot,
        startTime,
        sortOrder: o.sort_order,
      };
    });

    const votes: PlanProposalVote[] = ((votesData as any[]) || []).map(v => ({
      id: v.id,
      optionId: v.option_id,
      userId: v.user_id,
      rank: v.rank,
    }));

    return { options, votes };
  }, []);

  const submitVotes = useCallback(async (
    options: PlanProposalOption[],
    rankings: Record<string, number> // optionId -> rank
  ) => {
    if (!userId) return false;
    setIsLoading(true);

    try {
      // Delete existing votes for this user on these options
      const optionIds = options.map(o => o.id);
      await supabase
        .from('plan_proposal_votes' as any)
        .delete()
        .in('option_id', optionIds)
        .eq('user_id', userId);

      // Insert new votes
      const rows = Object.entries(rankings).map(([optionId, rank]) => ({
        option_id: optionId,
        user_id: userId,
        rank,
      }));

      const { error } = await supabase.from('plan_proposal_votes' as any).insert(rows);
      if (error) throw error;

      await loadPlans();
      return true;
    } catch (err) {
      console.error('Error submitting votes:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, loadPlans]);

  const finalizePlan = useCallback(async (
    planId: string,
    winningOption: PlanProposalOption
  ) => {
    if (!userId) return false;
    setIsLoading(true);

    try {
      const dateStr = format(winningOption.date, 'yyyy-MM-dd');
      const noonUtc = `${dateStr}T12:00:00+00:00`;

      const { error } = await supabase
        .from('plans')
        .update({
          date: noonUtc,
          time_slot: winningOption.timeSlot,
          start_time: winningOption.startTime || null,
          proposal_status: 'decided',
          status: 'confirmed',
        } as any)
        .eq('id', planId);

      if (error) throw error;
      await loadPlans();
      return true;
    } catch (err) {
      console.error('Error finalizing plan:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, loadPlans]);

  /** Compute Borda count scores for options */
  const computeScores = useCallback((
    options: PlanProposalOption[],
    votes: PlanProposalVote[]
  ): Map<string, number> => {
    const scores = new Map<string, number>();
    for (const opt of options) scores.set(opt.id, 0);

    // Group votes by user
    const byUser = new Map<string, PlanProposalVote[]>();
    for (const v of votes) {
      if (!byUser.has(v.userId)) byUser.set(v.userId, []);
      byUser.get(v.userId)!.push(v);
    }

    const n = options.length;
    for (const userVotes of byUser.values()) {
      for (const v of userVotes) {
        // Borda: rank 1 gets n points, rank 2 gets n-1, etc.
        const pts = n - v.rank + 1;
        scores.set(v.optionId, (scores.get(v.optionId) || 0) + pts);
      }
    }

    return scores;
  }, []);

  return {
    isLoading,
    createProposalOptions,
    loadProposalData,
    submitVotes,
    finalizePlan,
    computeScores,
  };
}
