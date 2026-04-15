import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, differenceInDays, isAfter, startOfDay, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, MapPin, Calendar, ChevronRight, Clock, Check, ThumbsUp, Loader2, Users, Home, Edit2, Trash2, Plus, X, Trophy, Sparkles, PartyPopper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Trip {
  id: string;
  location: string | null;
  start_date: string;
  end_date: string;
  priority_friend_ids: string[];
  available_slots: string[];
}

interface ProposalDate {
  id: string;
  start_date: string;
  end_date: string;
  votes: number;
}

interface ProposalParticipant {
  id: string;
  user_id: string;
  status: string;
  preferred_date_id: string | null;
  display_name: string;
  avatar_url: string | null;
}

interface TripVote {
  id: string;
  date_id: string;
  user_id: string;
  rank: number;
}

interface TripProposal {
  id: string;
  created_by: string;
  destination: string | null;
  status: string;
  created_at: string;
  creator_name: string;
  creator_avatar: string | null;
  dates: ProposalDate[];
  participants: ProposalParticipant[];
  myParticipantId: string;
  myVotedDateId: string | null;
  votes: TripVote[];
  proposal_type: string;
  host_user_id: string | null;
  host_name: string | null;
}

interface TripsListProps {
  refreshKey?: number;
}

const TRIPS_UPDATED_EVENT = 'trips:updated';

export function TripsList({ refreshKey }: TripsListProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [proposals, setProposals] = useState<TripProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .gte('end_date', today)
      .order('start_date', { ascending: true });

    if (!error && data) {
      setTrips(data);
    }

    setLoading(false);
  }, [user]);

  const fetchProposals = useCallback(async () => {
    if (!user) return;

    const { data: myParticipations } = await supabase
      .from('trip_proposal_participants')
      .select('id, proposal_id, status, preferred_date_id, user_id')
      .eq('user_id', user.id);

    if (!myParticipations?.length) {
      setProposals([]);
      return;
    }

    const proposalIds = myParticipations.map(p => p.proposal_id);

    const [
      { data: proposalsData },
      { data: datesData },
      { data: allParticipants },
    ] = await Promise.all([
      supabase.from('trip_proposals').select('*').in('id', proposalIds).eq('status', 'pending'),
      supabase.from('trip_proposal_dates').select('*').in('proposal_id', proposalIds).order('start_date'),
      supabase.from('trip_proposal_participants').select('*').in('proposal_id', proposalIds),
    ]);

    if (!proposalsData?.length) {
      setProposals([]);
      return;
    }

    // Fetch ranked votes from trip_proposal_votes
    const allDateIds = (datesData || []).map(d => d.id);
    const { data: votesData } = allDateIds.length > 0
      ? await supabase
          .from('trip_proposal_votes' as any)
          .select('*')
          .in('date_id', allDateIds)
      : { data: [] };

    const allUserIds = [
      ...new Set([
        ...proposalsData.map(p => p.created_by),
        ...(allParticipants || []).map(p => p.user_id),
      ]),
    ];
    const { data: profiles } = await supabase
      .rpc('get_display_names_for_users', { p_user_ids: allUserIds });
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, { name: p.display_name, avatar: p.avatar_url }])
    );

    const mapped: TripProposal[] = proposalsData.map(prop => {
      const myRow = myParticipations.find(p => p.proposal_id === prop.id)!;
      const creator = profileMap.get(prop.created_by);
      const propDates = (datesData || []).filter(d => d.proposal_id === prop.id);
      const propDateIds = new Set(propDates.map(d => d.id));
      const propVotes: TripVote[] = ((votesData as any[]) || [])
        .filter(v => propDateIds.has(v.date_id))
        .map(v => ({ id: v.id, date_id: v.date_id, user_id: v.user_id, rank: v.rank }));

      const propParticipants = (allParticipants || [])
        .filter(p => p.proposal_id === prop.id)
        .map(p => {
          const profile = profileMap.get(p.user_id);
          return {
            ...p,
            display_name: profile?.name || 'Unknown',
            avatar_url: profile?.avatar || null,
          };
        });

      return {
        id: prop.id,
        created_by: prop.created_by,
        destination: prop.destination,
        status: prop.status,
        created_at: prop.created_at,
        creator_name: creator?.name || 'Someone',
        creator_avatar: creator?.avatar || null,
        dates: propDates,
        participants: propParticipants,
        myParticipantId: myRow.id,
        myVotedDateId: myRow.preferred_date_id,
        votes: propVotes,
        proposal_type: (prop as any).proposal_type || 'trip',
        host_user_id: (prop as any).host_user_id || null,
        host_name: (prop as any).host_user_id ? (profileMap.get((prop as any).host_user_id)?.name || null) : null,
      };
    });

    setProposals(mapped);
  }, [user]);

  useEffect(() => {
    void fetchTrips();
    void fetchProposals();
  }, [fetchTrips, fetchProposals, refreshKey]);

  useEffect(() => {
    const handleTripsUpdated = () => {
      void fetchTrips();
      void fetchProposals();
    };

    window.addEventListener(TRIPS_UPDATED_EVENT, handleTripsUpdated);
    return () => {
      window.removeEventListener(TRIPS_UPDATED_EVENT, handleTripsUpdated);
    };
  }, [fetchTrips, fetchProposals]);

  const handleSubmitRankedVotes = async (
    proposalId: string,
    rankings: Record<string, number>, // dateId -> rank
    participantId: string
  ) => {
    if (!user) return;
    setVoting(proposalId);
    try {
      const proposal = proposals.find(p => p.id === proposalId);
      if (!proposal) throw new Error('Proposal not found');

      // Get all date IDs for this proposal
      const dateIds = proposal.dates.map(d => d.id);

      // Delete existing votes for this user on these dates
      await supabase
        .from('trip_proposal_votes' as any)
        .delete()
        .in('date_id', dateIds)
        .eq('user_id', user.id);

      // Insert new ranked votes
      const rows = Object.entries(rankings).map(([dateId, rank]) => ({
        date_id: dateId,
        user_id: user.id,
        rank,
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from('trip_proposal_votes' as any).insert(rows);
        if (error) throw error;
      }

      // Also update participant status to 'voted'
      await supabase
        .from('trip_proposal_participants')
        .update({ status: 'voted' })
        .eq('id', participantId);

      confetti({
        particleCount: 40,
        spread: 45,
        origin: { y: 0.7 },
        colors: ['#3D8C6C', '#F59E0B', '#3B82F6'],
        scalar: 0.8,
      });
      toast.success('Rankings submitted! ✈️');
      await fetchProposals();
    } catch (err) {
      console.error('Vote failed:', err);
      toast.error('Failed to vote. Try again?');
    } finally {
      setVoting(null);
    }
  };

  // Merge trips and proposals into a single chronologically sorted list
  const sortedItems = useMemo(() => {
    const items: { type: 'trip'; data: Trip; sortDate: string }[] = trips.map(t => ({
      type: 'trip' as const, data: t, sortDate: t.start_date,
    }));

    const proposalItems = proposals.map(p => {
      const earliestStart = p.dates.length > 0
        ? [...p.dates].sort((a, b) => a.start_date.localeCompare(b.start_date))[0].start_date
        : '9999-12-31';
      return { type: 'proposal' as const, data: p, sortDate: earliestStart };
    });

    return [...items, ...proposalItems].sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  }, [trips, proposals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground text-sm">Loading trips...</div>
      </div>
    );
  }

  if (trips.length === 0 && proposals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <Plane className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">No upcoming trips</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Add a trip from the button above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedItems.map(item => {
        if (item.type === 'proposal') {
          return (
            <ProposalTripCard
              key={`proposal-${item.data.id}`}
              proposal={item.data}
              currentUserId={user!.id}
              voting={voting}
              onSubmitRankedVotes={handleSubmitRankedVotes}
              onRefresh={fetchProposals}
            />
          );
        }

        const trip = item.data as Trip;
        const startDate = new Date(trip.start_date + 'T00:00:00');
        const endDate = new Date(trip.end_date + 'T00:00:00');
        const duration = differenceInDays(endDate, startDate) + 1;
        const isOngoing = !isAfter(startOfDay(startDate), startOfDay(new Date()));

        return (
          <button
            key={trip.id}
            onClick={() => navigate(`/trip/${trip.id}`)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft",
              "hover:bg-muted/50 transition-colors text-left group"
            )}
          >
            <div className={cn(
              "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
              isOngoing ? "bg-primary/15 text-primary" : "bg-availability-away/15 text-availability-away"
            )}>
              <Plane className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm truncate">
                  {trip.location || 'Unknown destination'}
                </span>
                {isOngoing && (
                  <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                    NOW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(startDate, 'MMM d')} – {format(endDate, 'MMM d')}
                </span>
                <span>·</span>
                <span>{duration} {duration === 1 ? 'day' : 'days'}</span>
                {trip.priority_friend_ids.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{trip.priority_friend_ids.length} {trip.priority_friend_ids.length === 1 ? 'friend' : 'friends'}</span>
                  </>
                )}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

/* ── Proposal rendered as a trip card with dashed tentative border ── */

function ProposalTripCard({
  proposal,
  currentUserId,
  voting,
  onVote,
  onRefresh,
}: {
  proposal: TripProposal;
  currentUserId: string;
  voting: string | null;
  onVote: (proposalId: string, dateId: string, participantId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const isCreator = proposal.created_by === currentUserId;
  const totalVoters = proposal.participants.length;
  const votedCount = proposal.participants.filter(p => p.status === 'voted').length;
  const allVoted = votedCount === totalVoters && totalVoters > 0;
  const isVisit = proposal.proposal_type === 'visit';
  const isHost = proposal.host_user_id === currentUserId;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editDestination, setEditDestination] = useState(proposal.destination || '');
  const [editDates, setEditDates] = useState(
    proposal.dates.map(d => ({ id: d.id, start_date: d.start_date, end_date: d.end_date }))
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [justFinalized, setJustFinalized] = useState(false);

  // Find winning date (most votes, ties broken by earliest)
  const winningDate = useMemo(() => {
    if (proposal.dates.length === 0) return null;
    const sorted = [...proposal.dates].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.start_date.localeCompare(b.start_date);
    });
    return sorted[0];
  }, [proposal.dates]);

  const handleFinalize = async () => {
    if (!winningDate || !isCreator) return;
    setFinalizing(true);
    try {
      // Create the actual trip
      const { error: tripErr } = await supabase.from('trips').insert({
        user_id: currentUserId,
        location: proposal.destination?.trim() || null,
        start_date: winningDate.start_date,
        end_date: winningDate.end_date,
        available_slots: ['early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'],
        priority_friend_ids: proposal.participants
          .filter(p => p.user_id !== currentUserId)
          .map(p => p.user_id),
      });
      if (tripErr) throw tripErr;

      // Set availability to away for the winning dates
      const startDate = new Date(winningDate.start_date + 'T00:00:00');
      const endDate = new Date(winningDate.end_date + 'T00:00:00');
      const days: Date[] = [];
      let current = startDate;
      while (current <= endDate) {
        days.push(new Date(current));
        current = addDays(current, 1);
      }

      const availRows = days.map(d => ({
        user_id: currentUserId,
        date: format(d, 'yyyy-MM-dd'),
        location_status: 'away' as const,
        trip_location: proposal.destination?.trim() || null,
        early_morning: true, late_morning: true, early_afternoon: true,
        late_afternoon: true, evening: true, late_night: true,
      }));
      await supabase.from('availability').upsert(availRows, { onConflict: 'user_id,date', ignoreDuplicates: false });

      // Mark proposal as finalized
      await supabase
        .from('trip_proposals')
        .update({ status: 'finalized' })
        .eq('id', proposal.id);

      // Send push notification to participants
      const friendUserIds = proposal.participants
        .filter(p => p.user_id !== currentUserId)
        .map(p => p.user_id);
      if (friendUserIds.length > 0) {
        const dateLabel = `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`;
        supabase.functions.invoke('send-push-notification', {
          body: {
            user_ids: friendUserIds,
            title: isVisit ? '🏠 Visit Confirmed!' : '✈️ Trip Confirmed!',
            body: `${proposal.destination || 'Your trip'} is locked in for ${dateLabel}!`,
            url: '/trips',
          },
        }).catch(() => {});
      }

      // Celebration!
      setJustFinalized(true);
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3D8C6C', '#FF6B6B', '#F59E0B', '#8B5CF6', '#3B82F6'],
        scalar: 1,
      });
      toast.success(isVisit ? 'Visit confirmed! 🏠🎉' : 'Trip confirmed! ✈️🎉');

      // Refresh after a short delay to show the animation
      setTimeout(() => {
        onRefresh();
        window.dispatchEvent(new Event('trips:updated'));
      }, 2000);
    } catch (err) {
      console.error('Failed to finalize:', err);
      toast.error('Something went wrong. Try again?');
    } finally {
      setFinalizing(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await supabase
        .from('trip_proposals')
        .update({ destination: editDestination.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', proposal.id);

      const existingIds = proposal.dates.map(d => d.id);
      const editIds = editDates.filter(d => d.id && existingIds.includes(d.id)).map(d => d.id);
      const removedIds = existingIds.filter(id => !editIds.includes(id));

      if (removedIds.length > 0) {
        for (const rid of removedIds) {
          await supabase
            .from('trip_proposal_participants')
            .update({ preferred_date_id: null, status: 'pending' })
            .eq('proposal_id', proposal.id)
            .eq('preferred_date_id', rid);
        }
        await supabase.from('trip_proposal_dates').delete().in('id', removedIds);
      }

      for (const d of editDates) {
        if (d.id && existingIds.includes(d.id)) {
          await supabase
            .from('trip_proposal_dates')
            .update({ start_date: d.start_date, end_date: d.end_date })
            .eq('id', d.id);
        } else {
          await supabase.from('trip_proposal_dates').insert({
            proposal_id: proposal.id,
            start_date: d.start_date,
            end_date: d.end_date,
          });
        }
      }

      toast.success('Proposal updated');
      setEditOpen(false);
      await onRefresh();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to update proposal');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('trip_proposal_dates').delete().eq('proposal_id', proposal.id);
      await supabase.from('trip_proposal_participants').delete().eq('proposal_id', proposal.id);
      await supabase.from('trip_proposals').delete().eq('id', proposal.id);
      toast.success('Proposal deleted');
      await onRefresh();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete proposal');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const addDateOption = () => {
    const last = editDates[editDates.length - 1];
    const startDate = last ? new Date(last.start_date + 'T00:00:00') : new Date();
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() + 7);
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + 2);
    setEditDates([...editDates, {
      id: '',
      start_date: format(newStart, 'yyyy-MM-dd'),
      end_date: format(newEnd, 'yyyy-MM-dd'),
    }]);
  };

  const removeDateOption = (index: number) => {
    if (editDates.length <= 1) return;
    setEditDates(editDates.filter((_, i) => i !== index));
  };

  const allStarts = proposal.dates.map(d => d.start_date).sort();
  const allEnds = proposal.dates.map(d => d.end_date).sort();
  const earliestStart = allStarts[0];
  const latestEnd = allEnds[allEnds.length - 1];

  let cardTitle: string;
  if (isVisit) {
    if (isHost) {
      cardTitle = `Hosting in ${proposal.destination || 'your city'}`;
    } else if (proposal.host_name) {
      cardTitle = `${proposal.host_name} is hosting in ${proposal.destination || 'their city'}`;
    } else {
      cardTitle = `Visit to ${proposal.destination || 'TBD'}`;
    }
  } else {
    cardTitle = proposal.destination ? `Trip to ${proposal.destination}` : 'Group Trip';
  }

  const CardIcon = isVisit ? Home : Plane;

  // Finalized celebration state
  if (justFinalized && winningDate) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full rounded-xl border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 shadow-soft text-center space-y-3 overflow-hidden relative"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="text-4xl"
        >
          {isVisit ? '🏠' : '✈️'}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-lg font-bold text-foreground">{isVisit ? 'Visit Confirmed!' : 'Trip Confirmed!'}</p>
          <p className="text-sm text-primary font-semibold mt-1">
            {proposal.destination || 'Your destination'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(winningDate.start_date + 'T00:00:00'), 'EEE, MMM d')} – {format(new Date(winningDate.end_date + 'T00:00:00'), 'EEE, MMM d')}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center -space-x-2"
        >
          {proposal.participants.map(p => (
            <Avatar key={p.id} className="h-7 w-7 border-2 border-background">
              <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} />
              <AvatarFallback className="text-[8px]">{p.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
          ))}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "w-full rounded-xl border bg-card p-3 shadow-soft text-left transition-all space-y-2.5",
          allVoted
            ? "border-primary/40 border-solid bg-gradient-to-br from-primary/[0.06] to-background"
            : "border-dashed border-muted-foreground/40"
        )}
      >
        {/* All voted banner */}
        <AnimatePresence>
          {allVoted && isCreator && winningDate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-primary/10 border border-primary/20 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Everyone has voted!</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                <span className="font-medium text-foreground">
                  Top pick: {format(new Date(winningDate.start_date + 'T00:00:00'), 'EEE, MMM d')} – {format(new Date(winningDate.end_date + 'T00:00:00'), 'MMM d')}
                </span>
                <span className="text-[10px] font-medium text-primary ml-auto">
                  {winningDate.votes} vote{winningDate.votes !== 1 ? 's' : ''}
                </span>
              </div>
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={handleFinalize}
                disabled={finalizing}
              >
                {finalizing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PartyPopper className="h-3.5 w-3.5" />
                )}
                {isVisit ? 'Confirm Visit' : 'Confirm Trip'}
              </Button>
            </motion.div>
          )}
          {allVoted && !isCreator && winningDate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-primary/10 border border-primary/20 p-2.5 flex items-center gap-2"
            >
              <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[11px] text-primary font-medium">
                All votes in! Waiting for {proposal.creator_name.split(' ')[0]} to confirm.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card header */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
            allVoted ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary"
          )}>
            <CardIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm truncate text-muted-foreground">
                {cardTitle}
              </span>
              
              {isCreator && (
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {
                    setEditDestination(proposal.destination || '');
                    setEditDates(proposal.dates.map(d => ({ id: d.id, start_date: d.start_date, end_date: d.end_date })));
                    setEditOpen(true);
                  }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {earliestStart && latestEnd && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(earliestStart + 'T00:00:00'), 'MMM d')} – {format(new Date(latestEnd + 'T00:00:00'), 'MMM d')}
                </span>
              )}
              <span>·</span>
              <span>{isCreator ? 'You proposed' : `${proposal.creator_name}`}</span>
            </div>
          </div>
        </div>

        {/* Participants row */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {[...proposal.participants]
              .sort((a, b) => (b.status === 'voted' ? 1 : 0) - (a.status === 'voted' ? 1 : 0))
              .slice(0, 5)
              .map(p => {
              const hasVotedTrip = p.status === 'voted';
              return (
                <div key={p.id} className={cn("relative", hasVotedTrip && "z-10")}>
                  <Avatar className={cn("h-5 w-5 border-2 border-background", !hasVotedTrip && "opacity-60")}>
                    <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} />
                    <AvatarFallback className="text-[7px]">{p.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {hasVotedTrip && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-1.5 w-1.5 text-primary-foreground" />
                    </span>
                  )}
                </div>
              );
            })}
            {proposal.participants.length > 5 && (
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted border-2 border-background text-[8px] font-medium text-muted-foreground">
                +{proposal.participants.length - 5}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground truncate">
            {proposal.participants.map(p => p.display_name.split(' ')[0]).join(', ')}
          </span>
        </div>

        {/* Date options with vote buttons */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                allVoted
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted border border-muted-foreground/20 text-muted-foreground"
              )}>
                {allVoted ? '✓ All voted' : 'Proposed'}
              </span>
              <span className="text-[10px] text-muted-foreground">{votedCount}/{totalVoters} voted</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vote for dates
            </p>
          </div>
          {proposal.dates.map(d => {
            const isMyVote = proposal.myVotedDateId === d.id;
            const isVoting = voting === `${proposal.id}:${d.id}`;
            const startDate = new Date(d.start_date + 'T00:00:00');
            const endDate = new Date(d.end_date + 'T00:00:00');
            const isWinner = allVoted && winningDate?.id === d.id;

            return (
              <button
                key={d.id}
                onClick={() => {
                  if (!isMyVote) onVote(proposal.id, d.id, proposal.myParticipantId);
                }}
                disabled={isVoting}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all",
                  isWinner
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : isMyVote
                      ? "border-primary/60 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                {isWinner && (
                  <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                {!isWinner && (
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className={cn(
                  "flex-1 text-xs font-medium",
                  isWinner && "text-primary"
                )}>
                  {format(startDate, 'EEE, MMM d')} – {format(endDate, 'MMM d')}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {d.votes > 0 && (
                    <span className={cn(
                      "text-[10px] font-medium",
                      isWinner ? "text-primary" : "text-muted-foreground"
                    )}>
                      {d.votes} vote{d.votes !== 1 ? 's' : ''}
                    </span>
                  )}
                  {isVoting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : isMyVote ? (
                    <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  ) : (
                    <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Destination</label>
              <Input
                value={editDestination}
                onChange={e => setEditDestination(e.target.value)}
                placeholder="Where to?"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Date Options</label>
                <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={addDateOption}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {editDates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={d.start_date}
                    onChange={e => {
                      const updated = [...editDates];
                      updated[i] = { ...updated[i], start_date: e.target.value };
                      setEditDates(updated);
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="date"
                    value={d.end_date}
                    onChange={e => {
                      const updated = [...editDates];
                      updated[i] = { ...updated[i], end_date: e.target.value };
                      setEditDates(updated);
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  {editDates.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeDateOption(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this trip proposal and all votes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


