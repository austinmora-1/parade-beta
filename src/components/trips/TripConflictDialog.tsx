import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, Merge, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TripConflict {
  trip_a_id: string;
  trip_a_name: string | null;
  trip_a_location: string;
  trip_a_start: string;
  trip_a_end: string;
  trip_a_participant_ids: string[];
  trip_b_id: string;
  trip_b_name: string | null;
  trip_b_location: string;
  trip_b_start: string;
  trip_b_end: string;
  trip_b_participant_ids: string[];
}

interface TripConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: TripConflict[];
  onResolved: () => void;
}

type ProfileLite = { user_id: string; display_name: string | null; avatar_url: string | null };

export function TripConflictDialog({ open, onOpenChange, conflicts, onResolved }: TripConflictDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});

  const conflict = conflicts[currentIndex];

  // Fetch profiles for all participants across all conflicts
  const allParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conflicts) {
      (c.trip_a_participant_ids || []).forEach((id) => ids.add(id));
      (c.trip_b_participant_ids || []).forEach((id) => ids.add(id));
    }
    return Array.from(ids);
  }, [conflicts]);

  useEffect(() => {
    if (!open || allParticipantIds.length === 0) return;
    const missing = allParticipantIds.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', missing);
      if (data) {
        setProfiles((prev) => {
          const next = { ...prev };
          for (const p of data) next[p.user_id] = p as ProfileLite;
          return next;
        });
      }
    })();
  }, [open, allParticipantIds, profiles]);

  if (!conflict) return null;

  const goToNext = () => {
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
      onOpenChange(false);
      onResolved();
    }
  };

  // Merge: keep `keepId`, merge dates + participants from `mergeFromId`, then delete `mergeFromId`
  const mergeTrips = async (keepId: string, mergeFromId: string, keepLabel: string) => {
    setSaving(true);
    try {
      const newStart = conflict.trip_a_start < conflict.trip_b_start ? conflict.trip_a_start : conflict.trip_b_start;
      const newEnd = conflict.trip_a_end > conflict.trip_b_end ? conflict.trip_a_end : conflict.trip_b_end;

      // Expand kept trip's date range
      await supabase
        .from('trips')
        .update({ start_date: newStart, end_date: newEnd })
        .eq('id', keepId);

      // Merge participants from the other trip onto the kept trip
      const { data: otherParticipants } = await supabase
        .from('trip_participants')
        .select('friend_user_id')
        .eq('trip_id', mergeFromId);

      if (otherParticipants && otherParticipants.length > 0) {
        const rows = otherParticipants.map((p) => ({
          trip_id: keepId,
          friend_user_id: p.friend_user_id,
        }));
        // Unique constraint on (trip_id, friend_user_id) — ignore conflicts
        await supabase.from('trip_participants').upsert(rows, {
          onConflict: 'trip_id,friend_user_id',
          ignoreDuplicates: true,
        });
      }

      // Delete the other trip (cascades its participants)
      await supabase.from('trips').delete().eq('id', mergeFromId);

      toast.success(`Merged into "${keepLabel}" ✨`);
    } catch (err) {
      console.error('Error merging trips:', err);
      toast.error('Failed to merge trips');
    } finally {
      setSaving(false);
      goToNext();
    }
  };

  const handleKeepBoth = () => {
    // User says these are intentionally separate trips
    goToNext();
  };

  const fmtDate = (d: string) => format(new Date(d + 'T00:00:00'), 'MMM d');
  const labelFor = (name: string | null, location: string) => (name && name.trim()) || location;

  const renderParticipants = (ids: string[]) => {
    if (!ids || ids.length === 0) {
      return (
        <p className="text-[11px] text-muted-foreground/70 mt-1.5 flex items-center gap-1">
          <Users className="h-3 w-3" />
          No participants yet
        </p>
      );
    }
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <div className="flex -space-x-1.5">
          {ids.slice(0, 5).map((id) => {
            const p = profiles[id];
            const name = p?.display_name || '?';
            return (
              <Avatar key={id} className="h-5 w-5 border border-background">
                {p?.avatar_url && <AvatarImage src={p.avatar_url} alt={name} />}
                <AvatarFallback className="text-[9px]">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            );
          })}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {ids.length} {ids.length === 1 ? 'participant' : 'participants'}
        </span>
      </div>
    );
  };

  const tripACard = (
    <div className="rounded-lg border border-border p-3 bg-muted/30">
      <p className="text-sm font-medium">{labelFor(conflict.trip_a_name, conflict.trip_a_location)}</p>
      {conflict.trip_a_name && (
        <p className="text-[11px] text-muted-foreground">{conflict.trip_a_location}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {fmtDate(conflict.trip_a_start)} – {fmtDate(conflict.trip_a_end)}
      </p>
      {renderParticipants(conflict.trip_a_participant_ids || [])}
    </div>
  );

  const tripBCard = (
    <div className="rounded-lg border border-border p-3 bg-muted/30">
      <p className="text-sm font-medium">{labelFor(conflict.trip_b_name, conflict.trip_b_location)}</p>
      {conflict.trip_b_name && (
        <p className="text-[11px] text-muted-foreground">{conflict.trip_b_location}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {fmtDate(conflict.trip_b_start)} – {fmtDate(conflict.trip_b_end)}
      </p>
      {renderParticipants(conflict.trip_b_participant_ids || [])}
    </div>
  );

  const labelA = labelFor(conflict.trip_a_name, conflict.trip_a_location);
  const labelB = labelFor(conflict.trip_b_name, conflict.trip_b_location);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Overlapping Trips
          </DialogTitle>
          <DialogDescription>
            These two trips overlap. Merge them into one — participants will combine and dates will span both ranges.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {conflicts.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Conflict {currentIndex + 1} of {conflicts.length}
            </p>
          )}

          <div className="space-y-2">
            {tripACard}
            {tripBCard}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={() => mergeTrips(conflict.trip_a_id, conflict.trip_b_id, labelA)}
              disabled={saving}
              className="w-full justify-start gap-2"
            >
              <Merge className="h-4 w-4" />
              Merge into "{labelA}"
            </Button>
            <Button
              size="sm"
              onClick={() => mergeTrips(conflict.trip_b_id, conflict.trip_a_id, labelB)}
              disabled={saving}
              className="w-full justify-start gap-2"
            >
              <Merge className="h-4 w-4" />
              Merge into "{labelB}"
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleKeepBoth}
              disabled={saving}
              className="w-full justify-start gap-2"
            >
              Keep both as separate trips
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
