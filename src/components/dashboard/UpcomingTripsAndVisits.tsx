import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, isWithinInterval, startOfDay } from 'date-fns';
import { Plane, Clock, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { CollapsibleWidget } from './CollapsibleWidget';
import { formatDisplayName } from '@/lib/formatName';
import { formatCityForDisplay } from '@/lib/formatCity';
import { citiesMatch, normalizeCity } from '@/lib/locationMatch';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

export function UpcomingTripsAndVisits() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useCurrentUserProfile();
  const [tripProposals, setTripProposals] = useState<any[]>([]);
  const [confirmedTrips, setConfirmedTrips] = useState<any[]>([]);

  // Resolve the user's home city. Treat both `home_address` and
  // `neighborhood` as signals of where they live, so a "trip" to their
  // own metro never gets surfaced as travel. Mirrors the co-location
  // rules used elsewhere on the dashboard.
  const homeCities = useMemo(() => {
    const candidates: string[] = [];
    if (profile?.home_address) candidates.push(profile.home_address);
    const neighborhood = (profile as any)?.neighborhood as string | null | undefined;
    if (neighborhood) candidates.push(neighborhood);
    return candidates.map(normalizeCity).filter(Boolean);
  }, [profile?.home_address, (profile as any)?.neighborhood]);

  const isHomeCity = (loc: string | null | undefined) => {
    if (!loc) return false;
    const normalized = normalizeCity(loc);
    if (!normalized) return false;
    return homeCities.some((home) => citiesMatch(home, normalized));
  };

  // Fetch confirmed trips (next 3 months)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const now = new Date();
      const threeMonths = addMonths(now, 3);
      const { data } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .gte('end_date', format(now, 'yyyy-MM-dd'))
        .lte('start_date', format(threeMonths, 'yyyy-MM-dd'))
        .order('start_date', { ascending: true });

      if (!data?.length) { setConfirmedTrips([]); return; }

      // Fetch participant profiles
      const tripIds = data.map(t => t.id);
      const { data: participants } = await supabase
        .from('trip_participants')
        .select('trip_id, friend_user_id')
        .in('trip_id', tripIds);

      const allFriendIds = [
        ...new Set([
          ...data.flatMap(t => t.priority_friend_ids || []),
          ...(participants || []).map(p => p.friend_user_id),
        ]),
      ];

      let profileMap = new Map<string, { name: string; avatar: string | null }>();
      if (allFriendIds.length > 0) {
        const { data: profiles } = await supabase.rpc('get_display_names_for_users', { p_user_ids: allFriendIds });
        for (const p of (profiles || [])) {
          profileMap.set(p.user_id, { name: formatDisplayName({ firstName: (p as any).first_name, lastName: (p as any).last_name, displayName: p.display_name }), avatar: p.avatar_url });
        }
      }

      setConfirmedTrips(data.map(t => ({
        ...t,
        friendProfiles: (t.priority_friend_ids || [])
          .map((id: string) => profileMap.get(id))
          .filter(Boolean),
      })));
    })();
  }, [user?.id]);

  // Fetch pending trip proposals (next 3 months)
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
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, { name: formatDisplayName({ firstName: p.first_name, lastName: p.last_name, displayName: p.display_name }), avatar: p.avatar_url }]));

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
          proposalType: prop.proposal_type,
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

  const totalCount = confirmedTrips.length + tripProposals.length;

  if (totalCount === 0) return null;

  return (
    <CollapsibleWidget
      title="Upcoming Trips & Visits"
      icon={<Plane className="h-4 w-4 text-primary" />}
      badge={
        totalCount > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {totalCount}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-1.5">
        {confirmedTrips.map(trip => (
          <div
            key={trip.id}
            onClick={() => navigate('/trips')}
            className="rounded-xl border-l-[3px] px-3 py-3 transition-all duration-200 cursor-pointer group bg-muted/30 hover:bg-muted/50"
            style={{ borderLeftColor: 'hsl(var(--primary))' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Plane className="h-[18px] w-[18px] text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {trip.location ? `Trip to ${formatCityForDisplay(trip.location) || trip.location.split(',')[0]}` : 'Trip'}
                  </span>
                  {isWithinInterval(startOfDay(new Date()), {
                    start: startOfDay(new Date(trip.start_date + 'T00:00:00')),
                    end: startOfDay(new Date(trip.end_date + 'T00:00:00')),
                  }) && (
                    <Badge variant="default" className="text-[9px] px-1.5 py-0 shrink-0">In Progress</Badge>
                  )}
                </div>
                <div className="flex items-center text-xs text-muted-foreground mt-0.5 ml-[26px]">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {format(new Date(trip.start_date + 'T00:00:00'), 'MMM d')} – {format(new Date(trip.end_date + 'T00:00:00'), 'MMM d')}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {trip.friendProfiles?.length > 0 && (
                  <div className="flex items-center -space-x-1.5">
                    {trip.friendProfiles.slice(0, 4).map((p: any, i: number, arr: any[]) => (
                      <Avatar key={i} className="h-5 w-5 border-[1.5px] border-card" style={{ zIndex: arr.length - i }}>
                        <AvatarImage src={p.avatar || getElephantAvatar(p.name)} className="object-cover" />
                        <AvatarFallback className="text-[8px] bg-muted">{p.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ))}
                    {trip.friendProfiles.length > 4 && (
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted border-[1.5px] border-card text-[8px] font-medium text-muted-foreground">
                        +{trip.friendProfiles.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {tripProposals.map(proposal => {
          const earliestDate = proposal.dates[0];
          const latestDate = proposal.dates[proposal.dates.length - 1];
          const isVisit = proposal.proposalType === 'visit';

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
                    {isVisit ? (
                      <Home className="h-[18px] w-[18px] text-primary shrink-0" />
                    ) : (
                      <Plane className="h-[18px] w-[18px] text-primary shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate text-muted-foreground">
                      {proposal.destination
                        ? `${isVisit ? 'Visit' : 'Trip'} to ${proposal.destination}`
                        : isVisit ? 'Group Visit' : 'Group Trip'}
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
        })}
      </div>
    </CollapsibleWidget>
  );
}
