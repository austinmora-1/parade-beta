import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Edit, MessageCircle, MapPin, Users, Clock, Trash2, Eye, Calendar, UserPlus, Check, Loader2 } from 'lucide-react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useConversations } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { FriendLink } from '@/components/ui/FriendLink';
import { Button } from '@/components/ui/button';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { usePlanChangeRequests } from '@/hooks/usePlanChangeRequests';
import { PlanChangeRequestBadge } from '@/components/plans/PlanChangeRequestBadge';
import { PlanPhotos } from '@/components/plans/PlanPhotos';
import { InviteToPlanDialog } from '@/components/plans/InviteToPlanDialog';
import { supabase } from '@/integrations/supabase/client';
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
  const { plans, deletePlan, userId, loadAllData } = usePlannerStore();
  const { createGroup, createDM } = useConversations();
  const { changeRequests, respondToChange, refetch: refetchChangeRequests } = usePlanChangeRequests();

  const inviteToken = searchParams.get('invite_token');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isRespondingToChange, setIsRespondingToChange] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [planId]);

  const plan = useMemo(() => plans.find(p => p.id === planId), [plans, planId]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setAcceptingInvite(true);
    try {
      const { data, error } = await supabase.rpc('accept_plan_invite', { p_token: inviteToken });
      if (error) throw error;
      toast.success("You've joined the plan!");
      setInviteAccepted(true);
      // Remove token from URL
      searchParams.delete('invite_token');
      setSearchParams(searchParams, { replace: true });
      // Reload data so the plan appears in the user's list
      await loadAllData();
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
    if (plan || !inviteToken || inviteAccepted) {
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
  }, [plan, inviteToken, inviteAccepted]);

  if (loadingPreview) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Build a display plan from either the store plan or the invite preview
  const displayPlan = plan || (invitePreview ? {
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
  const isInvitePreview = !plan && !!invitePreview;
  const changeRequest = plan ? changeRequests.find(cr => cr.planId === plan.id) : undefined;
  const participants = (displayPlan.participants || []).filter((p: any) => p.role !== 'subscriber');
  const subscribers = (displayPlan.participants || []).filter((p: any) => p.role === 'subscriber');

  const displayTitle = plan ? getPlanDisplayTitle(plan) : displayPlan.title;

  const handleDelete = async () => {
    if (!plan) return;
    const hadParticipants = plan.participants.length > 0;
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

  const handleStartChat = async () => {
    if (!user || !plan) return;
    const participantUserIds = plan.participants
      .map(p => p.friendUserId)
      .filter((id): id is string => !!id && id !== user.id);

    if (participantUserIds.length === 0) {
      toast.info('No participants to chat with.');
      return;
    }

    setIsCreatingChat(true);
    try {
      let conversationId: string | null = null;

      if (participantUserIds.length === 1) {
        // DM for 1-on-1 plans
        conversationId = await createDM(participantUserIds[0]);
      } else {
        // Group chat for multi-participant plans
        conversationId = await createGroup(
          plan.title,
          participantUserIds
        );
      }

      if (conversationId) {
        navigate('/chat', { state: { conversationId } });
      }
    } catch (err) {
      console.error('Failed to create chat:', err);
      toast.error('Could not start chat. Please try again.');
    } finally {
      setIsCreatingChat(false);
    }
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
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 items-start">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl shrink-0"
              style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
            >
              <ActivityIcon config={activityConfig} size={32} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{displayTitle}</h1>
              <p className="text-sm text-muted-foreground">{activityConfig.label}</p>
              {displayPlan.status === 'tentative' && (
                <span className="inline-block mt-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Tentative
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
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
                  {timeSlotConfig && <span className="text-muted-foreground"> · {timeSlotConfig.label}</span>}
                </>
              ) : timeSlotConfig ? (
                <>
                  {timeSlotConfig.label} ({timeSlotConfig.time})
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
        </div>

        {/* Participants */}
        {participants.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Participants</h3>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <FriendLink userId={p.friendUserId}>
                    <span className="text-sm hover:underline">{p.name}</span>
                  </FriendLink>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscribers */}
        {subscribers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subscribers</h3>
            <div className="flex flex-wrap gap-2">
              {subscribers.map(p => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <FriendLink userId={p.friendUserId}>
                    <span className="text-sm text-muted-foreground hover:underline">{p.name}</span>
                  </FriendLink>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {displayPlan.notes && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</h3>
            <p className="text-sm bg-muted/30 rounded-lg p-3">{displayPlan.notes}</p>
          </div>
        )}

        {/* Photos */}
        {plan && <PlanPhotos planId={plan.id} />}

        {/* Change request */}
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
            {isOwner && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4" /> Edit Plan
              </Button>
            )}

            {isOwner && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4" /> Invite
              </Button>
            )}

            {plan.participants.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleStartChat}
                disabled={isCreatingChat}
              >
                <MessageCircle className="h-4 w-4" />
                {isCreatingChat ? 'Creating...' : 'Chat with Participants'}
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
      </div>

      {/* Edit dialog */}
      {plan && (
        <CreatePlanDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          editPlan={plan}
          onChangeProposed={refetchChangeRequests}
        />
      )}

      {/* Invite dialog */}
      {plan && (
        <InviteToPlanDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          planId={plan.id}
          planTitle={displayTitle}
        />
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
