import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Edit, MapPin, Users, Clock, Trash2, Eye, Calendar, UserPlus, Check, Loader2, Globe, Lock, HelpCircle, CheckCircle2, XCircle, Plus, Search, Share2, Merge, Globe2, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS, FeedVisibility } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { usePods } from '@/hooks/usePods';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { FriendLink } from '@/components/ui/FriendLink';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePlanChangeRequests } from '@/hooks/usePlanChangeRequests';
import { PlanChangeRequestBadge } from '@/components/plans/PlanChangeRequestBadge';
import { PlanPhotos } from '@/components/plans/PlanPhotos';
import { PlanComments } from '@/components/plans/PlanComments';
import { PendingPlaceholderInvites } from '@/components/plans/PendingPlaceholderInvites';

const CreatePlanDialog = lazy(() => import('@/components/plans/CreatePlanDialog'));
const InviteToPlanDialog = lazy(() => import('@/components/plans/InviteToPlanDialog'));
const SuggestFriendDialog = lazy(() => import('@/components/plans/SuggestFriendDialog'));
const MergePlansDialog = lazy(() => import('@/components/plans/MergePlansDialog'));
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { PlanRsvpButtons } from '@/components/plans/PlanRsvpButtons';
import { ProposalVoting } from '@/components/plans/ProposalVoting';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getTimezoneAbbreviation } from '@/lib/timezone';

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Lisbon',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export default function PlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans, deletePlan, updatePlan, userId, loadPlans, loadFriends, friends: allFriends, userTimezone } = usePlannerStore();
  const { profile: currentUserProfile } = useCurrentUserProfile();
  
  const { changeRequests, respondToChange, refetch: refetchChangeRequests } = usePlanChangeRequests();
  const { pods } = usePods();

  const inviteToken = searchParams.get('invite_token');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isRespondingToChange, setIsRespondingToChange] = useState(false);
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [isUpdatingRsvp, setIsUpdatingRsvp] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [planId]);

  const plan = useMemo(() => plans.find(p => p.id === planId), [plans, planId]);

  // Fetch shared plan from DB if not in local store (e.g. friend's public plan from feed)
  const [sharedPlan, setSharedPlan] = useState<any>(null);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => {
    if (plan || !planId || !user?.id) return;
    setLoadingShared(true);
    (async () => {
      try {
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('id', planId)
          .single();
        if (!planData) { setLoadingShared(false); return; }

        // Fetch participants
        const { data: pData } = await supabase
          .from('plan_participants')
          .select('friend_id, status, role')
          .eq('plan_id', planId);

        // Fetch profiles for owner + participants
        const allIds = new Set([planData.user_id, ...(pData || []).map((p: any) => p.friend_id)]);
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', Array.from(allIds));
        const profileMap: Record<string, { name: string; avatar?: string }> = {};
        for (const p of (profiles || [])) {
          if (p.user_id) profileMap[p.user_id] = { name: p.display_name || 'Friend', avatar: p.avatar_url || undefined };
        }

        const planDate = new Date(planData.date);
        const endDate = planData.end_date ? new Date(planData.end_date) : undefined;
        setSharedPlan({
          id: planData.id,
          userId: planData.user_id,
          title: planData.title,
          activity: planData.activity,
          date: new Date(planDate.getUTCFullYear(), planDate.getUTCMonth(), planDate.getUTCDate()),
          endDate: endDate ? new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()) : undefined,
          timeSlot: planData.time_slot,
          duration: planData.duration,
          startTime: planData.start_time || undefined,
          endTime: planData.end_time || undefined,
          location: planData.location ? { id: planData.id, name: planData.location, address: '' } : undefined,
          notes: planData.notes || undefined,
          status: planData.status,
          feedVisibility: planData.feed_visibility || 'private',
          sourceTimezone: planData.source_timezone || undefined,
          source: planData.source || undefined,
          participants: [
            { id: planData.user_id, name: profileMap[planData.user_id]?.name || 'Someone', avatar: profileMap[planData.user_id]?.avatar, friendUserId: planData.user_id, status: 'connected', role: 'participant' },
            ...(pData || []).map((pp: any) => ({
              id: pp.friend_id,
              name: profileMap[pp.friend_id]?.name || 'Friend',
              avatar: profileMap[pp.friend_id]?.avatar,
              friendUserId: pp.friend_id,
              status: pp.status,
              role: pp.role || 'participant',
            })),
          ],
        });
      } catch (err) {
        console.error('Failed to fetch shared plan:', err);
      } finally {
        setLoadingShared(false);
      }
    })();
  }, [plan, planId, user?.id]);

  // Inline add friend logic (hooks must be before early returns)
  const effectivePlan = plan || sharedPlan;

  const existingParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    if (effectivePlan) {
      if (effectivePlan.userId) ids.add(effectivePlan.userId);
      for (const p of effectivePlan.participants) {
        if (p.friendUserId) ids.add(p.friendUserId);
      }
    }
    return ids;
  }, [effectivePlan]);

  const availableFriends = useMemo(() => {
    return allFriends
      .filter(f => f.status === 'connected' && f.friendUserId && !existingParticipantIds.has(f.friendUserId!))
      .filter(f => !friendSearch || f.name.toLowerCase().includes(friendSearch.toLowerCase()));
  }, [allFriends, existingParticipantIds, friendSearch]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setAcceptingInvite(true);
    try {
      const { data, error } = await supabase.rpc('accept_plan_invite', { p_token: inviteToken });
      if (error) throw error;
      toast.success("You've joined the plan!");
      setInviteAccepted(true);
      searchParams.delete('invite_token');
      setSearchParams(searchParams, { replace: true });
      await Promise.all([loadPlans(), loadFriends()]);
    } catch (err: any) {
      if (err.message?.includes('Already a participant')) {
        toast.info("You're already part of this plan.");
        setInviteAccepted(true);
        searchParams.delete('invite_token');
        setSearchParams(searchParams, { replace: true });
      } else {
        toast.error(err.message || 'Failed to accept invite');
      }
    } finally {
      setAcceptingInvite(false);
    }
  };

  // If plan not in local store but we have an invite token, fetch via RPC
  const [invitePreview, setInvitePreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(!!inviteToken);

  useEffect(() => {
    if (effectivePlan || !inviteToken || inviteAccepted) {
      setLoadingPreview(false);
      return;
    }
    const fetchPreview = async () => {
      const { data } = await supabase.rpc('get_plan_invite_details', { p_token: inviteToken });
      if (data && (data as any[]).length > 0) {
        setInvitePreview((data as any[])[0]);
      }
      setLoadingPreview(false);
    };
    fetchPreview();
  }, [effectivePlan, inviteToken, inviteAccepted]);

  if (loadingPreview || loadingShared) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Build a display plan from either the store plan, shared plan, or invite preview
  const displayPlan = effectivePlan || (invitePreview ? {
    id: invitePreview.plan_id,
    title: invitePreview.plan_title,
    activity: invitePreview.plan_activity,
    date: new Date(invitePreview.plan_date),
    endDate: undefined,
    timeSlot: invitePreview.plan_time_slot,
    duration: invitePreview.plan_duration,
    startTime: invitePreview.plan_start_time,
    endTime: invitePreview.plan_end_time,
    location: invitePreview.plan_location ? { id: '', name: invitePreview.plan_location, address: '' } : undefined,
    notes: invitePreview.plan_notes,
    status: 'confirmed' as const,
    participants: [],
    userId: undefined,
  } : null);

  if (!displayPlan) {
    return (
      <div className="animate-fade-in space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-soft">
          <div className="mx-auto mb-4 text-6xl">🔍</div>
          <h3 className="font-display text-xl font-semibold">Plan not found</h3>
          <p className="mt-2 text-muted-foreground">This plan may have been deleted or you don't have access.</p>
        </div>
      </div>
    );
  }

  const activityConfig = ACTIVITY_CONFIG[displayPlan.activity as keyof typeof ACTIVITY_CONFIG] || { label: 'Activity', icon: '✨', color: 'activity-misc', vibeType: 'social' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[displayPlan.timeSlot as keyof typeof TIME_SLOT_LABELS];
  const isOwner = plan ? (!plan.userId || plan.userId === userId) : false;
  // The store filters the current user out of participants, so use myRsvpStatus/myRole instead
  const isParticipant = plan ? (plan.myRsvpStatus !== undefined && !isOwner) : false;
  const canEdit = isOwner || isParticipant;
  const isInvitePreview = !effectivePlan && !!invitePreview;
  const isPast = displayPlan ? (displayPlan.endDate || displayPlan.date) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
  const changeRequest = plan ? changeRequests.find(cr => cr.planId === plan.id) : undefined;
  const participants = (displayPlan.participants || []).filter((p: any) => p.role !== 'subscriber');
  const subscribers = (displayPlan.participants || []).filter((p: any) => p.role === 'subscriber');
  const myRsvpStatus = plan?.myRsvpStatus || (isOwner ? 'accepted' : undefined);


  const handleRsvpChange = async (newStatus: string) => {
    if (!plan || !userId || isOwner) return;
    setIsUpdatingRsvp(true);
    try {
      const { error } = await supabase
        .from('plan_participants')
        .update({ status: newStatus, responded_at: new Date().toISOString() })
        .eq('plan_id', plan.id)
        .eq('friend_id', userId);
      if (error) throw error;
      toast.success(newStatus === 'accepted' ? "You're going!" : newStatus === 'maybe' ? 'Marked as maybe' : 'Declined');
      await loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update RSVP');
    } finally {
      setIsUpdatingRsvp(false);
    }
  };

  const handleRemoveParticipant = async (friendUserId: string, friendName: string) => {
    if (!plan || !isOwner) return;
    try {
      const { error } = await supabase
        .from('plan_participants')
        .delete()
        .eq('plan_id', plan.id)
        .eq('friend_id', friendUserId);
      if (error) throw error;
      toast.success(`Removed ${friendName}`);
      await loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove participant');
    }
  };

  const displayTitle = plan ? getPlanDisplayTitle(plan) : displayPlan.title;

  const handleDelete = async () => {
    if (!plan) return;
    const hadParticipants = plan.participants.length > 0;
    await deletePlan(plan.id);
    setDeleteConfirmOpen(false);
    if (!isOwner) {
      toast.success('You have declined this plan.');
    } else if (hadParticipants) {
      toast.success('Plan deleted. Participants have been notified.');
    } else {
      toast.success('Plan deleted.');
    }
    navigate('/plans');
  };

  const handleAcceptChange = async (changeRequestId: string) => {
    setIsRespondingToChange(true);
    const success = await respondToChange(changeRequestId, 'accepted');
    setIsRespondingToChange(false);
    if (success) toast.success('Change accepted!');
  };

  const handleDeclineChange = async (changeRequestId: string) => {
    setIsRespondingToChange(true);
    const success = await respondToChange(changeRequestId, 'declined');
    setIsRespondingToChange(false);
    if (success) toast.info('Change declined.');
  };

  const handleAddFriend = async (friendUserId: string) => {
    if (!plan) return;
    setIsAddingFriend(true);
    try {
      const { error } = await supabase
        .from('plan_participants')
        .insert({ plan_id: plan.id, friend_id: friendUserId, status: 'invited', role: 'participant' });
      if (error) throw error;

      // Notify the newly added participant via push + email
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const token = sessionData?.session?.access_token;
        if (!token || !user) return;
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        fetch(`https://${projectId}.supabase.co/functions/v1/on-plan-created`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: plan.id,
            creator_id: user.id,
            participant_ids: [friendUserId],
            plan_title: plan.title,
          }),
        }).catch(() => {});
      }).catch(() => {});

      toast.success('Friend added to plan!');
      setFriendSearch('');
      setAddFriendOpen(false);
      await loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add friend');
    } finally {
      setIsAddingFriend(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Invite acceptance banner */}
      {inviteToken && !inviteAccepted && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">You've been invited to this plan!</p>
            <p className="text-xs text-muted-foreground">Accept to add it to your plans and join the group.</p>
          </div>
          <Button onClick={handleAcceptInvite} disabled={acceptingInvite} size="sm" className="gap-2 shrink-0">
            {acceptingInvite ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Join Plan
          </Button>
        </div>
      )}

      {inviteAccepted && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm font-medium text-primary">You've joined this plan!</p>
        </div>
      )}

      {/* Main card */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden space-y-0">
        {/* Photos - prominent at top */}
        {plan && (
          <div className="-mb-0">
            <PlanPhotos planId={plan.id} />
          </div>
        )}

        {/* Proposal Voting (for multi-option proposals) */}
        {plan && plan.status === 'proposed' && (
          <div className="p-5 pb-0">
            <ProposalVoting
              planId={plan.id}
              isOwner={isOwner}
              participantCount={participants.length}
              voterProfiles={[
                ...(plan.userId ? [{
                  userId: plan.userId,
                  name: isOwner ? 'You' : (currentUserProfile?.display_name || 'Organizer'),
                  avatar: isOwner ? (currentUserProfile?.avatar_url || undefined) : undefined,
                }] : []),
                ...participants.map((p: any) => ({
                  userId: p.friendUserId || p.id,
                  name: p.name,
                  avatar: p.avatar,
                })),
              ]}
            />
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 items-start">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-xl shrink-0"
                style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
              >
                <ActivityIcon config={activityConfig} size={22} />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold leading-snug">{displayTitle}</h1>
                <p className="text-xs text-muted-foreground">{activityConfig.label}</p>
                {displayPlan.status === 'tentative' && (
                  <span className="inline-block mt-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    Tentative
                  </span>
                )}
              </div>
            </div>
            {isParticipant && myRsvpStatus && myRsvpStatus !== 'accepted' && myRsvpStatus !== 'declined' && (
              <span className="shrink-0 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                Pending
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {format(displayPlan.date, 'EEEE, MMMM d, yyyy')}
                {displayPlan.endDate && ` – ${format(displayPlan.endDate, 'EEEE, MMMM d, yyyy')}`}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {displayPlan.startTime || displayPlan.endTime ? (
                  <>
                    {displayPlan.startTime && formatTime12(displayPlan.startTime)}
                    {displayPlan.startTime && displayPlan.endTime && ' – '}
                    {displayPlan.endTime && formatTime12(displayPlan.endTime)}
                    <span className="text-muted-foreground/60 ml-1">{getTimezoneAbbreviation(userTimezone)}</span>
                    {timeSlotConfig && <span className="text-muted-foreground"> · {timeSlotConfig.label}</span>}
                  </>
                ) : timeSlotConfig ? (
                  <>
                    {timeSlotConfig.label} ({timeSlotConfig.time})
                    <span className="text-muted-foreground/60 ml-1">{getTimezoneAbbreviation(userTimezone)}</span>
                  </>
                ) : null}
                {displayPlan.duration && !displayPlan.startTime && !displayPlan.endTime && (
                  <span className="text-muted-foreground">
                    {' · '}
                    {displayPlan.duration >= 60
                      ? `${Math.floor(displayPlan.duration / 60)}h${displayPlan.duration % 60 > 0 ? ` ${displayPlan.duration % 60}m` : ''}`
                      : `${displayPlan.duration}m`}
                  </span>
                )}
              </span>
            </div>
            {displayPlan.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{displayPlan.location.name}</span>
              </div>
            )}
            {/* Timezone display / edit */}
            {(() => {
              const tz = displayPlan.sourceTimezone;
              const isManual = !displayPlan.source || displayPlan.source === 'manual' || displayPlan.source === 'hang-request';
              const canEditTz = isOwner && isManual && !isPast;

              return (
                <div className="flex items-center gap-3 text-sm">
                  <Globe2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  {canEditTz ? (
                    <Select
                      value={tz || ''}
                      onValueChange={async (newTz) => {
                        if (!plan) return;
                        try {
                          await supabase.from('plans').update({ source_timezone: newTz }).eq('id', plan.id);
                          await loadPlans();
                          toast.success('Timezone set');
                        } catch {
                          toast.error("Couldn't update the timezone — try again?");
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-auto min-w-[160px] text-sm border-none shadow-none px-0 hover:bg-muted/50 gap-1">
                        <SelectValue placeholder="Set timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {COMMON_TIMEZONES.map(tzOpt => (
                          <SelectItem key={tzOpt} value={tzOpt} className="text-sm">
                            {tzOpt.replace(/_/g, ' ')} ({getTimezoneAbbreviation(tzOpt)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">
                      {tz ? `${tz.replace(/_/g, ' ')} (${getTimezoneAbbreviation(tz)})` : userTimezone.replace(/_/g, ' ') + ` (${getTimezoneAbbreviation(userTimezone)})`}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Participants with avatars and RSVP status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider !font-sans">Participants</h3>
              {plan && !isPast && canEdit && (
                <Popover open={addFriendOpen} onOpenChange={(open) => { setAddFriendOpen(open); if (!open) setFriendSearch(''); }}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs text-primary px-2">
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search friends..."
                        value={friendSearch}
                        onChange={(e) => setFriendSearch(e.target.value)}
                        className="h-8 pl-7 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {availableFriends.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          {friendSearch ? 'No matching friends' : 'All friends already added'}
                        </p>
                      ) : (
                        availableFriends.slice(0, 10).map(f => (
                          <button
                            key={f.friendUserId}
                            className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
                            onClick={() => handleAddFriend(f.friendUserId!)}
                            disabled={isAddingFriend}
                          >
                            <Avatar className="h-6 w-6 ring-1 ring-border">
                              {f.avatar ? (
                                <AvatarImage src={f.avatar} alt={f.name} className="object-cover" />
                              ) : (
                                <AvatarImage src={getElephantAvatar(f.friendUserId || f.name)} alt={f.name} />
                              )}
                              <AvatarFallback className="text-[9px]">{f.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">{f.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {participants.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {participants.map((p: any) => {
                  const rsvpLabel = p.rsvpStatus === 'accepted' ? 'Going' 
                    : p.rsvpStatus === 'maybe' ? 'Maybe'
                    : p.rsvpStatus === 'declined' ? 'Declined'
                    : 'Invited';
                  const rsvpColor = p.rsvpStatus === 'accepted' ? 'text-primary'
                    : p.rsvpStatus === 'maybe' ? 'text-amber-500'
                    : p.rsvpStatus === 'declined' ? 'text-destructive'
                    : 'text-muted-foreground';
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <FriendLink userId={p.friendUserId} className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7 ring-1 ring-border">
                          {p.avatar ? (
                            <AvatarImage src={p.avatar} alt={p.name} className="object-cover" />
                          ) : (
                            <AvatarImage src={getElephantAvatar(p.friendUserId || p.name)} alt={p.name} />
                          )}
                          <AvatarFallback className="text-[10px]">{p.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm hover:underline">{p.name}</span>
                      </FriendLink>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${rsvpColor}`}>{rsvpLabel}</span>
                        {isOwner && p.friendUserId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveParticipant(p.friendUserId, p.name)}
                            title="Remove participant"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No participants yet</p>
            )}
          </div>

          {/* Pending placeholder invites (non-Parade friends) */}
          {planId && (
            <PendingPlaceholderInvites planId={planId} isOwner={isOwner} />
          )}

          {/* Subscribers */}
          {subscribers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider !font-sans">Subscribers</h3>
              <div className="flex flex-wrap gap-2">
                {subscribers.map(p => (
                  <FriendLink key={p.id} userId={p.friendUserId} className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2">
                    <Avatar className="h-6 w-6 ring-1 ring-border">
                      {(p as any).avatar ? (
                        <AvatarImage src={(p as any).avatar} alt={p.name} className="object-cover" />
                      ) : (
                        <AvatarImage src={getElephantAvatar(p.friendUserId || p.name)} alt={p.name} />
                      )}
                      <AvatarFallback className="text-[9px]">{p.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground hover:underline">{p.name}</span>
                  </FriendLink>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {displayPlan.notes && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider !font-sans">Notes</h3>
              <p className="text-sm bg-muted/30 rounded-lg p-3">{displayPlan.notes}</p>
            </div>
          )}

          {/* Visibility - compact inline */}
          {plan && isOwner && (
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider !font-sans">Visibility</h3>
              <Select
                value={plan.feedVisibility || 'private'}
                onValueChange={async (value: string) => {
                  await updatePlan(plan.id, { feedVisibility: value as FeedVisibility });
                  toast.success('Visibility updated');
                }}
              >
                <SelectTrigger className="w-auto h-7 text-xs gap-1.5 px-2.5 border-none bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Private</span>
                  </SelectItem>
                  <SelectItem value="friends">
                    <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> All Friends</span>
                  </SelectItem>
                  {pods.map(pod => (
                    <SelectItem key={pod.id} value={`pod:${pod.id}`}>
                      <span className="flex items-center gap-1.5">{pod.emoji} {pod.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* RSVP buttons for non-owner participants */}
          {plan && isParticipant && !isOwner && !isPast && userId && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider !font-sans">Your RSVP</h3>
              <PlanRsvpButtons
                planId={plan.id}
                userId={userId}
                currentStatus={myRsvpStatus}
                compact
              />
            </div>
          )}

        {changeRequest && (
          <PlanChangeRequestBadge
            changeRequest={changeRequest}
            onAccept={handleAcceptChange}
            onDecline={handleDeclineChange}
            isResponding={isRespondingToChange}
          />
        )}

        {/* Actions - only show when user has access to the plan (not invite preview) */}
        {plan && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {canEdit && !isPast && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4" /> Edit
              </Button>
            )}

            {!isPast && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setInviteDialogOpen(true)}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            )}

            {canEdit && !isPast && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                setMergeSelectedIds([plan.id]);
                setMergeOpen(true);
              }}>
                <Merge className="h-4 w-4" /> Merge
              </Button>
            )}

            {!isOwner && !isPast && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setSuggestDialogOpen(true)}>
                <UserPlus className="h-4 w-4" /> Suggest Friend
              </Button>
            )}


            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive ml-auto"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {isOwner ? 'Delete' : 'Decline'}
            </Button>
          </div>
        )}

        {/* Comments section */}
        {(plan || sharedPlan) && (
          <PlanComments planId={displayPlan.id} />
        )}
        </div>
      </div>

      {/* Edit dialog */}
      {plan && editDialogOpen && (
        <Suspense fallback={null}>
          <CreatePlanDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            editPlan={plan}
            onChangeProposed={refetchChangeRequests}
          />
        </Suspense>
      )}

      {/* Invite dialog */}
      {plan && inviteDialogOpen && (
        <Suspense fallback={null}>
          <InviteToPlanDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
            planId={plan.id}
            planTitle={displayTitle}
          />
        </Suspense>
      )}

      {/* Suggest friend dialog (for non-organizers) */}
      {plan && !isOwner && suggestDialogOpen && (
        <Suspense fallback={null}>
          <SuggestFriendDialog
            open={suggestDialogOpen}
            onOpenChange={setSuggestDialogOpen}
            planId={plan.id}
            planTitle={displayTitle}
            existingParticipantIds={participants.map((p: any) => p.friendUserId).filter(Boolean)}
            organizerId={plan.userId || ''}
          />
        </Suspense>
      )}

      {/* Merge dialog */}
      {mergeOpen && (
        <Suspense fallback={null}>
          <MergePlansDialog
            open={mergeOpen}
            onOpenChange={setMergeOpen}
            preselectedPlanIds={mergeSelectedIds}
            onMerged={() => navigate('/availability')}
          />
        </Suspense>
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isOwner ? 'Delete plan?' : 'Decline this plan?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {!isOwner
                ? `This will remove "${displayTitle}" from your plans and show as a decline to the organiser.`
                : (plan?.participants?.length ?? 0) > 0
                  ? `This will permanently delete "${displayTitle}" and notify ${plan?.participants.map(p => p.name).join(', ')} that the plan has been cancelled.`
                  : `This will permanently delete "${displayTitle}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isOwner ? 'Delete' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
