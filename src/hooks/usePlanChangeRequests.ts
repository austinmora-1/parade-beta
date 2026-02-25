import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlannerStore } from '@/stores/plannerStore';
import { format } from 'date-fns';
import { TimeSlot } from '@/types/planner';

export interface PlanChangeRequest {
  id: string;
  planId: string;
  proposedBy: string;
  proposedDate: Date | null;
  proposedTimeSlot: string | null;
  proposedDuration: number | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  responses: PlanChangeResponse[];
}

export interface PlanChangeResponse {
  id: string;
  participantId: string;
  participantName?: string;
  response: 'pending' | 'accepted' | 'declined';
  respondedAt: Date | null;
}

export function usePlanChangeRequests() {
  const [changeRequests, setChangeRequests] = useState<PlanChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { userId, friends } = usePlannerStore();

  const fetchChangeRequests = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from('plan_change_requests')
        .select('*')
        .eq('status', 'pending');

      if (error) throw error;

      if (!requests || requests.length === 0) {
        setChangeRequests([]);
        setIsLoading(false);
        return;
      }

      // Fetch responses for all pending requests
      const requestIds = requests.map(r => r.id);
      const { data: responses } = await supabase
        .from('plan_change_responses')
        .select('*')
        .in('change_request_id', requestIds);

      // Collect participant IDs for name resolution
      const participantIds = new Set<string>();
      (responses || []).forEach(r => participantIds.add(r.participant_id));

      let profilesMap: Record<string, string> = {};
      if (participantIds.size > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name')
          .in('user_id', Array.from(participantIds));
        for (const p of (profiles || [])) {
          if (p.user_id) profilesMap[p.user_id] = p.display_name || 'Friend';
        }
      }

      const mapped: PlanChangeRequest[] = requests.map(r => {
        const reqResponses = (responses || [])
          .filter(resp => resp.change_request_id === r.id)
          .map(resp => ({
            id: resp.id,
            participantId: resp.participant_id,
            participantName: profilesMap[resp.participant_id] || 'Friend',
            response: resp.response as 'pending' | 'accepted' | 'declined',
            respondedAt: resp.responded_at ? new Date(resp.responded_at) : null,
          }));

        const proposedDate = r.proposed_date ? new Date(r.proposed_date) : null;
        // Normalize to local date if present
        let normalizedDate: Date | null = null;
        if (proposedDate) {
          normalizedDate = new Date(
            proposedDate.getUTCFullYear(),
            proposedDate.getUTCMonth(),
            proposedDate.getUTCDate()
          );
        }

        return {
          id: r.id,
          planId: r.plan_id,
          proposedBy: r.proposed_by,
          proposedDate: normalizedDate,
          proposedTimeSlot: r.proposed_time_slot,
          proposedDuration: r.proposed_duration,
          status: r.status as 'pending' | 'accepted' | 'declined',
          createdAt: new Date(r.created_at),
          responses: reqResponses,
        };
      });

      setChangeRequests(mapped);
    } catch (error) {
      console.error('Error fetching change requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchChangeRequests();
  }, [fetchChangeRequests]);

  const proposeChange = async (
    planId: string,
    changes: {
      date?: Date;
      timeSlot?: TimeSlot;
      duration?: number;
    },
    participantUserIds: string[]
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Create the change request
      const insertData: Record<string, unknown> = {
        plan_id: planId,
        proposed_by: userId,
        status: 'pending',
      };

      if (changes.date) {
        const dateStr = format(changes.date, 'yyyy-MM-dd');
        insertData.proposed_date = `${dateStr}T12:00:00+00:00`;
      }
      if (changes.timeSlot) insertData.proposed_time_slot = changes.timeSlot;
      if (changes.duration) insertData.proposed_duration = changes.duration;

      const { data: request, error } = await supabase
        .from('plan_change_requests')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;

      // Create response entries for each participant
      const responseInserts = participantUserIds.map(pid => ({
        change_request_id: request.id,
        participant_id: pid,
        response: 'pending',
      }));

      const { error: respError } = await supabase
        .from('plan_change_responses')
        .insert(responseInserts);

      if (respError) throw respError;

      await fetchChangeRequests();
      return true;
    } catch (error) {
      console.error('Error proposing change:', error);
      return false;
    }
  };

  const respondToChange = async (
    changeRequestId: string,
    response: 'accepted' | 'declined'
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('plan_change_responses')
        .update({
          response,
          responded_at: new Date().toISOString(),
        })
        .eq('change_request_id', changeRequestId)
        .eq('participant_id', userId);

      if (error) throw error;

      await fetchChangeRequests();
      return true;
    } catch (error) {
      console.error('Error responding to change:', error);
      return false;
    }
  };

  const getChangeRequestForPlan = (planId: string): PlanChangeRequest | undefined => {
    return changeRequests.find(cr => cr.planId === planId && cr.status === 'pending');
  };

  const checkParticipantAvailability = async (
    participantUserIds: string[],
    date: Date,
    timeSlot: TimeSlot
  ): Promise<{ userId: string; name: string; available: boolean }[]> => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slotColumn = timeSlot.replace('-', '_');

    const results: { userId: string; name: string; available: boolean }[] = [];

    for (const uid of participantUserIds) {
      const { data } = await supabase
        .from('availability')
        .select(`${slotColumn}`)
        .eq('user_id', uid)
        .eq('date', dateStr)
        .maybeSingle();

      const friendInfo = friends.find(f => f.friendUserId === uid);
      const name = friendInfo?.name || 'Friend';
      const available = data ? (data as unknown as Record<string, boolean>)[slotColumn] !== false : true;

      results.push({ userId: uid, name, available });
    }

    return results;
  };

  return {
    changeRequests,
    isLoading,
    proposeChange,
    respondToChange,
    getChangeRequestForPlan,
    checkParticipantAvailability,
    refetch: fetchChangeRequests,
  };
}
