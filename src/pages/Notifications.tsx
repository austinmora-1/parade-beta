import { useState, useEffect } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, UserPlus, Users, Inbox, Calendar, Clock, MessageSquare, Mail, Loader2, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { toast as sonnerToast } from 'sonner';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';

const HANG_SLOT_LABELS: Record<string, string> = {
  early_morning: 'Early Morning (6-9am)',
  late_morning: 'Late Morning (9am-12pm)',
  early_afternoon: 'Early Afternoon (12-3pm)',
  late_afternoon: 'Late Afternoon (3-6pm)',
  evening: 'Evening (6-9pm)',
  late_night: 'Late Night (9pm+)',
};

interface HangRequest {
  id: string;
  requester_name: string;
  requester_email: string | null;
  message: string | null;
  selected_day: string;
  selected_slot: string;
  status: string;
  created_at: string;
}

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

export default function Notifications() {
  const { friends, acceptFriendRequest, removeFriend, loadAllData } = usePlannerStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refetchHangRequests, refetchPlanInvites, refetchChangeRequests } = useNotifications();

  const [hangRequests, setHangRequests] = useState<HangRequest[]>([]);
  const [hangLoading, setHangLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const [planInvitations, setPlanInvitations] = useState<PlanInvitation[]>([]);
  const [planInvitesLoading, setPlanInvitesLoading] = useState(true);

  const [pendingChanges, setPendingChanges] = useState<PendingChangeRequest[]>([]);
  const [changesLoading, setChangesLoading] = useState(true);

  const incomingRequests = friends.filter(f => f.status === 'pending' && f.isIncoming);

  useEffect(() => {
    if (user) {
      fetchHangRequests();
      fetchPlanInvitations();
      fetchPendingChanges();
    }
  }, [user]);

  // --- Hang Requests ---
  const fetchHangRequests = async () => {
    const { data: reqs } = await supabase
      .from('hang_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    const { data: emails } = await supabase
      .from('hang_request_emails')
      .select('hang_request_id, requester_email');

    const emailMap = new Map(emails?.map(e => [e.hang_request_id, e.requester_email]) || []);
    setHangRequests((reqs || []).map(r => ({ ...r, requester_email: emailMap.get(r.id) || null })));
    setHangLoading(false);
  };

  const updateHangStatus = async (id: string, status: 'accepted' | 'declined') => {
    setUpdating(id);
    const { error } = await supabase.from('hang_requests').update({ status }).eq('id', id);
    if (error) {
      sonnerToast.error('Failed to update request');
    } else {
      sonnerToast.success(status === 'accepted' ? 'Request accepted! A plan has been created 🎉' : 'Request declined');
      setHangRequests(prev => prev.filter(r => r.id !== id));
      await refetchHangRequests();
      if (status === 'accepted') {
        await loadAllData();
      }
    }
    setUpdating(null);
  };

  // --- Plan Invitations ---
  const fetchPlanInvitations = async () => {
    if (!user) return;
    // Get plan_participants where I'm invited
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

    // Fetch plan details
    const planIds = invites.map(i => i.plan_id);
    const { data: plans } = await supabase
      .from('plans')
      .select('id, title, activity, date, time_slot, location, user_id')
      .in('id', planIds);

    // Get organizer names
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
        plan_activity: plan?.activity || 'other-events',
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
      await loadAllData();
    }
    setUpdating(null);
  };

  // --- Pending Change Requests ---
  const fetchPendingChanges = async () => {
    if (!user) return;
    // Get my pending responses
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

    // Fetch plan titles
    const planIds = [...new Set(requests.map(r => r.plan_id))];
    const { data: plans } = await supabase
      .from('plans')
      .select('id, title')
      .in('id', planIds);
    const planMap: Record<string, string> = {};
    for (const p of (plans || [])) planMap[p.id] = p.title;

    // Fetch proposer names
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
      await loadAllData();
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

  const isEmpty = incomingRequests.length === 0 && hangRequests.length === 0 && planInvitations.length === 0 && pendingChanges.length === 0 && !hangLoading && !planInvitesLoading && !changesLoading;

  return (
    <div className="animate-fade-in space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-lg font-bold md:text-2xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Stay updated with invitations, requests, and changes
        </p>
      </div>

      {/* Plan Invitations Section */}
      {(planInvitations.length > 0 || planInvitesLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <CalendarCheck className="h-4 w-4 text-primary md:h-5 md:w-5" />
            Plan Invitations
            {planInvitations.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {planInvitations.length}
              </span>
            )}
          </h2>

          {planInvitesLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {planInvitations.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{invite.plan_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {invite.organizer_name} invited you
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">New</Badge>
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plan Change Requests Section */}
      {(pendingChanges.length > 0 || changesLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <AlertTriangle className="h-4 w-4 text-amber-500 md:h-5 md:w-5" />
            Plan Changes
            {pendingChanges.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white md:h-6 md:w-6 md:text-xs">
                {pendingChanges.length}
              </span>
            )}
          </h2>

          {changesLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {pendingChanges.map((change) => (
                <div
                  key={change.id}
                  className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3 shadow-soft"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{change.plan_title}</p>
                    <p className="text-sm text-muted-foreground">
                      {change.proposed_by_name} proposed a change
                    </p>
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hang Requests Section */}
      {(hangRequests.length > 0 || hangLoading) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <Inbox className="h-4 w-4 text-primary md:h-5 md:w-5" />
            Hang Requests
            {hangRequests.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
                {hangRequests.length}
              </span>
            )}
          </h2>

          {hangLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {hangRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{request.requester_name}</p>
                      {request.requester_email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          {request.requester_email}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">wants to hang out</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">New</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(request.selected_day), 'EEE, MMM d')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {HANG_SLOT_LABELS[request.selected_slot] || request.selected_slot}
                    </span>
                  </div>

                  {request.message && (
                    <div className="flex items-start gap-2 rounded-lg bg-background p-3">
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-foreground">{request.message}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => updateHangStatus(request.id, 'accepted')}
                      disabled={updating === request.id}
                      className="flex-1 gap-1"
                    >
                      {updating === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateHangStatus(request.id, 'declined')}
                      disabled={updating === request.id}
                      className="flex-1 gap-1"
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Friend Requests Section */}
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

        {incomingRequests.length > 0 ? (
          <div className="space-y-3">
            {incomingRequests.map((friend) => (
              <div
                key={friend.id}
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
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
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
        ) : null}
      </div>
    </div>
  );
}
