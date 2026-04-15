import { useState, useEffect } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications, dismissNotification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, UserPlus, Users, Inbox, Calendar, Clock, MessageSquare, Mail, Loader2, CalendarCheck, AlertTriangle, Camera, MapPin, CalendarPlus, Plane } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { toast as sonnerToast } from 'sonner';
import { TIME_SLOT_LABELS, TimeSlot, ACTIVITY_CONFIG, ActivityType } from '@/types/planner';
import { SwipeableDismiss } from '@/components/ui/SwipeableDismiss';
import { AnimatePresence } from 'framer-motion';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';
import confetti from 'canvas-confetti';

const HANG_SLOT_LABELS: Record<string, string> = {
  early_morning: 'Early Morning (6-9am)',
  late_morning: 'Late Morning (9am-12pm)',
  early_afternoon: 'Early Afternoon (12-3pm)',
  late_afternoon: 'Late Afternoon (3-6pm)',
  evening: 'Evening (6-9pm)',
  late_night: 'Late Night (9pm+)',
};

interface PlanInvitation {
  id: string;
  plan_id: string;
  plan_title: string;
  plan_activity: string;
  plan_date: string;
  plan_time_slot: string;
  plan_location: string | null;
  organizer_name: string;
  organizer_id: string;
}

interface PendingChangeRequest {
  id: string;
  change_request_id: string;
  plan_title: string;
  proposed_by_name: string;
  proposed_date: string | null;
  proposed_time_slot: string | null;
  proposed_duration: number | null;
}

interface RecentPlanPhoto {
  id: string;
  plan_id: string;
  plan_title: string;
  uploader_name: string;
  created_at: string;
}

interface ParticipantRequest {
  id: string;
  plan_id: string;
  plan_title: string;
  friend_name: string;
  requester_name: string;
  created_at: string;
}


interface ProposedPlan {
  planId: string;
  participantRowId: string;
  title: string;
  activity: string;
  date: string;
  timeSlot: string;
  location: string | null;
  notes: string | null;
  proposerName: string;
  proposerAvatar: string | null;
  proposerUserId: string | null;
}
interface TripProposalNotification {
  id: string;
  proposal_id: string;
  creator_name: string;
  creator_avatar: string | null;
  destination: string | null;
  dates: { id: string; start_date: string; end_date: string; votes: number }[];
  created_at: string;
}

export default function Notifications() {
  const { friends, acceptFriendRequest, removeFriend, loadFriends, loadPlans, respondToProposal } = usePlannerStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refetchPlanInvites, refetchChangeRequests, refetchPlanPhotos, refetchParticipantRequests, refetchTripProposals, dismissedIds, dismissNotification: dismiss } = useNotifications();

  const [updating, setUpdating] = useState<string | null>(null);

  const [planInvitations, setPlanInvitations] = useState<PlanInvitation[]>([]);
  const [planInvitesLoading, setPlanInvitesLoading] = useState(true);

  const [pendingChanges, setPendingChanges] = useState<PendingChangeRequest[]>([]);
  const [changesLoading, setChangesLoading] = useState(true);

  const [recentPhotos, setRecentPhotos] = useState<RecentPlanPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  const [participantRequests, setParticipantRequests] = useState<ParticipantRequest[]>([]);
  const [participantReqLoading, setParticipantReqLoading] = useState(true);


  const [proposedPlans, setProposedPlans] = useState<ProposedPlan[]>([]);
  const [proposedLoading, setProposedLoading] = useState(true);
  const [counterProposal, setCounterProposal] = useState<ProposedPlan | null>(null);

  const [tripProposals, setTripProposals] = useState<TripProposalNotification[]>([]);
  const [tripProposalsLoading, setTripProposalsLoading] = useState(true);

  const incomingRequests = friends.filter(f => f.status === 'pending' && f.isIncoming);
  const visibleIncomingRequests = incomingRequests.filter(f => !dismissedIds.has(`friend-${f.id}`));
  const dismissedFriendRequestCount = incomingRequests.length - visibleIncomingRequests.length;

  // --- Dismiss button component ---
  const DismissButton = ({ id, className }: { id: string; className?: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); dismiss(id); }}
      className={`rounded-full p-1 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors ${className || ''}`}
      aria-label="Dismiss notification"
    >
      <X className="h-4 w-4" />
    </button>
  );

  useEffect(() => {
    if (user) {
      fetchPlanInvitations();
      fetchPendingChanges();
      fetchRecentPhotos();
      fetchParticipantRequestsData();
      
      fetchProposedPlans();
      fetchTripProposalsData();
    }
  }, [user]);

  const fetchProposedPlans = async () => {
    if (!user) { setProposedLoading(false); return; }
    const { data: participantRows } = await supabase
      .from('plan_participants')
      .select('id, plan_id, status')
      .eq('friend_id', user.id)
      .eq('status', 'invited');

    if (!participantRows?.length) { setProposedPlans([]); setProposedLoading(false); return; }

    const planIds = participantRows.map(r => r.plan_id);
    const { data: plans } = await supabase
      .from('plans')
      .select('id, title, activity, date, time_slot, location, notes, status, proposed_by')
      .in('id', planIds)
      .eq('status', 'proposed');

    if (!plans?.length) { setProposedPlans([]); setProposedLoading(false); return; }

    const proposerIds = [...new Set(plans.map(p => (p as any).proposed_by).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', proposerIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    setProposedPlans(plans.map(plan => {
      const participantRow = participantRows.find(r => r.plan_id === plan.id);
      const proposer = (plan as any).proposed_by ? profileMap.get((plan as any).proposed_by) : null;
      return {
        planId: plan.id,
        participantRowId: participantRow!.id,
        title: plan.title,
        activity: plan.activity,
        date: plan.date,
        timeSlot: plan.time_slot,
        location: plan.location,
        notes: plan.notes,
        proposerName: proposer?.display_name || 'Someone',
        proposerAvatar: proposer?.avatar_url || null,
        proposerUserId: (plan as any).proposed_by,
      };
    }));
    setProposedLoading(false);
  };

  const respondToProposedPlan = async (planId: string, participantRowId: string, response: 'accepted' | 'declined') => {
    setUpdating(participantRowId);
    await respondToProposal(planId, participantRowId, response);
    setProposedPlans(prev => prev.filter(p => p.participantRowId !== participantRowId));
    if (response === 'accepted') {
      confetti({ particleCount: 80, spread: 55, origin: { y: 0.75 },
        colors: ['#3D8C6C', '#FF6B6B', '#F59E0B', '#8B5CF6', '#3B82F6'] });
      sonnerToast.success('Plan accepted! It\'s on your calendar 🎉');
    } else {
      sonnerToast.success('Plan declined.');
    }
    setUpdating(null);
  };


  const fetchTripProposalsData = async () => {
    if (!user) { setTripProposalsLoading(false); return; }
    // Get pending trip proposal participations
    const { data: participations } = await supabase
      .from('trip_proposal_participants')
      .select('id, proposal_id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (!participations?.length) { setTripProposals([]); setTripProposalsLoading(false); return; }

    const proposalIds = [...new Set(participations.map(p => p.proposal_id))];
    const { data: proposals } = await supabase
      .from('trip_proposals')
      .select('id, created_by, destination, status, created_at')
      .in('id', proposalIds)
      .eq('status', 'pending');

    if (!proposals?.length) { setTripProposals([]); setTripProposalsLoading(false); return; }

    // Get dates for all proposals
    const { data: dates } = await supabase
      .from('trip_proposal_dates')
      .select('id, proposal_id, start_date, end_date, votes')
      .in('proposal_id', proposals.map(p => p.id))
      .order('start_date', { ascending: true });

    // Get creator profiles
    const creatorIds = [...new Set(proposals.map(p => p.created_by))];
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', creatorIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    setTripProposals(proposals.map(proposal => {
      const participation = participations.find(p => p.proposal_id === proposal.id);
      const creator = profileMap.get(proposal.created_by);
      const proposalDates = (dates || []).filter(d => d.proposal_id === proposal.id);
      return {
        id: participation!.id,
        proposal_id: proposal.id,
        creator_name: creator?.display_name || 'Someone',
        creator_avatar: creator?.avatar_url || null,
        destination: proposal.destination,
        dates: proposalDates,
        created_at: proposal.created_at,
      };
    }));
    setTripProposalsLoading(false);
  };


  const fetchRecentPhotos = async () => {
    if (!user) { setPhotosLoading(false); return; }
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: photos } = await supabase
      .from('plan_photos')
      .select('id, plan_id, uploaded_by, created_at')
      .neq('uploaded_by', user.id)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!photos || photos.length === 0) {
      setRecentPhotos([]);
      setPhotosLoading(false);
      return;
    }

    const planIds = [...new Set(photos.map(p => p.plan_id))];
    const { data: plans } = await supabase
      .from('plans')
      .select('id, title')
      .in('id', planIds);
    const planMap: Record<string, string> = {};
    for (const p of (plans || [])) planMap[p.id] = p.title;

    const uploaderIds = [...new Set(photos.map(p => p.uploaded_by))];
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('user_id, display_name')
      .in('user_id', uploaderIds);
    const nameMap: Record<string, string> = {};
    for (const p of (profiles || [])) {
      if (p.user_id) nameMap[p.user_id] = p.display_name || 'Someone';
    }

    setRecentPhotos(photos.map(p => ({
      id: p.id,
      plan_id: p.plan_id,
      plan_title: planMap[p.plan_id] || 'Plan',
      uploader_name: nameMap[p.uploaded_by] || 'Someone',
      created_at: p.created_at,
    })));
    setPhotosLoading(false);
  };

  // Hang requests removed — replaced by plan proposal system

  // --- Plan Invitations ---
  const fetchPlanInvitations = async () => {
    if (!user) return;
    const { data: invites } = await supabase
      .from('plan_participants')
      .select('id, plan_id, status')
      .eq('friend_id', user.id)
      .eq('status', 'invited');

    if (!invites || invites.length === 0) {
      setPlanInvitations([]);
      setPlanInvitesLoading(false);
      return;
    }

    const planIds = invites.map(i => i.plan_id);
    const { data: plans } = await supabase
      .from('plans')
      .select('id, title, activity, date, time_slot, location, user_id')
      .in('id', planIds);

    const organizerIds = [...new Set((plans || []).map(p => p.user_id))];
    let organizerMap: Record<string, string> = {};
    if (organizerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('user_id, display_name')
        .in('user_id', organizerIds);
      for (const p of (profiles || [])) {
        if (p.user_id) organizerMap[p.user_id] = p.display_name || 'Someone';
      }
    }

    const mapped: PlanInvitation[] = invites.map(inv => {
      const plan = (plans || []).find(p => p.id === inv.plan_id);
      return {
        id: inv.id,
        plan_id: inv.plan_id,
        plan_title: plan?.title || 'Plan',
        plan_activity: plan?.activity || 'hanging-out',
        plan_date: plan?.date || '',
        plan_time_slot: plan?.time_slot || '',
        plan_location: plan?.location || null,
        organizer_name: plan ? (organizerMap[plan.user_id] || 'Someone') : 'Someone',
        organizer_id: plan?.user_id || '',
      };
    });

    setPlanInvitations(mapped);
    setPlanInvitesLoading(false);
  };

  const respondToPlanInvite = async (participantId: string, response: 'accepted' | 'declined') => {
    setUpdating(participantId);
    const { error } = await supabase
      .from('plan_participants')
      .update({ status: response })
      .eq('id', participantId);

    if (error) {
      sonnerToast.error('Failed to respond');
    } else {
      sonnerToast.success(response === 'accepted' ? 'Plan accepted! 🎉' : 'Plan declined');
      setPlanInvitations(prev => prev.filter(i => i.id !== participantId));
      await refetchPlanInvites();
      await loadPlans();
    }
    setUpdating(null);
  };

  // --- Pending Change Requests ---
  const fetchPendingChanges = async () => {
    if (!user) return;
    const { data: responses } = await supabase
      .from('plan_change_responses')
      .select('id, change_request_id')
      .eq('participant_id', user.id)
      .eq('response', 'pending');

    if (!responses || responses.length === 0) {
      setPendingChanges([]);
      setChangesLoading(false);
      return;
    }

    const crIds = responses.map(r => r.change_request_id);
    const { data: requests } = await supabase
      .from('plan_change_requests')
      .select('id, plan_id, proposed_by, proposed_date, proposed_time_slot, proposed_duration')
      .in('id', crIds)
      .eq('status', 'pending');

    if (!requests || requests.length === 0) {
      setPendingChanges([]);
      setChangesLoading(false);
      return;
    }

    const planIds = [...new Set(requests.map(r => r.plan_id))];
    const { data: plans } = await supabase
      .from('plans')
      .select('id, title')
      .in('id', planIds);
    const planMap: Record<string, string> = {};
    for (const p of (plans || [])) planMap[p.id] = p.title;

    const proposerIds = [...new Set(requests.map(r => r.proposed_by))];
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('user_id, display_name')
      .in('user_id', proposerIds);
    const nameMap: Record<string, string> = {};
    for (const p of (profiles || [])) {
      if (p.user_id) nameMap[p.user_id] = p.display_name || 'Someone';
    }

    const mapped: PendingChangeRequest[] = responses.map(resp => {
      const req = requests.find(r => r.id === resp.change_request_id);
      return {
        id: resp.id,
        change_request_id: resp.change_request_id,
        plan_title: req ? (planMap[req.plan_id] || 'Plan') : 'Plan',
        proposed_by_name: req ? (nameMap[req.proposed_by] || 'Someone') : 'Someone',
        proposed_date: req?.proposed_date || null,
        proposed_time_slot: req?.proposed_time_slot || null,
        proposed_duration: req?.proposed_duration || null,
      };
    });

    setPendingChanges(mapped);
    setChangesLoading(false);
  };

  const respondToChangeRequest = async (changeRequestId: string, responseId: string, response: 'accepted' | 'declined') => {
    setUpdating(responseId);
    const { error } = await supabase
      .from('plan_change_responses')
      .update({ response, responded_at: new Date().toISOString() })
      .eq('id', responseId);

    if (error) {
      sonnerToast.error('Failed to respond');
    } else {
      sonnerToast.success(response === 'accepted' ? 'Change accepted!' : 'Change declined');
      setPendingChanges(prev => prev.filter(c => c.id !== responseId));
      await refetchChangeRequests();
      await loadPlans();
    }
    setUpdating(null);
  };

  // --- Participant Requests (organizer approval) ---
  const fetchParticipantRequestsData = async () => {
    if (!user) { setParticipantReqLoading(false); return; }
    // Get plans the user organizes
    const { data: ownedPlans } = await supabase
      .from('plans')
      .select('id, title')
      .eq('user_id', user.id);
    if (!ownedPlans || ownedPlans.length === 0) {
      setParticipantRequests([]);
      setParticipantReqLoading(false);
      return;
    }
    const planIds = ownedPlans.map(p => p.id);
    const planTitleMap: Record<string, string> = {};
    for (const p of ownedPlans) planTitleMap[p.id] = p.title;

    const { data: reqs } = await supabase
      .from('plan_participant_requests' as any)
      .select('*')
      .in('plan_id', planIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!reqs || reqs.length === 0) {
      setParticipantRequests([]);
      setParticipantReqLoading(false);
      return;
    }

    // Get requester names
    const requesterIds = [...new Set((reqs as any[]).map((r: any) => r.requested_by))];
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('user_id, display_name')
      .in('user_id', requesterIds);
    const nameMap: Record<string, string> = {};
    for (const p of (profiles || [])) {
      if (p.user_id) nameMap[p.user_id] = p.display_name || 'Someone';
    }

    setParticipantRequests((reqs as any[]).map((r: any) => ({
      id: r.id,
      plan_id: r.plan_id,
      plan_title: planTitleMap[r.plan_id] || 'Plan',
      friend_name: r.friend_name,
      requester_name: nameMap[r.requested_by] || 'Someone',
      created_at: r.created_at,
    })));
    setParticipantReqLoading(false);
  };

  const handleApproveParticipantRequest = async (requestId: string) => {
    setUpdating(requestId);
    const { error } = await supabase.rpc('approve_participant_request', { p_request_id: requestId });
    if (error) {
      sonnerToast.error(error.message || 'Failed to approve');
    } else {
      sonnerToast.success('Friend added to plan! 🎉');
      setParticipantRequests(prev => prev.filter(r => r.id !== requestId));
      await refetchParticipantRequests();
      await loadPlans();
    }
    setUpdating(null);
  };

  const handleDenyParticipantRequest = async (requestId: string) => {
    setUpdating(requestId);
    const { error } = await supabase
      .from('plan_participant_requests' as any)
      .update({ status: 'denied', resolved_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) {
      sonnerToast.error('Failed to deny request');
    } else {
      sonnerToast.info('Request denied');
      setParticipantRequests(prev => prev.filter(r => r.id !== requestId));
      await refetchParticipantRequests();
    }
    setUpdating(null);
  };

  // --- Friend Requests ---
  const handleAccept = async (id: string) => {
    const friend = friends.find(f => f.id === id);
    if (friend?.friendUserId) {
      await acceptFriendRequest(id, friend.friendUserId);
      toast({
        title: 'Friend request accepted! 🎉',
        description: `You and ${friend.name} are now connected`,
      });
    }
  };

  const handleDecline = async (id: string) => {
    const friend = friends.find(f => f.id === id);
    await removeFriend(id);
    toast({
      title: 'Request declined',
      description: friend ? `Declined request from ${friend.name}` : 'Friend request declined',
    });
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-availability-available/20 text-availability-available',
      'bg-availability-partial/20 text-availability-partial',
      'bg-primary/20 text-primary',
      'bg-secondary text-secondary-foreground',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const formatPlanDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return format(d, 'EEE, MMM d');
    } catch { return dateStr; }
  };

  const formatTimeSlot = (slot: string) => {
    const hyphenated = slot.replace('_', '-') as TimeSlot;
    return TIME_SLOT_LABELS[hyphenated]?.time || slot;
  };

  // Filter visible notifications by dismissed IDs
  const visiblePlanInvitations = planInvitations.filter(i => !dismissedIds.has(`invite-${i.id}`));
  const visiblePendingChanges = pendingChanges.filter(c => !dismissedIds.has(`change-${c.id}`));
  const visibleRecentPhotos = recentPhotos.filter(p => !dismissedIds.has(`photo-${p.id}`));
  const visibleParticipantRequests = participantRequests.filter(r => !dismissedIds.has(`participant-req-${r.id}`));
  
  const visibleProposedPlans = proposedPlans.filter(p => !dismissedIds.has(`proposal-${p.planId}`));
  const visibleTripProposals = tripProposals.filter(t => !dismissedIds.has(`trip-proposal-${t.id}`));

  const totalVisible = visibleIncomingRequests.length + visiblePlanInvitations.length + visiblePendingChanges.length + visibleRecentPhotos.length + visibleParticipantRequests.length + visibleProposedPlans.length + visibleTripProposals.length;
  const isEmpty = totalVisible === 0 && dismissedFriendRequestCount === 0 && !planInvitesLoading && !changesLoading && !photosLoading && !participantReqLoading && !proposedLoading && !tripProposalsLoading;

  const clearAll = () => {
    visiblePlanInvitations.forEach(i => dismiss(`invite-${i.id}`));
    visiblePendingChanges.forEach(c => dismiss(`change-${c.id}`));
    visibleRecentPhotos.forEach(p => dismiss(`photo-${p.id}`));
    visibleParticipantRequests.forEach(r => dismiss(`participant-req-${r.id}`));
    
    visibleProposedPlans.forEach(p => dismiss(`proposal-${p.planId}`));
    visibleTripProposals.forEach(t => dismiss(`trip-proposal-${t.id}`));
    visibleIncomingRequests.forEach(f => dismiss(`friend-${f.id}`));
  };

  return (
    <div className="animate-fade-in space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold md:text-2xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Stay updated with invitations, requests, and changes
          </p>
        </div>
        {totalVisible > 0 && (
          <Button size="sm" variant="outline" onClick={clearAll} className="shrink-0 gap-1.5">
            <X className="h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
      </div>

      {/* Plan Suggestions (proposed plans) */}
      {(visibleProposedPlans.length > 0 || proposedLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <CalendarPlus className="h-4 w-4 text-primary md:h-5 md:w-5" />
            Plan Suggestions
            {visibleProposedPlans.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {visibleProposedPlans.length}
              </span>
            )}
          </h2>

          {proposedLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence>
              {visibleProposedPlans.map((proposal) => (
                <SwipeableDismiss key={proposal.planId} onDismiss={() => dismiss(`proposal-${proposal.planId}`)}>
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-soft">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={proposal.proposerAvatar || undefined} />
                        <AvatarFallback className="text-xs bg-primary/15 text-primary">
                          {proposal.proposerName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{proposal.proposerName}</p>
                        <p className="text-xs text-muted-foreground">suggested a plan</p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-background border border-border p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <ActivityIcon config={ACTIVITY_CONFIG[proposal.activity as ActivityType]} size={16} />
                        <span className="text-sm font-medium">{proposal.title}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatPlanDate(proposal.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {TIME_SLOT_LABELS[proposal.timeSlot as TimeSlot]?.label || proposal.timeSlot}
                        </span>
                        {proposal.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {proposal.location}
                          </span>
                        )}
                      </div>
                      {proposal.notes && (
                        <p className="text-xs text-foreground italic">"{proposal.notes}"</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1"
                        onClick={() => respondToProposedPlan(proposal.planId, proposal.participantRowId, 'accepted')}
                        disabled={updating === proposal.participantRowId}>
                        {updating === proposal.participantRowId
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Check className="h-4 w-4" />}
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1"
                        onClick={() => setCounterProposal(proposal)}>
                        Counter
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => respondToProposedPlan(proposal.planId, proposal.participantRowId, 'declined')}
                        disabled={updating === proposal.participantRowId}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </SwipeableDismiss>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Trip Proposals Section */}
      {(visibleTripProposals.length > 0 || tripProposalsLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <Plane className="h-4 w-4 text-primary md:h-5 md:w-5" />
            Trip Proposals
            {visibleTripProposals.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {visibleTripProposals.length}
              </span>
            )}
          </h2>

          {tripProposalsLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence>
              {visibleTripProposals.map((trip) => (
                <SwipeableDismiss key={trip.id} onDismiss={() => dismiss(`trip-proposal-${trip.id}`)}>
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                          <Plane className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{trip.creator_name}</p>
                          <p className="text-xs text-muted-foreground">
                            shared trip options{trip.destination ? ` to ${trip.destination}` : ''}
                          </p>
                        </div>
                      </div>
                      <DismissButton id={`trip-proposal-${trip.id}`} />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {trip.dates.map((d) => (
                        <span key={d.id} className="inline-flex items-center gap-1 rounded-md bg-background border border-border px-2 py-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(d.start_date + 'T12:00:00'), 'MMM d')} – {format(new Date(d.end_date + 'T12:00:00'), 'MMM d')}
                          {d.votes > 0 && (
                            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                              {d.votes} {d.votes === 1 ? 'vote' : 'votes'}
                            </Badge>
                          )}
                        </span>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => navigate('/trips')}
                    >
                      <Plane className="h-4 w-4" />
                      View & Vote
                    </Button>
                  </div>
                </SwipeableDismiss>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Participant Requests Section (organizer approval) */}
      {(visibleParticipantRequests.length > 0 || participantReqLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <UserPlus className="h-4 w-4 text-primary md:h-5 md:w-5" />
            Participant Suggestions
            {visibleParticipantRequests.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {visibleParticipantRequests.length}
              </span>
            )}
          </h2>

          {participantReqLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence>
              {visibleParticipantRequests.map((req) => (
                <SwipeableDismiss key={req.id} onDismiss={() => dismiss(`participant-req-${req.id}`)}>
                  <div
                    className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">
                          Add <span className="text-primary">{req.friend_name}</span> to {req.plan_title}?
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Suggested by {req.requester_name}
                        </p>
                      </div>
                      <DismissButton id={`participant-req-${req.id}`} />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleApproveParticipantRequest(req.id)}
                        disabled={updating === req.id}
                        className="flex-1 gap-1"
                      >
                        {updating === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDenyParticipantRequest(req.id)}
                        disabled={updating === req.id}
                        className="flex-1 gap-1"
                      >
                        <X className="h-4 w-4" />
                        Deny
                      </Button>
                    </div>
                  </div>
                </SwipeableDismiss>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}


      {(visiblePlanInvitations.length > 0 || planInvitesLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <CalendarCheck className="h-4 w-4 text-primary md:h-5 md:w-5" />
            Plan Invitations
            {visiblePlanInvitations.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {visiblePlanInvitations.length}
              </span>
            )}
          </h2>

          {planInvitesLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence>
              {visiblePlanInvitations.map((invite) => (
                <SwipeableDismiss key={invite.id} onDismiss={() => dismiss(`invite-${invite.id}`)}>
                  <div
                    className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{invite.plan_title}</p>
                        <p className="text-sm text-muted-foreground">
                          {invite.organizer_name} invited you
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="shrink-0">New</Badge>
                        <DismissButton id={`invite-${invite.id}`} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatPlanDate(invite.plan_date)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimeSlot(invite.plan_time_slot)}
                      </span>
                      {invite.plan_location && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                          📍 {invite.plan_location}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => respondToPlanInvite(invite.id, 'accepted')}
                        disabled={updating === invite.id}
                        className="flex-1 gap-1"
                      >
                        {updating === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondToPlanInvite(invite.id, 'declined')}
                        disabled={updating === invite.id}
                        className="flex-1 gap-1"
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </SwipeableDismiss>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Plan Change Requests Section */}
      {(visiblePendingChanges.length > 0 || changesLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <AlertTriangle className="h-4 w-4 text-amber-500 md:h-5 md:w-5" />
            Plan Changes
            {visiblePendingChanges.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white md:h-6 md:w-6 md:text-xs">
                {visiblePendingChanges.length}
              </span>
            )}
          </h2>

          {changesLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence>
              {visiblePendingChanges.map((change) => (
                <SwipeableDismiss key={change.id} onDismiss={() => dismiss(`change-${change.id}`)}>
                  <div
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3 shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{change.plan_title}</p>
                        <p className="text-sm text-muted-foreground">
                          {change.proposed_by_name} proposed a change
                        </p>
                      </div>
                      <DismissButton id={`change-${change.id}`} />
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {change.proposed_date && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          New date: {formatPlanDate(change.proposed_date)}
                        </span>
                      )}
                      {change.proposed_time_slot && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          New time: {formatTimeSlot(change.proposed_time_slot)}
                        </span>
                      )}
                      {change.proposed_duration && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Duration: {change.proposed_duration >= 60
                            ? `${Math.floor(change.proposed_duration / 60)}h${change.proposed_duration % 60 > 0 ? ` ${change.proposed_duration % 60}m` : ''}`
                            : `${change.proposed_duration}m`}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => respondToChangeRequest(change.change_request_id, change.id, 'accepted')}
                        disabled={updating === change.id}
                        className="flex-1 gap-1"
                      >
                        {updating === change.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondToChangeRequest(change.change_request_id, change.id, 'declined')}
                        disabled={updating === change.id}
                        className="flex-1 gap-1"
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </SwipeableDismiss>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}



      {/* New Plan Photos Section */}
      {(visibleRecentPhotos.length > 0 || photosLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <Camera className="h-4 w-4 text-primary md:h-5 md:w-5" />
            New Photos
            {visibleRecentPhotos.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {visibleRecentPhotos.length}
              </span>
            )}
          </h2>

          {photosLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence>
              {visibleRecentPhotos.map((photo) => (
                <SwipeableDismiss key={photo.id} onDismiss={() => dismiss(`photo-${photo.id}`)}>
                  <div
                    className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors shadow-soft"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1"
                      onClick={() => navigate(`/plan/${photo.plan_id}`)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Camera className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {photo.uploader_name} added a photo to <span className="text-primary">{photo.plan_title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(photo.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <DismissButton id={`photo-${photo.id}`} />
                  </div>
                </SwipeableDismiss>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Friend Requests Section */}
      {(visibleIncomingRequests.length > 0 || dismissedFriendRequestCount > 0) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <UserPlus className="h-4 w-4 text-primary md:h-5 md:w-5" />
            Friend Requests
            {incomingRequests.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {incomingRequests.length}
              </span>
            )}
          </h2>

          {visibleIncomingRequests.length > 0 ? (
            <AnimatePresence>
              {visibleIncomingRequests.map((friend) => (
                <SwipeableDismiss key={friend.id} onDismiss={() => dismiss(`friend-${friend.id}`)}>
                  <div
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={friend.avatar} />
                        <AvatarFallback className={getAvatarColor(friend.name)}>
                          {getInitials(friend.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{friend.name}</p>
                        <p className="text-sm text-muted-foreground">wants to connect with you</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecline(friend.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                      <Button size="sm" onClick={() => handleAccept(friend.id)}>
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <DismissButton id={`friend-${friend.id}`} />
                    </div>
                  </div>
                </SwipeableDismiss>
              ))}
            </AnimatePresence>
          ) : dismissedFriendRequestCount > 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-soft">
              <p className="text-sm text-muted-foreground">
                {dismissedFriendRequestCount} pending friend {dismissedFriendRequestCount === 1 ? 'request' : 'requests'} dismissed from view
              </p>
              <Button
                onClick={() => navigate('/friends')}
                size="sm"
                variant="outline"
                className="mt-2 gap-2"
              >
                <Users className="h-4 w-4" />
                View in Friends
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !planInvitesLoading && !changesLoading && !photosLoading && !participantReqLoading && incomingRequests.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft md:rounded-2xl md:p-8">
          <div className="mx-auto mb-3 text-4xl md:mb-4 md:text-5xl">🔔</div>
          <h3 className="font-display text-base font-semibold md:text-lg">No new notifications</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You're all caught up! When friends send you requests, they'll appear here.
          </p>
          <Button
            onClick={() => navigate('/friends')}
            size="sm"
            variant="outline"
            className="mt-4 gap-2"
          >
            <Users className="h-4 w-4" />
            Find Friends
          </Button>
        </div>
      )}

      {/* Counter proposal sheet */}
      <QuickPlanSheet
        open={!!counterProposal}
        onOpenChange={(open) => { if (!open) setCounterProposal(null); }}
        preSelectedFriend={counterProposal ? {
          userId: counterProposal.proposerUserId || '',
          name: counterProposal.proposerName,
          avatar: counterProposal.proposerAvatar || undefined,
        } : undefined}
      />
    </div>
  );
}
