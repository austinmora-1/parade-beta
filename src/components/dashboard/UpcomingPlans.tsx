import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isBefore, addDays, isSameDay } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { useDisplayPlans } from '@/hooks/useDisplayPlans';
import { useAuth } from '@/hooks/useAuth';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { getCompactPlanTitle, getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, Users, Clock, CalendarCheck, Plane } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { supabase } from '@/integrations/supabase/client';

import { CollapsibleWidget } from './CollapsibleWidget';
import { getCurrentTimeInTimezone, getTimezoneAbbreviation } from '@/lib/timezone';
import { PlanRsvpButtons } from '@/components/plans/PlanRsvpButtons';

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

// Map time slots to hour ranges for filtering today's plans
const TIME_SLOT_HOURS: Record<string, { start: number; end: number }> = {
  'early-morning': { start: 6, end: 9 },
  'late-morning': { start: 9, end: 12 },
  'early-afternoon': { start: 12, end: 15 },
  'late-afternoon': { start: 15, end: 18 },
  'evening': { start: 18, end: 22 },
  'late-night': { start: 22, end: 26 },
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

type PlanStatus = 'upcoming' | 'in-progress';

function getPlanTimeStatus(plan: { date: Date; timeSlot: TimeSlot; startTime?: string; endTime?: string; duration?: number }, timezone: string): PlanStatus | null {
  const now = new Date();
  if (!isSameDay(plan.date, now)) return 'upcoming';

  const { hours: currentHour, minutes: currentMinutes } = getCurrentTimeInTimezone(timezone);

  // If plan has specific start/end times, use those
  if (plan.startTime) {
    const startMin = parseTimeToMinutes(plan.startTime);
    const endMin = plan.endTime
      ? parseTimeToMinutes(plan.endTime)
      : startMin + (plan.duration || 60);

    if (currentMinutes < startMin) return 'upcoming';
    if (currentMinutes >= startMin && currentMinutes < endMin) return 'in-progress';
    return null; // past
  }

  // Use time slot hours
  const slotHours = TIME_SLOT_HOURS[plan.timeSlot];
  if (!slotHours) return 'upcoming';

  // Handle late-night wrapping past midnight
  const effectiveEnd = slotHours.end > 24 ? slotHours.end - 24 : slotHours.end;
  const isLateNight = slotHours.end > 24;

  if (isLateNight) {
    if (currentHour >= slotHours.start || currentHour < effectiveEnd) return 'in-progress';
    if (currentHour < slotHours.start && currentHour >= effectiveEnd) return null;
    return 'upcoming';
  }

  if (currentHour < slotHours.start) return 'upcoming';
  if (currentHour >= slotHours.start && currentHour < slotHours.end) return 'in-progress';
  return null; // past
}

export function UpcomingPlans({ standalone = false }: { standalone?: boolean } = {}) {
  const { plans: rawPlans, userTimezone, userId } = usePlannerStore();
  const { displayPlans: plans } = useDisplayPlans(rawPlans);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friendUpcomingPlans, setFriendUpcomingPlans] = useState<any[]>([]);
  const [tripProposals, setTripProposals] = useState<any[]>([]);

  // Fetch pending trip proposals
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: myParticipations } = await supabase
        .from('trip_proposal_participants')
        .select('id, proposal_id, status, preferred_date_id, user_id')
        .eq('user_id', user.id);

      if (!myParticipations?.length) { setTripProposals([]); return; }

      const proposalIds = myParticipations.map(p => p.proposal_id);
      const [{ data: proposalsData }, { data: datesData }, { data: allParts }] = await Promise.all([
        supabase.from('trip_proposals').select('*').in('id', proposalIds).eq('status', 'pending'),
        supabase.from('trip_proposal_dates').select('*').in('proposal_id', proposalIds).order('start_date'),
        supabase.from('trip_proposal_participants').select('*').in('proposal_id', proposalIds),
      ]);

      if (!proposalsData?.length) { setTripProposals([]); return; }

      const allUserIds = [...new Set([
        ...proposalsData.map(p => p.created_by),
        ...(allParts || []).map(p => p.user_id),
      ])];
      const { data: profiles } = await supabase.rpc('get_display_names_for_users', { p_user_ids: allUserIds });
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, { name: p.display_name, avatar: p.avatar_url }]));

      const mapped = proposalsData.map(prop => {
        const myRow = myParticipations.find(p => p.proposal_id === prop.id)!;
        const creator = profileMap.get(prop.created_by);
        const propDates = (datesData || []).filter(d => d.proposal_id === prop.id);
        const propParticipants = (allParts || [])
          .filter(p => p.proposal_id === prop.id)
          .map(p => ({ ...p, display_name: profileMap.get(p.user_id)?.name || 'Unknown', avatar_url: profileMap.get(p.user_id)?.avatar || null }));
        const votedCount = propParticipants.filter(p => p.status === 'voted').length;

        return {
          id: `proposal-${prop.id}`,
          proposalId: prop.id,
          destination: prop.destination,
          isCreator: prop.created_by === user.id,
          creatorName: creator?.name || 'Someone',
          dates: propDates,
          participants: propParticipants,
          votedCount,
          totalVoters: propParticipants.length,
          myVotedDateId: myRow.preferred_date_id,
          isTripProposal: true,
        };
      });
      mapped.sort((a, b) => {
        const aDate = a.dates[0]?.start_date || '';
        const bDate = b.dates[0]?.start_date || '';
        return aDate.localeCompare(bDate);
      });
      setTripProposals(mapped);
    })();
  }, [user?.id]);

  const timeSlotOrder: Record<string, number> = {
    'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
    'late-afternoon': 3, 'evening': 4, 'late-night': 5,
  };

  // Fetch friends' shared future plans
  useEffect(() => {
    if (!user?.id) return;
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    (async () => {
      const { data } = await supabase
        .from('plans')
        .select('*')
        .neq('feed_visibility', 'private')
        .neq('user_id', user.id)
        .gte('date', now.toISOString())
        .lte('date', weekFromNow.toISOString())
        .order('date', { ascending: true })
        .limit(20);

      if (data && data.length > 0) {
        const planIds = data.map(p => p.id);
        let participantsMap: Record<string, any[]> = {};
        const { data: pData } = await supabase
          .from('plan_participants')
          .select('plan_id, friend_id, status, role')
          .in('plan_id', planIds);
        for (const pp of (pData || [])) {
          if (!participantsMap[pp.plan_id]) participantsMap[pp.plan_id] = [];
          participantsMap[pp.plan_id].push(pp);
        }

        const allUserIds = new Set(data.map(p => p.user_id));
        for (const pps of Object.values(participantsMap)) {
          for (const pp of pps) allUserIds.add(pp.friend_id);
        }

        let profilesMap: Record<string, { name: string; avatar?: string }> = {};
        if (allUserIds.size > 0) {
          const { data: profiles } = await supabase
            .from('public_profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', Array.from(allUserIds));
          for (const p of (profiles || [])) {
            if (p.user_id) {
              profilesMap[p.user_id] = { name: p.display_name || 'Friend', avatar: p.avatar_url || undefined };
            }
          }
        }

        const mapped = data.map(p => {
          const planDate = new Date(p.date);
          const pps = (participantsMap[p.id] || []).filter((pp: any) => pp.friend_id !== user.id);
          const ownerProfile = profilesMap[p.user_id];
          return {
            id: p.id,
            userId: p.user_id,
            title: p.title,
            activity: p.activity,
            date: new Date(planDate.getUTCFullYear(), planDate.getUTCMonth(), planDate.getUTCDate()),
            endDate: p.end_date ? (() => { const ed = new Date(p.end_date); return new Date(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate()); })() : undefined,
            timeSlot: p.time_slot as TimeSlot,
            duration: p.duration,
            startTime: p.start_time || undefined,
            endTime: p.end_time || undefined,
            location: p.location ? { id: p.id, name: p.location, address: '' } : undefined,
            notes: p.notes || undefined,
            status: p.status,
            feedVisibility: p.feed_visibility || 'private',
            sourceTimezone: p.source_timezone || undefined,
            isFriendPlan: true,
            ownerName: ownerProfile?.name || 'Someone',
            participants: [
              { id: p.user_id, name: ownerProfile?.name || 'Someone', avatar: ownerProfile?.avatar, friendUserId: p.user_id, status: 'connected', role: 'participant' as const },
              ...pps.map((pp: any) => ({
                id: pp.friend_id,
                name: profilesMap[pp.friend_id]?.name || 'Friend',
                avatar: profilesMap[pp.friend_id]?.avatar,
                friendUserId: pp.friend_id,
                status: 'connected',
                role: (pp.role || 'participant') as string,
              })),
            ],
          };
        });
        setFriendUpcomingPlans(mapped);
      }
    })();
  }, [user?.id]);

  const upcomingPlans = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    
    const ownPlans = plans
      .filter((p) => {
        const effectiveEndDate = p.endDate || p.date;
        if (!isSameDay(p.date, now) && !isSameDay(effectiveEndDate, now)) {
          return (p.date > now && isBefore(p.date, weekFromNow)) ||
                 (p.endDate && p.date <= now && effectiveEndDate >= now);
        }
        const status = getPlanTimeStatus(p, userTimezone);
        return status !== null;
      });

    // Merge with friend plans, deduplicating
    const ownPlanIds = new Set(ownPlans.map(p => p.id));
    const friendPlans = friendUpcomingPlans.filter(p => !ownPlanIds.has(p.id));

    return [...ownPlans, ...friendPlans]
      .sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return (timeSlotOrder[a.timeSlot] ?? 0) - (timeSlotOrder[b.timeSlot] ?? 0);
      })
      .slice(0, 8);
  }, [plans, friendUpcomingPlans, userTimezone]);

  const myPlans = upcomingPlans.filter(p => !p.isFriendPlan);
  const friendPlans = upcomingPlans.filter(p => p.isFriendPlan);

  const renderPlanCard = (plan: any) => {
    const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc' };
    const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
    const displayTitle = getCompactPlanTitle(plan);
    const timeStatus = getPlanTimeStatus(plan, userTimezone);
    const isInProgress = timeStatus === 'in-progress';
    const isOwner = !plan.userId || plan.userId === userId;
    const isPendingRsvp = !isOwner && plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted' && plan.myRsvpStatus !== 'declined';
    const hasPendingChange = !!plan.pendingChange;
    const isTentative = plan.status === 'tentative' || isPendingRsvp || hasPendingChange;

    return (
      <div
        key={plan.id}
        onClick={() => navigate(`/plan/${plan.id}`)}
        className={cn(
          "rounded-xl border-l-[3px] px-3 py-3 transition-all duration-200 cursor-pointer group",
          isInProgress
            ? "bg-primary/8 hover:bg-primary/12 shadow-sm"
            : "bg-muted/30 hover:bg-muted/50",
          isTentative && "border-dashed border border-muted-foreground/30 opacity-70",
        )}
        style={{ borderLeftColor: `hsl(var(--${activityConfig.color}))` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ActivityIcon config={activityConfig} size={18} />
              <span className="text-sm font-medium truncate">{displayTitle}</span>
              {hasPendingChange && (
                <span className="rounded-full bg-muted border border-muted-foreground/20 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground shrink-0">
                  Proposed change
                </span>
              )}
              {isPendingRsvp && !hasPendingChange && (
                <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                  Pending RSVP
                </span>
              )}
            </div>
            {plan.isFriendPlan && plan.ownerName && (
              <div className="text-[10px] text-muted-foreground ml-[26px]">
                {plan.ownerName}'s plan
              </div>
            )}
            <div className="flex items-center text-xs text-muted-foreground mt-0.5 ml-[26px]">
              <span className="flex items-center gap-0.5 shrink-0">
                <Clock className="h-3 w-3" />
                {plan.startTime ? formatTime12(plan.startTime) + (plan.endTime ? ` – ${formatTime12(plan.endTime)}` : '') : timeSlotConfig.time}
                <span className="text-muted-foreground/60 ml-0.5">{getTimezoneAbbreviation(userTimezone)}</span>
              </span>
            </div>
            {plan.location && (
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground mt-0.5 ml-[26px]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[140px]">{plan.location.name.split(' · ')[0].split(', ')[0].split(' - ')[0]}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end justify-between gap-1.5 shrink-0 self-stretch">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {isSameDay(plan.date, new Date())
                ? (plan.endDate ? `Today – ${format(plan.endDate, 'MMM d')}` : 'Today')
                : (plan.endDate
                  ? `${format(plan.date, 'MMM d')} – ${format(plan.endDate, 'MMM d')}`
                  : format(plan.date, 'EEE, MMM d'))}
            </span>
            {(() => {
              const visibleParticipants = plan.participants.filter(p => p.role !== 'subscriber');
              if (visibleParticipants.length === 0) return null;
              const shown = visibleParticipants.slice(0, 4);
              const extra = visibleParticipants.length - shown.length;
              return (
                <div className="flex items-center -space-x-1.5">
                  {shown.map((p, i) => (
                    <Avatar key={p.friendUserId || i} className="h-5 w-5 border-[1.5px] border-card">
                      {p.avatar ? (
                        <AvatarImage src={p.avatar} alt={p.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="text-[8px] bg-muted">
                        {p.name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {extra > 0 && (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted border-[1.5px] border-card text-[8px] font-medium text-muted-foreground">
                      +{extra}
                    </span>
                  )}
                </div>
              );
            })()}
            {isInProgress && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider animate-pulse-soft">
                Live
              </span>
            )}
          </div>
        </div>
        {/* RSVP buttons for plans the user is invited to */}
        {(() => {
          const isOwner = !plan.userId || plan.userId === userId;
          const myRsvp = plan.myRsvpStatus;
          const planIsPast = (plan.endDate || plan.date) < new Date(new Date().setHours(0, 0, 0, 0));
          const showRsvp = !isOwner && userId && !planIsPast;
          if (!showRsvp) return null;
          return (
            <div className="mt-2 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
              <PlanRsvpButtons
                planId={plan.id}
                userId={userId}
                currentStatus={myRsvp}
                compact
              />
            </div>
          );
        })()}
      </div>
    );
  };

  const renderTripProposalCard = (proposal: any) => {
    const earliestDate = proposal.dates[0];
    const latestDate = proposal.dates[proposal.dates.length - 1];

    return (
      <div
        key={proposal.id}
        onClick={() => navigate('/trips')}
        className="rounded-xl border-l-[3px] border-dashed border border-muted-foreground/30 opacity-70 px-3 py-3 transition-all duration-200 cursor-pointer group bg-muted/30 hover:bg-muted/50"
        style={{ borderLeftColor: 'hsl(var(--primary))' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Plane className="h-[18px] w-[18px] text-primary shrink-0" />
              <span className="text-sm font-medium truncate text-muted-foreground">
                {proposal.destination ? `Trip to ${proposal.destination}` : 'Group Trip'}
              </span>
              <span className="rounded-full bg-muted border border-muted-foreground/20 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground shrink-0">
                Proposed
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground ml-[26px]">
              {proposal.isCreator ? 'You proposed' : `${proposal.creatorName} proposed`} · {proposal.votedCount}/{proposal.totalVoters} voted
            </div>
            {earliestDate && latestDate && (
              <div className="flex items-center text-xs text-muted-foreground mt-0.5 ml-[26px]">
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {format(new Date(earliestDate.start_date + 'T00:00:00'), 'MMM d')} – {format(new Date(latestDate.end_date + 'T00:00:00'), 'MMM d')}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {proposal.dates.length} date option{proposal.dates.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center -space-x-1.5">
              {proposal.participants.slice(0, 4).map((p: any, i: number) => (
                <Avatar key={p.id || i} className="h-5 w-5 border-[1.5px] border-card">
                  <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} className="object-cover" />
                  <AvatarFallback className="text-[8px] bg-muted">{p.display_name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
              {proposal.participants.length > 4 && (
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted border-[1.5px] border-card text-[8px] font-medium text-muted-foreground">
                  +{proposal.participants.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasAnyContent = upcomingPlans.length > 0 || tripProposals.length > 0;

  const content = !hasAnyContent ? (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="mb-3 text-4xl">📅</div>
      <p className="text-muted-foreground">No upcoming plans this week</p>
      <p className="text-sm text-muted-foreground">Make a plan to get started!</p>
    </div>
  ) : (
    <div className="space-y-4">
      {tripProposals.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Plane className="h-3 w-3" />
            Trip Proposals
          </h4>
          <div className="space-y-1.5">
            {tripProposals.map(renderTripProposalCard)}
          </div>
        </div>
      )}
      {myPlans.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your Plans</h4>
          <div className="space-y-1.5">
            {myPlans.map(renderPlanCard)}
          </div>
        </div>
      )}
      {friendPlans.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Friends' Plans
          </h4>
          <div className="space-y-1.5">
            {friendPlans.map(renderPlanCard)}
          </div>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-soft">{content}</div>;
  }

  return (
    <CollapsibleWidget
      title="Upcoming Plans"
      icon={<CalendarCheck className="h-4 w-4 text-primary" />}
      badge={
        (upcomingPlans.length + tripProposals.length) > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {upcomingPlans.length + tripProposals.length}
          </span>
        ) : undefined
      }
    >
      {content}
    </CollapsibleWidget>
  );
}
