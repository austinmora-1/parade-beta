import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, differenceInDays, isAfter, startOfDay } from 'date-fns';
import { Plane, MapPin, Calendar, ChevronRight, Clock, Check, ThumbsUp, Loader2, Users, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

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

  const handleVote = async (proposalId: string, dateId: string, participantId: string) => {
    setVoting(`${proposalId}:${dateId}`);
    try {
      const { error: updateErr } = await supabase
        .from('trip_proposal_participants')
        .update({ preferred_date_id: dateId, status: 'voted' })
        .eq('id', participantId);

      if (updateErr) throw updateErr;

      const proposal = proposals.find(p => p.id === proposalId);
      const oldVotedDateId = proposal?.myVotedDateId;

      if (oldVotedDateId && oldVotedDateId !== dateId) {
        const oldDate = proposal?.dates.find(d => d.id === oldVotedDateId);
        if (oldDate) {
          await supabase
            .from('trip_proposal_dates')
            .update({ votes: Math.max(0, oldDate.votes - 1) })
            .eq('id', oldVotedDateId);
        }
      }

      if (oldVotedDateId !== dateId) {
        const newDate = proposal?.dates.find(d => d.id === dateId);
        await supabase
          .from('trip_proposal_dates')
          .update({ votes: (newDate?.votes || 0) + 1 })
          .eq('id', dateId);
      }

      confetti({
        particleCount: 40,
        spread: 45,
        origin: { y: 0.7 },
        colors: ['#3D8C6C', '#F59E0B', '#3B82F6'],
        scalar: 0.8,
      });
      toast.success('Vote recorded! ✈️');
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
              onVote={handleVote}
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
}: {
  proposal: TripProposal;
  currentUserId: string;
  voting: string | null;
  onVote: (proposalId: string, dateId: string, participantId: string) => void;
}) {
  const isCreator = proposal.created_by === currentUserId;
  const totalVoters = proposal.participants.length;
  const votedCount = proposal.participants.filter(p => p.status === 'voted').length;

  // Determine earliest/latest dates from options for display
  const allStarts = proposal.dates.map(d => d.start_date).sort();
  const allEnds = proposal.dates.map(d => d.end_date).sort();
  const earliestStart = allStarts[0];
  const latestEnd = allEnds[allEnds.length - 1];

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-dashed border-muted-foreground/40 bg-card p-3 shadow-soft text-left transition-all space-y-2.5"
      )}
    >
      {/* Card header — matches trip card layout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
          <Plane className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate text-muted-foreground">
              {proposal.destination ? `Trip to ${proposal.destination}` : 'Group Trip'}
            </span>
            <span className="text-[10px] font-semibold bg-muted border border-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
              Proposed
            </span>
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
            <span>·</span>
            <span>{votedCount}/{totalVoters} voted</span>
          </div>
        </div>
      </div>

      {/* Participants row */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {proposal.participants.slice(0, 5).map(p => (
            <Avatar key={p.id} className="h-5 w-5 border-2 border-background">
              <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} />
              <AvatarFallback className="text-[7px]">{p.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
          ))}
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vote for dates
        </p>
        {proposal.dates.map(d => {
          const isMyVote = proposal.myVotedDateId === d.id;
          const isVoting = voting === `${proposal.id}:${d.id}`;
          const startDate = new Date(d.start_date + 'T00:00:00');
          const endDate = new Date(d.end_date + 'T00:00:00');

          return (
            <button
              key={d.id}
              onClick={() => {
                if (!isMyVote) onVote(proposal.id, d.id, proposal.myParticipantId);
              }}
              disabled={isVoting}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all",
                isMyVote
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/30 hover:bg-primary/5"
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-xs font-medium">
                {format(startDate, 'EEE, MMM d')} – {format(endDate, 'MMM d')}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {d.votes > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
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
  );
}
