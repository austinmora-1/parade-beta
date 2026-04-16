import { create } from 'zustand';
import { Plan, Friend, TimeSlot, ActivityType, PlanStatus } from '@/types/planner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { validatePlan } from '@/lib/validation';
import { deduplicatePlanRows, mapRawPlanToModel, buildParticipantsMap } from './helpers/mapPlans';
import { createDefaultAvailability } from './helpers/mapAvailability';

export interface PlansState {
  plans: Plan[];
  hasMorePlans: boolean;
  isLoadingMore: boolean;
}

export interface PlansActions {
  _setPlans: (plans: Plan[], hasMorePlans: boolean) => void;
  addPlan: (plan: Omit<Plan, 'id' | 'createdAt'>, userId: string, userTimezone: string, getAvailabilityState: () => { availability: any[]; availabilityMap: Record<string, any>; defaultSettings: any }) => Promise<void>;
  updatePlan: (id: string, updates: Partial<Plan>, userId: string) => Promise<void>;
  deletePlan: (id: string, userId: string, getAvailabilityState: () => { availability: any[]; availabilityMap: Record<string, any> }) => Promise<void>;
  proposePlan: (proposal: {
    recipientFriendId: string;
    activity: ActivityType | string;
    date: Date;
    timeSlot: TimeSlot;
    title?: string;
    location?: string;
    note?: string;
  }, userId: string, userTimezone: string, reloadAll: () => Promise<void>) => Promise<void>;
  respondToProposal: (planId: string, participantRowId: string, response: 'accepted' | 'declined', reloadAll: () => Promise<void>) => Promise<void>;
  loadPlans: (userId: string, userTimezone: string) => Promise<void>;
  loadMorePlans: (userId: string) => Promise<void>;
}

export const usePlansStore = create<PlansState & PlansActions>((set, get) => ({
  plans: [],
  hasMorePlans: false,
  isLoadingMore: false,

  _setPlans: (plans, hasMorePlans) => set({ plans, hasMorePlans }),

  addPlan: async (plan, userId, userTimezone, getAvailabilityState) => {
    if (!userId) return;

    try {
      validatePlan({ title: plan.title, notes: plan.notes, duration: plan.duration, activity: plan.activity });
    } catch (err: any) {
      console.error('Plan validation failed:', err.message);
      return;
    }

    const locationStr = plan.location ? plan.location.name : null;
    const dateStr = format(plan.date, 'yyyy-MM-dd');
    const noonUtcDate = `${dateStr}T12:00:00+00:00`;
    const endDateStr = plan.endDate ? format(plan.endDate, 'yyyy-MM-dd') : null;
    const noonUtcEndDate = endDateStr ? `${endDateStr}T12:00:00+00:00` : null;

    const { data, error } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        title: plan.title,
        activity: plan.activity,
        date: noonUtcDate,
        end_date: noonUtcEndDate,
        time_slot: plan.timeSlot,
        duration: plan.duration,
        start_time: plan.startTime || null,
        end_time: plan.endTime || null,
        location: locationStr,
        notes: plan.notes,
        status: (plan.participants && plan.participants.length > 0 && (!plan.status || plan.status === 'confirmed'))
          ? 'proposed'
          : (plan.status || 'confirmed'),
        source_timezone: userTimezone,
        feed_visibility: plan.feedVisibility || 'private',
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Error adding plan:', error);
      return;
    }

    const newPlanDateRaw = new Date(data.date);
    const newPlan: Plan = {
      id: data.id,
      title: data.title,
      activity: data.activity as ActivityType,
      date: new Date(newPlanDateRaw.getUTCFullYear(), newPlanDateRaw.getUTCMonth(), newPlanDateRaw.getUTCDate()),
      endDate: (data as any).end_date ? (() => {
        const ed = new Date((data as any).end_date);
        return new Date(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate());
      })() : undefined,
      timeSlot: data.time_slot as TimeSlot,
      duration: data.duration,
      startTime: (data as any).start_time || undefined,
      endTime: (data as any).end_time || undefined,
      location: data.location ? { id: data.id, name: data.location, address: '' } : undefined,
      notes: data.notes || undefined,
      status: (data as any).status as PlanStatus || 'confirmed',
      feedVisibility: (data as any).feed_visibility || 'private',
      participants: plan.participants || [],
      createdAt: new Date(data.created_at),
    };

    if (plan.participants && plan.participants.length > 0) {
      const participantRows = plan.participants
        .filter(p => p.friendUserId)
        .map(p => ({
          plan_id: data.id,
          friend_id: p.friendUserId!,
          status: 'invited',
          role: p.role || 'participant',
        }));

      if (participantRows.length > 0) {
        await supabase.from('plan_participants').insert(participantRows);

        supabase.auth.getSession().then(({ data: sessionData }) => {
          const token = sessionData?.session?.access_token;
          if (!token) return;
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          fetch(`https://${projectId}.supabase.co/functions/v1/on-plan-created`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan_id: data.id,
              creator_id: userId,
              participant_ids: participantRows.map(r => r.friend_id),
              plan_title: plan.title,
            }),
          }).catch(() => {});
        }).catch(() => {});
      }
    }

    set((state) => ({ plans: [...state.plans, newPlan] }));

    // Update availability if confirmed
    const effectiveStatus = (plan.participants && plan.participants.length > 0 && (!plan.status || plan.status === 'confirmed'))
      ? 'proposed' : (plan.status || 'confirmed');
    if (effectiveStatus === 'confirmed') {
      const slotColumn = plan.timeSlot.replace('-', '_');
      await supabase
        .from('availability')
        .upsert({
          user_id: userId,
          date: dateStr,
          [slotColumn]: false,
        }, { onConflict: 'user_id,date' });
    }
  },

  updatePlan: async (id, updates, userId) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.activity) dbUpdates.activity = updates.activity;
    if (updates.date) {
      const dateStr = format(updates.date, 'yyyy-MM-dd');
      dbUpdates.date = `${dateStr}T12:00:00+00:00`;
    }
    if (updates.endDate !== undefined) {
      dbUpdates.end_date = updates.endDate ? `${format(updates.endDate, 'yyyy-MM-dd')}T12:00:00+00:00` : null;
    }
    if (updates.timeSlot) dbUpdates.time_slot = updates.timeSlot;
    if (updates.duration) dbUpdates.duration = updates.duration;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime || null;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime || null;
    if (updates.location !== undefined) dbUpdates.location = updates.location?.name || null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.feedVisibility !== undefined) dbUpdates.feed_visibility = updates.feedVisibility;

    const { data: planRow } = await supabase.from('plans').select('source').eq('id', id).single();
    if (planRow?.source && (planRow.source === 'gcal' || planRow.source === 'ical')) {
      dbUpdates.manually_edited = true;
    }

    const { error } = await supabase
      .from('plans')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating plan:', error);
      return;
    }

    if (updates.participants) {
      const { data: existingParticipants } = await supabase
        .from('plan_participants')
        .select('id, friend_id, status, role, responded_at')
        .eq('plan_id', id);

      const existingMap = new Map((existingParticipants || []).map(p => [p.friend_id, p]));
      const desiredIds = new Set(
        updates.participants.filter(p => p.friendUserId).map(p => p.friendUserId!)
      );

      const toDelete = (existingParticipants || []).filter(p => !desiredIds.has(p.friend_id));
      if (toDelete.length > 0) {
        await supabase.from('plan_participants').delete().in('id', toDelete.map(p => p.id));
      }

      const toInsert = updates.participants
        .filter(p => p.friendUserId && !existingMap.has(p.friendUserId))
        .map(p => ({
          plan_id: id,
          friend_id: p.friendUserId!,
          status: 'invited',
          role: p.role || 'participant',
        }));

      if (toInsert.length > 0) {
        await supabase.from('plan_participants').insert(toInsert);
      }
    }

    set((state) => ({
      plans: state.plans.map((p) => p.id === id ? { ...p, ...updates } : p),
    }));
  },

  deletePlan: async (id, userId, getAvailabilityState) => {
    const { plans: currentPlans } = get();
    const planToDelete = currentPlans.find(p => p.id === id);

    const isOwner = !planToDelete?.userId || planToDelete.userId === userId;

    if (isOwner) {
      await supabase.from('plan_participants').delete().eq('plan_id', id);
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) {
        console.error('Error deleting plan:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('plan_participants')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('plan_id', id)
        .eq('friend_id', userId);
      if (error) {
        console.error('Error declining plan:', error);
        return;
      }
    }

    set((state) => ({ plans: state.plans.filter((p) => p.id !== id) }));

    if (planToDelete && userId) {
      const dateStr = format(planToDelete.date, 'yyyy-MM-dd');
      const remainingPlans = currentPlans.filter(
        p => p.id !== id && format(p.date, 'yyyy-MM-dd') === dateStr && p.timeSlot === planToDelete.timeSlot
      );

      if (remainingPlans.length === 0) {
        const slotColumn = planToDelete.timeSlot.replace('-', '_');
        await supabase
          .from('availability')
          .upsert({ user_id: userId, date: dateStr, [slotColumn]: true }, { onConflict: 'user_id,date' });
      }
    }
  },

  proposePlan: async (proposal, userId, userTimezone, reloadAll) => {
    if (!userId) return;

    const dateStr = format(proposal.date, 'yyyy-MM-dd');
    const noonUtcDate = `${dateStr}T12:00:00+00:00`;

    const activityConfig = (await import('@/types/planner')).ACTIVITY_CONFIG[proposal.activity as ActivityType];
    const autoTitle = proposal.title || (activityConfig ? activityConfig.label : proposal.activity);

    const { data, error } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        title: autoTitle,
        activity: proposal.activity,
        date: noonUtcDate,
        time_slot: proposal.timeSlot,
        duration: 60,
        location: proposal.location || null,
        notes: proposal.note || null,
        status: 'proposed',
        proposed_by: userId,
        feed_visibility: 'private',
        source_timezone: userTimezone,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('proposePlan error:', error);
      const { toast } = await import('sonner');
      toast.error('Could not send proposal. Try again.');
      return;
    }

    await supabase.from('plan_participants').insert({
      plan_id: data.id,
      friend_id: proposal.recipientFriendId,
      status: 'invited',
      role: 'participant',
    });

    (async () => {
      try {
        const { TIME_SLOT_LABELS: TSL } = await import('@/types/planner');
        const timeLabel = TSL[proposal.timeSlot]?.label || proposal.timeSlot;
        const dateLabel = format(proposal.date, 'EEE, MMM d');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        fetch(`https://${projectId}.supabase.co/functions/v1/on-plan-created`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: data.id,
            creator_id: userId,
            participant_ids: [proposal.recipientFriendId],
            plan_title: proposal.title || activityConfig?.label || proposal.activity,
            notification_body: `${activityConfig?.label || proposal.activity} · ${dateLabel} · ${timeLabel}`,
            notification_url: '/notifications',
          }),
        }).catch(() => {});
      } catch {}
    })();

    await reloadAll();
  },

  respondToProposal: async (planId, participantRowId, response, reloadAll) => {
    if (response === 'declined') {
      await supabase
        .from('plan_participants')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', participantRowId);
      return;
    }

    await supabase.from('plans').update({ status: 'confirmed' }).eq('id', planId);
    await supabase
      .from('plan_participants')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', participantRowId);

    await reloadAll();
  },

  loadPlans: async (userId, userTimezone) => {
    if (!userId) return;

    const [ownPlansResult, participatedPlanIdsResult] = await Promise.all([
      supabase.from('plans').select('*').eq('user_id', userId).order('date', { ascending: true }).limit(200),
      supabase.rpc('user_participated_plan_ids', { p_user_id: userId }),
    ]);

    const ownPlansData = ownPlansResult.data || [];
    const participatedPlanIds = participatedPlanIdsResult.data;

    const participatedPlansData = (participatedPlanIds && participatedPlanIds.length > 0)
      ? (await supabase.from('plans').select('*').in('id', participatedPlanIds).order('date', { ascending: true }).limit(200)).data || []
      : [];

    const plansData = deduplicatePlanRows(ownPlansData, participatedPlansData);

    const planIds = plansData.map(p => p.id);
    let resolvedParticipantsMap: Record<string, { friend_id: string; status: string; role: string; responded_at: string | null }[]> = {};
    if (planIds.length > 0) {
      const { data } = await supabase.from('plan_participants').select('plan_id, friend_id, status, role, responded_at').in('plan_id', planIds);
      for (const pp of (data || [])) {
        if (!resolvedParticipantsMap[pp.plan_id]) resolvedParticipantsMap[pp.plan_id] = [];
        resolvedParticipantsMap[pp.plan_id].push({ friend_id: pp.friend_id, status: pp.status, role: pp.role, responded_at: pp.responded_at });
      }
    }

    const participantUserIds = new Set<string>();
    for (const pps of Object.values(resolvedParticipantsMap)) {
      for (const pp of pps) participantUserIds.add(pp.friend_id);
    }
    for (const p of plansData) {
      if (p.user_id !== userId) participantUserIds.add(p.user_id);
    }

    let profilesMap: Record<string, string> = {};
    let profileAvatarsMap: Record<string, string | null> = {};
    if (participantUserIds.size > 0) {
      const { data: profiles } = await supabase.from('public_profiles').select('user_id, display_name, avatar_url').in('user_id', Array.from(participantUserIds));
      for (const p of (profiles || [])) {
        if (p.user_id) {
          profilesMap[p.user_id] = p.display_name || 'Friend';
          profileAvatarsMap[p.user_id] = p.avatar_url;
        }
      }
    }

    const plans: Plan[] = plansData.map((p) =>
      mapRawPlanToModel(p, userId, resolvedParticipantsMap, profilesMap, profileAvatarsMap, userTimezone)
    );

    set({ plans });
  },

  loadMorePlans: async (userId) => {
    const { plans, isLoadingMore } = get();
    if (!userId || isLoadingMore) return;

    const oldest = plans.reduce<Date | null>((min, p) => {
      if (!p.createdAt) return min;
      return !min || p.createdAt < min ? p.createdAt : min;
    }, null);

    if (!oldest) return;

    set({ isLoadingMore: true });
    try {
      const { data: rpcData, error } = await supabase.rpc('get_dashboard_data' as any, {
        p_user_id: userId,
        p_plan_cursor: oldest.toISOString(),
      });

      if (error || !rpcData) {
        console.error('loadMorePlans error:', error);
        set({ isLoadingMore: false });
        return;
      }

      // We need to import transformDashboardData dynamically to avoid circular deps
      const { transformDashboardData } = await import('./plannerStore');
      const more = transformDashboardData(rpcData, userId);
      const existingIds = new Set(plans.map(p => p.id));
      const newPlans = more.plans.filter(p => !existingIds.has(p.id));

      set((state) => ({
        plans: [...state.plans, ...newPlans],
        hasMorePlans: more.hasMorePlans,
        isLoadingMore: false,
      }));
    } catch (err) {
      console.error('loadMorePlans error:', err);
      set({ isLoadingMore: false });
    }
  },
}));
