import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, differenceInDays, isAfter, startOfDay, addDays } from 'date-fns';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Plane, MapPin, Calendar, ChevronRight, ChevronDown, Clock, Check, Loader2, Users, Home, Edit2, Trash2, Plus, X, Trophy, Sparkles, PartyPopper, ArrowLeftRight, UserPlus, Vote, Share2, Lock } from 'lucide-react';
import { InviteToTripDialog } from './InviteToTripDialog';
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
import { AddParticipantDialog } from './AddParticipantDialog';
import { formatDisplayName } from '@/lib/formatName';
import { formatCityForDisplay } from '@/lib/formatCity';

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
      (profiles || []).map((p: any) => [p.user_id, { name: formatDisplayName({ firstName: p.first_name, lastName: p.last_name, displayName: p.display_name }), avatar: p.avatar_url }])
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

  const handleAcceptDecline = async (
    proposalId: string,
    dateId: string,
    participantId: string,
    response: 'accept' | 'decline'
  ) => {
    if (!user) return;
    setVoting(proposalId);
    try {
      // Always clear any prior vote for this user on this proposal's date
      await supabase
        .from('trip_proposal_votes' as any)
        .delete()
        .in('date_id', [dateId])
        .eq('user_id', user.id);

      if (response === 'accept') {
        const { error } = await supabase
          .from('trip_proposal_votes' as any)
          .insert([{ date_id: dateId, user_id: user.id, rank: 1 }]);
        if (error) throw error;
        await supabase
          .from('trip_proposal_participants')
          .update({ status: 'voted' })
          .eq('id', participantId);
        confetti({
          particleCount: 30, spread: 40, origin: { y: 0.7 },
          colors: ['#3D8C6C', '#F59E0B', '#3B82F6'], scalar: 0.8,
        });
        toast.success("You're in ✈️");
      } else {
        await supabase
          .from('trip_proposal_participants')
          .update({ status: 'declined' })
          .eq('id', participantId);
        toast.success('Declined — thanks for letting them know');
      }
      await fetchProposals();
    } catch (err) {
      console.error('Response failed:', err);
      toast.error("Couldn't save that — try again?");
    } finally {
      setVoting(null);
    }
  };

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
      toast.success('Your picks are in ✈️');
      await fetchProposals();
    } catch (err) {
      console.error('Vote failed:', err);
      toast.error("Couldn't save those — try again?");
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
              onAcceptDecline={handleAcceptDecline}
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
          <TripCard
            key={trip.id}
            trip={trip}
            startDate={startDate}
            endDate={endDate}
            duration={duration}
            isOngoing={isOngoing}
            currentUserId={user!.id}
            onNavigate={() => navigate(`/trip/${trip.id}`)}
            onConverted={async () => { await fetchTrips(); await fetchProposals(); }}
          />
        );
      })}
    </div>
  );
}

/* ── Regular trip card with conversion support ── */

function TripCard({
  trip,
  startDate,
  endDate,
  duration,
  isOngoing,
  currentUserId,
  onNavigate,
  onConverted,
}: {
  trip: Trip;
  startDate: Date;
  endDate: Date;
  duration: number;
  isOngoing: boolean;
  currentUserId: string;
  onNavigate: () => void;
  onConverted: () => Promise<void>;
}) {
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [friendProfiles, setFriendProfiles] = useState<{ user_id: string; display_name: string; avatar_url: string | null }[]>([]);

  useEffect(() => {
    if (trip.priority_friend_ids.length === 0) return;
    supabase
      .rpc('get_display_names_for_users', { p_user_ids: trip.priority_friend_ids })
      .then(({ data }) => { if (data) setFriendProfiles(data); });
  }, [trip.priority_friend_ids]);

  return (
    <div
      onClick={onNavigate}
      className={cn(
        "w-full rounded-xl border border-border bg-card p-3 shadow-soft",
        "hover:bg-muted/50 transition-colors text-left group cursor-pointer space-y-2"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
          isOngoing ? "bg-primary/15 text-primary" : "bg-availability-away/15 text-availability-away"
        )}>
          <Plane className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">
              {trip.location ? (formatCityForDisplay(trip.location) || trip.location) : 'Unknown destination'}
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
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={(e) => { e.stopPropagation(); setAddParticipantOpen(true); }}
          title="Add participant"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          title="Edit trip"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>

        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
      </div>

      {/* Participant avatars + Activities CTA */}
      <div className="flex items-center justify-between gap-2">
        {friendProfiles.length > 0 ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-1.5">
              {friendProfiles.slice(0, 5).map((p, i, arr) => (
                <Avatar key={p.user_id} className="h-5 w-5 border-2 border-background" style={{ zIndex: arr.length - i }}>
                  <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} />
                  <AvatarFallback className="text-[7px]">{(p.display_name || '?')[0]}</AvatarFallback>
                </Avatar>
              ))}
              {friendProfiles.length > 5 && (
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted border-2 border-background text-[8px] font-medium text-muted-foreground">
                  +{friendProfiles.length - 5}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground truncate">
              {friendProfiles.map(p => (p.display_name || 'Friend').split(' ')[0]).join(', ')}
            </span>
          </div>
        ) : <div />}

        <Button
          variant="secondary"
          size="sm"
          className="h-7 px-2.5 shrink-0 gap-1 text-xs ml-auto bg-primary/15 text-primary hover:bg-primary/25"
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggest activities
        </Button>
      </div>

      <AddParticipantDialog
        open={addParticipantOpen}
        onOpenChange={setAddParticipantOpen}
        targetType="trip"
        targetId={trip.id}
        existingParticipantIds={[currentUserId, ...trip.priority_friend_ids]}
        currentParticipants={friendProfiles.map(p => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        }))}
        nonRemovableIds={[currentUserId]}
        onAdded={onConverted}
      />
    </div>
  );
}

/* ── Proposal rendered as a trip card with dashed tentative border ── */

function ProposalTripCard({
  proposal,
  currentUserId,
  voting,
  onSubmitRankedVotes,
  onAcceptDecline,
  onRefresh,
}: {
  proposal: TripProposal;
  currentUserId: string;
  voting: string | null;
  onSubmitRankedVotes: (proposalId: string, rankings: Record<string, number>, participantId: string) => Promise<void>;
  onAcceptDecline: (proposalId: string, dateId: string, participantId: string, response: 'accept' | 'decline') => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const isCreator = proposal.created_by === currentUserId;
  const totalVoters = proposal.participants.length;
  
  // Determine who has voted based on trip_proposal_votes
  const voterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of proposal.votes) ids.add(v.user_id);
    return ids;
  }, [proposal.votes]);
  
  const votedCount = voterIds.size;
  // For single-date proposals, declines also count as a response so the organizer
  // can confirm once everyone has responded (accepted or declined).
  const isSingleDate = proposal.dates.length === 1;
  const respondedCount = isSingleDate
    ? proposal.participants.filter(p => voterIds.has(p.user_id) || p.status === 'declined').length
    : votedCount;
  const allVoted = respondedCount === totalVoters && totalVoters > 0;
  const hasVoted = voterIds.has(currentUserId);
  const isVisit = proposal.proposal_type === 'visit';
  const isHost = proposal.host_user_id === currentUserId;

  // Ordered list of date IDs for drag ranking (top = #1)
  const [rankedDateIds, setRankedDateIds] = useState<string[]>(() => {
    const myVotes = proposal.votes.filter(v => v.user_id === currentUserId);
    if (myVotes.length > 0) {
      // Restore previous order from saved ranks
      return [...myVotes].sort((a, b) => a.rank - b.rank).map(v => v.date_id);
    }
    // Default: all dates in original order
    return proposal.dates.map(d => d.id);
  });

  // Keep rankedDateIds in sync when dates are added/removed on the proposal.
  // Preserves existing user ordering, appends new dates at the end, drops removed ones.
  useEffect(() => {
    const validIds = new Set(proposal.dates.map(d => d.id));
    const allIds = proposal.dates.map(d => d.id);
    setRankedDateIds(prev => {
      const filtered = prev.filter(id => validIds.has(id));
      const missing = allIds.filter(id => !filtered.includes(id));
      if (missing.length === 0 && filtered.length === prev.length) return prev;
      return [...filtered, ...missing];
    });
  }, [proposal.dates]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rankingsCollapsed, setRankingsCollapsed] = useState(hasVoted);
  const [shareOpen, setShareOpen] = useState(false);

  // Derive myRankings from ordered list
  const myRankings = useMemo(() => {
    const r: Record<string, number> = {};
    rankedDateIds.forEach((id, i) => { r[id] = i + 1; });
    return r;
  }, [rankedDateIds]);

  // Track if rankings changed from saved state
  const savedRankings = useMemo(() => {
    const r: Record<string, number> = {};
    for (const v of proposal.votes) {
      if (v.user_id === currentUserId) r[v.date_id] = v.rank;
    }
    return r;
  }, [proposal.votes, currentUserId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!hasVoted) return true; // Never voted, always show save
    if (Object.keys(savedRankings).length !== rankedDateIds.length) return true;
    return rankedDateIds.some((id, i) => savedRankings[id] !== i + 1);
  }, [savedRankings, rankedDateIds, hasVoted]);

  const handleSubmit = async () => {
    if (rankedDateIds.length === 0) {
      toast.error('Pick at least one date you like');
      return;
    }
    setIsSubmitting(true);
    await onSubmitRankedVotes(proposal.id, myRankings, proposal.myParticipantId);
    setIsSubmitting(false);
  };

  // Borda count scores per date option
  const bordaScores = useMemo(() => {
    const scores = new Map<string, number>();
    for (const d of proposal.dates) scores.set(d.id, 0);
    const byUser = new Map<string, TripVote[]>();
    for (const v of proposal.votes) {
      if (!byUser.has(v.user_id)) byUser.set(v.user_id, []);
      byUser.get(v.user_id)!.push(v);
    }
    const n = proposal.dates.length;
    for (const userVotes of byUser.values()) {
      for (const v of userVotes) {
        const pts = n - v.rank + 1;
        scores.set(v.date_id, (scores.get(v.date_id) || 0) + pts);
      }
    }
    return scores;
  }, [proposal.votes, proposal.dates]);

  const voteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of proposal.dates) counts.set(d.id, 0);
    const dateUsers = new Map<string, Set<string>>();
    for (const v of proposal.votes) {
      if (!dateUsers.has(v.date_id)) dateUsers.set(v.date_id, new Set());
      dateUsers.get(v.date_id)!.add(v.user_id);
    }
    for (const [dateId, users] of dateUsers) counts.set(dateId, users.size);
    return counts;
  }, [proposal.votes, proposal.dates]);

  const winningDate = useMemo(() => {
    if (proposal.dates.length === 0) return null;
    const sorted = [...proposal.dates].sort((a, b) => {
      const aScore = bordaScores.get(a.id) || 0;
      const bScore = bordaScores.get(b.id) || 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.start_date.localeCompare(b.start_date);
    });
    return sorted[0];
  }, [proposal.dates, bordaScores]);

  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [editDestination, setEditDestination] = useState(proposal.destination || '');
  const [editDates, setEditDates] = useState(
    proposal.dates.map(d => ({ id: d.id, start_date: d.start_date, end_date: d.end_date }))
  );
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [justFinalized, setJustFinalized] = useState(false);
  const [confirmEarlyOpen, setConfirmEarlyOpen] = useState(false);

  const handleFinalize = async () => {
    if (!winningDate || !isCreator) return;
    setFinalizing(true);
    try {
      // Create a linked trip row for the creator (proposal_id ties shared activities together)
      const { error: tripErr } = await supabase.from('trips').insert({
        user_id: currentUserId,
        location: proposal.destination?.trim() || null,
        start_date: winningDate.start_date,
        end_date: winningDate.end_date,
        available_slots: ['early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'],
        priority_friend_ids: proposal.participants
          .filter(p => p.user_id !== currentUserId)
          .map(p => p.user_id),
        proposal_id: proposal.id,
      } as any);
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
      toast.success(isVisit ? "You're on the books 🏠🎉" : "It's official — pack the bags ✈️🎉");

      // Refresh after a short delay to show the animation
      setTimeout(() => {
        onRefresh();
        window.dispatchEvent(new Event('trips:updated'));
      }, 2000);
    } catch (err) {
      console.error('Failed to finalize:', err);
      toast.error("Hmm, that didn't go through — try again?");
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

      toast.success('Updated ✨');
      setEditOpen(false);
      await onRefresh();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error("Couldn't save those changes — try again?");
    } finally {
      setSaving(false);
    }
  };

  // Delete & convert handlers moved to /proposal/:id detail page
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
          {proposal.participants.map((p, i) => (
            <Avatar key={p.id} className="h-7 w-7 border-2 border-background" style={{ zIndex: proposal.participants.length - i }}>
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
                  {voteCounts.get(winningDate.id) || 0}/{totalVoters} votes
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
          {!allVoted && isCreator && winningDate && votedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-muted/50 border border-border p-2.5 flex items-center gap-2"
            >
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">
                {votedCount}/{totalVoters} responded — confirm now if you can't wait
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 shrink-0"
                onClick={() => setConfirmEarlyOpen(true)}
                disabled={finalizing}
              >
                <Lock className="h-3 w-3" />
                Confirm now
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/proposal/${proposal.id}`)}
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-lg shrink-0 transition-opacity hover:opacity-80",
              allVoted ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary"
            )}
            title="Open proposal details"
          >
            <CardIcon className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate(`/proposal/${proposal.id}`)}
                className="font-medium text-sm truncate text-muted-foreground text-left hover:text-foreground transition-colors min-w-0"
              >
                {cardTitle}
              </button>
              
              {isCreator ? (
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
                    title="Share invite link"
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditDestination(proposal.destination || '');
                      setEditDates(proposal.dates.map(d => ({ id: d.id, start_date: d.start_date, end_date: d.end_date })));
                      setEditOpen(true);
                    }}
                    title="Edit proposal"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
                    title="Share invite link"
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {proposal.dates.length > 1 ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {proposal.dates.length} options
                </span>
              ) : earliestStart && latestEnd && (
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
              .sort((a, b) => (voterIds.has(b.user_id) ? 1 : 0) - (voterIds.has(a.user_id) ? 1 : 0))
              .slice(0, 5)
              .map((p, i, arr) => {
              const hasVotedTrip = voterIds.has(p.user_id);
              return (
                <div key={p.id} className="relative" style={{ zIndex: arr.length - i }}>
                  <Avatar className={cn("h-5 w-5 border-2 border-background", !hasVotedTrip && "opacity-60")}>
                    <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} />
                    <AvatarFallback className="text-[7px]">{p.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {hasVotedTrip && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full flex items-center justify-center bg-emerald-500">
                      <Check className="h-1.5 w-1.5 text-primary-foreground bg-green-500 border-emerald-500" />
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
          <span className="text-[10px] text-muted-foreground truncate flex-1">
            {proposal.participants.map(p => p.display_name.split(' ')[0]).join(', ')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => setAddParticipantOpen(true)}
            title="Add participant"
          >
            <UserPlus className="h-3 w-3" />
          </Button>
        </div>

        {/* Single date → simple Accept/Decline. Multi-date → ranked vote. */}
        {proposal.dates.length === 1 ? (() => {
          const onlyDate = proposal.dates[0];
          const myParticipant = proposal.participants.find(p => p.user_id === currentUserId);
          const myStatus = myParticipant?.status;
          const accepted = voterIds.has(currentUserId);
          const declined = myStatus === 'declined';
          const startDate = new Date(onlyDate.start_date + 'T00:00:00');
          const endDate = new Date(onlyDate.end_date + 'T00:00:00');
          const sameDay = onlyDate.start_date === onlyDate.end_date;
          const isBusy = voting === proposal.id;
          const acceptedCount = voterIds.size;
          const declinedCount = proposal.participants.filter(p => p.status === 'declined').length;
          return (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                  allVoted
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted border border-muted-foreground/20 text-muted-foreground"
                )}>
                  {allVoted ? '✓ All responded' : 'Proposed'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {acceptedCount} in{declinedCount > 0 ? ` · ${declinedCount} out` : ''} · {totalVoters} invited
                </span>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-[11px] font-medium flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                {sameDay
                  ? format(startDate, 'EEE, MMM d')
                  : `${format(startDate, 'EEE, MMM d')} – ${format(endDate, 'MMM d')}`}
              </div>

              {accepted ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 rounded-lg bg-primary/10 border border-primary/30 px-2 py-1.5 text-[11px] font-medium text-primary flex items-center gap-1.5">
                    <Check className="h-3 w-3" /> You're in
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] text-muted-foreground"
                    disabled={isBusy}
                    onClick={() => onAcceptDecline(proposal.id, onlyDate.id, proposal.myParticipantId, 'decline')}
                  >
                    Change to decline
                  </Button>
                </div>
              ) : declined ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 rounded-lg bg-muted border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <X className="h-3 w-3" /> You declined
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] text-primary"
                    disabled={isBusy}
                    onClick={() => onAcceptDecline(proposal.id, onlyDate.id, proposal.myParticipantId, 'accept')}
                  >
                    Change to accept
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={isBusy}
                    onClick={() => onAcceptDecline(proposal.id, onlyDate.id, proposal.myParticipantId, 'decline')}
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><X className="h-3 w-3 mr-1" /> Decline</>}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={isBusy}
                    onClick={() => onAcceptDecline(proposal.id, onlyDate.id, proposal.myParticipantId, 'accept')}
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Accept</>}
                  </Button>
                </div>
              )}
            </div>
          );
        })() : (
        <div className="space-y-1.5">
          <button
            type="button"
            className="w-full flex items-center justify-between"
            onClick={() => setRankingsCollapsed(c => !c)}
          >
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
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rank dates
              </p>
              <ChevronDown className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                rankingsCollapsed && "-rotate-90"
              )} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {!rankingsCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  Drag to reorder · Top = most preferred
                </p>
                <Reorder.Group
                  axis="y"
                  values={rankedDateIds}
                  onReorder={setRankedDateIds}
                  className="space-y-1"
                >
                  {rankedDateIds.map((dateId, i) => {
                    const d = proposal.dates.find(dd => dd.id === dateId);
                    if (!d) return null;
                    const rank = i + 1;
                    const count = voteCounts.get(d.id) || 0;
                    const score = bordaScores.get(d.id) || 0;
                    const startDate = new Date(d.start_date + 'T00:00:00');
                    const endDate = new Date(d.end_date + 'T00:00:00');
                    const isWinner = allVoted && winningDate?.id === d.id;
                    const maxScore = Math.max(...Array.from(bordaScores.values()), 1);
                    const barWidth = score > 0 ? (score / maxScore) * 100 : 0;

                    return (
                      <Reorder.Item
                        key={dateId}
                        value={dateId}
                        className={cn(
                          "relative flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors overflow-hidden cursor-grab active:cursor-grabbing touch-none",
                          isWinner
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-primary/10 transition-all pointer-events-none"
                          style={{ width: `${barWidth}%` }}
                        />
                        <GripVertical className="relative h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                        <div className="relative flex h-5 w-5 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                          {rank}
                        </div>
                        {isWinner && (
                          <Trophy className="relative h-3 w-3 text-primary shrink-0" />
                        )}
                        <span className={cn(
                          "relative flex-1 text-[11px] font-medium truncate",
                          isWinner && "text-primary"
                        )}>
                          {format(startDate, 'MMM d')} – {format(endDate, 'MMM d')}
                        </span>
                        {count > 0 && (
                          <span className={cn(
                            "relative text-[9px] font-medium shrink-0",
                            isWinner ? "text-primary" : "text-muted-foreground"
                          )}>
                            {count}/{totalVoters} · {score}pts
                          </span>
                        )}
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>

                {hasUnsavedChanges && (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || voting === proposal.id}
                    className="w-full mt-1.5"
                    size="sm"
                  >
                    {(isSubmitting || voting === proposal.id) ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</>
                    ) : 'Save Rankings'}
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
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

      {/* Delete & convert moved to /proposal/:id detail page */}

      <AddParticipantDialog
        open={addParticipantOpen}
        onOpenChange={setAddParticipantOpen}
        targetType="proposal"
        targetId={proposal.id}
        existingParticipantIds={proposal.participants.map(p => p.user_id)}
        currentParticipants={proposal.participants.map(p => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        }))}
        nonRemovableIds={[proposal.created_by]}
        onAdded={onRefresh}
      />

      {shareOpen && (
        <InviteToTripDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          proposalId={proposal.id}
          destination={proposal.destination}
          proposalType={proposal.proposal_type as 'trip' | 'visit'}
        />
      )}

      <AlertDialog open={confirmEarlyOpen} onOpenChange={setConfirmEarlyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm before everyone has voted?</AlertDialogTitle>
            <AlertDialogDescription>
              {totalVoters - votedCount} {totalVoters - votedCount === 1 ? "person hasn't" : "people haven't"} responded yet.
              {winningDate && (
                <> You'll lock in <span className="font-medium text-foreground">{format(new Date(winningDate.start_date + 'T00:00:00'), 'EEE, MMM d')}{winningDate.start_date !== winningDate.end_date ? ` – ${format(new Date(winningDate.end_date + 'T00:00:00'), 'MMM d')}` : ''}</span>. </>
              )}
              {' '}Participants who haven't voted will show as tentative until they accept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizing}>Wait for everyone</AlertDialogCancel>
            <AlertDialogAction
              disabled={finalizing}
              onClick={async (e) => {
                e.preventDefault();
                await handleFinalize();
                setConfirmEarlyOpen(false);
              }}
            >
              {finalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Confirm now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


