import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, eachDayOfInterval, differenceInDays } from 'date-fns';
import { ArrowLeft, Plane, MapPin, Calendar, Clock, Users, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { type TripData } from '@/components/profile/AddTripDialog';

const AddTripDialog = lazy(() => import('@/components/profile/AddTripDialog'));
import { toast } from 'sonner';
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
import { cn } from '@/lib/utils';
import { formatCityForDisplay } from '@/lib/formatCity';
import { TripActivities } from '@/components/trips/TripActivities';

const TRIPS_UPDATED_EVENT = 'trips:updated';

interface TripRow {
  id: string;
  location: string | null;
  start_date: string;
  end_date: string;
  priority_friend_ids: string[];
  available_slots: string[];
  proposal_id: string | null;
}

interface FriendProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface TripParticipant {
  id: string;
  friend_user_id: string;
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);

  const [trip, setTrip] = useState<TripRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendProfiles, setFriendProfiles] = useState<FriendProfile[]>([]);
  const [companionProfiles, setCompanionProfiles] = useState<FriendProfile[]>([]);
  const [proposalParticipantCount, setProposalParticipantCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!tripId || !user) return;
    const fetchTrip = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        setLoading(false);
        return;
      }
      setTrip(data);

      // Fetch friend profiles
      if (data.priority_friend_ids?.length > 0) {
        const { data: profiles } = await supabase
          .rpc('get_display_names_for_users', { p_user_ids: data.priority_friend_ids });
        if (profiles) setFriendProfiles(profiles);
      }

      // Fetch travel companions
      const { data: participants } = await supabase
        .from('trip_participants')
        .select('friend_user_id')
        .eq('trip_id', tripId);
      if (participants && participants.length > 0) {
        const companionIds = participants.map((p: any) => p.friend_user_id);
        const { data: cProfiles } = await supabase
          .rpc('get_display_names_for_users', { p_user_ids: companionIds });
        if (cProfiles) setCompanionProfiles(cProfiles);
      } else {
        setCompanionProfiles([]);
      }

      // If linked to a shared proposal, fetch participant count for activity-vote context
      if ((data as any).proposal_id) {
        const { count } = await supabase
          .from('trip_proposal_participants')
          .select('*', { count: 'exact', head: true })
          .eq('proposal_id', (data as any).proposal_id);
        setProposalParticipantCount(count || 0);
      } else {
        setProposalParticipantCount(0);
      }

      setLoading(false);
    };
    fetchTrip();
  }, [tripId, user]);

  const handleDelete = async () => {
    if (!trip) return;
    setDeleting(true);
    const { error } = await supabase.from('trips').delete().eq('id', trip.id);
    if (error) {
      toast.error('Failed to delete trip');
    } else {
      toast.success('Trip deleted');
      window.dispatchEvent(new Event(TRIPS_UPDATED_EVENT));
      await loadProfileAndAvailability();
      navigate('/trips');
    }
    setDeleting(false);
  };

  const handleTripEdited = async () => {
    // Reload trip data
    if (!tripId || !user) return;
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setTrip(data);
      if (data.priority_friend_ids?.length > 0) {
        const { data: profiles } = await supabase
          .rpc('get_display_names_for_users', { p_user_ids: data.priority_friend_ids });
        if (profiles) setFriendProfiles(profiles);
      } else {
        setFriendProfiles([]);
      }
        // Reload companions
        const { data: participants } = await supabase
          .from('trip_participants')
          .select('friend_user_id')
          .eq('trip_id', tripId);
        if (participants && participants.length > 0) {
          const companionIds = participants.map((p: any) => p.friend_user_id);
          const { data: cProfiles } = await supabase
            .rpc('get_display_names_for_users', { p_user_ids: companionIds });
          if (cProfiles) setCompanionProfiles(cProfiles);
          else setCompanionProfiles([]);
        } else {
          setCompanionProfiles([]);
        }
    }
    await loadProfileAndAvailability();
  };

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading trip...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="animate-fade-in space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Trip not found</p>
        </div>
      </div>
    );
  }

  const startDate = new Date(trip.start_date + 'T00:00:00');
  const endDate = new Date(trip.end_date + 'T00:00:00');
  const duration = differenceInDays(endDate, startDate) + 1;
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const editTravelCompanionIds = companionProfiles.map(c => c.user_id);

  const editTripData: TripData = {
    id: trip.id,
    startDate,
    endDate,
    location: trip.location || undefined,
    availableSlots: trip.available_slots,
    priorityFriendIds: trip.priority_friend_ids,
    travelCompanionIds: editTravelCompanionIds,
  };

  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Trip Hero */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-availability-away/15 text-availability-away">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">
              {trip.location ? (formatCityForDisplay(trip.location) || trip.location) : 'Trip'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {duration} {duration === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {format(startDate, 'MMM d, yyyy')} – {format(endDate, 'MMM d, yyyy')}
          </span>
          {trip.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {formatCityForDisplay(trip.location) || trip.location}
            </span>
          )}
        </div>
      </div>

      {/* Available Time Slots */}
      <div className="space-y-2">
        <h2 className="font-display text-sm font-semibold">Available Time Slots</h2>
        <div className="flex flex-wrap gap-1.5">
          {trip.available_slots.length > 0 ? (
            trip.available_slots.map((slot) => {
              const label = TIME_SLOT_LABELS[slot as TimeSlot];
              return (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
                >
                  <Clock className="h-3 w-3" />
                  {label ? `${label.label} (${label.time})` : slot}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">All day</span>
          )}
        </div>
      </div>

      {/* Days */}
      <div className="space-y-2">
        <h2 className="font-display text-sm font-semibold">Trip Days</h2>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex flex-col items-center rounded-lg bg-availability-away/10 p-2"
            >
              <span className="text-[10px] text-muted-foreground">{format(day, 'EEE')}</span>
              <span className="text-xs font-medium">{format(day, 'd')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Friends to See */}
      <div className="space-y-2">
        {/* Travel Companions */}
        <div className="flex items-center gap-1.5">
          <Plane className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm font-semibold">
            Traveling With ({companionProfiles.length})
          </h2>
        </div>
        {companionProfiles.length > 0 ? (
          <div className="space-y-1.5">
            {companionProfiles.map((friend) => (
              <button
                key={friend.user_id}
                onClick={() => navigate(`/friend/${friend.user_id}`)}
                className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={friend.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {(friend.display_name || '?')[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">
                  {friend.display_name || 'Friend'}
                </span>
                <span className="ml-auto text-[10px] text-availability-away-foreground font-medium flex items-center gap-0.5">
                  <Plane className="h-2.5 w-2.5" />
                  Companion
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">No travel companions added</p>
          </div>
        )}
      </div>

      {/* Friends to See */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm font-semibold">
            Friends to See ({friendProfiles.length})
          </h2>
        </div>
        {friendProfiles.length > 0 ? (
          <div className="space-y-1.5">
            {friendProfiles.map((friend) => (
              <button
                key={friend.user_id}
                onClick={() => navigate(`/friend/${friend.user_id}`)}
                className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={friend.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {(friend.display_name || '?')[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">
                  {friend.display_name || 'Friend'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">No friends tagged for this trip</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editOpen && (
        <Suspense fallback={null}>
          <AddTripDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            editingTrip={editTripData}
            onTripAdded={handleTripEdited}
          />
        </Suspense>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trip</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your trip to {trip.location ? (formatCityForDisplay(trip.location) || trip.location) : 'this destination'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
