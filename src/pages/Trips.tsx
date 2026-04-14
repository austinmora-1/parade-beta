import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TripsList } from '@/components/trips/TripsList';

import { MissingReturnDialog, PendingReturnTrip } from '@/components/trips/MissingReturnDialog';
import { TripConflictDialog, TripConflict } from '@/components/trips/TripConflictDialog';
import { GuidedTripSheet } from '@/components/trips/GuidedTripSheet';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';

export default function Trips() {
  const { user } = useAuth();
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);
  const loadPlans = usePlannerStore((s) => s.loadPlans);
  const [guidedSheetOpen, setGuidedSheetOpen] = useState(false);
  const [tripsRefreshKey, setTripsRefreshKey] = useState(0);
  const [pendingReturnTrips, setPendingReturnTrips] = useState<PendingReturnTrip[]>([]);
  const [missingReturnOpen, setMissingReturnOpen] = useState(false);
  const [tripConflicts, setTripConflicts] = useState<TripConflict[]>([]);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  const checkTripConflicts = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.rpc('merge_overlapping_trips', { p_user_id: user.id });
      const { data } = await supabase.rpc('get_conflicting_trips', { p_user_id: user.id });
      if (data && data.length > 0) {
        setTripConflicts(data as TripConflict[]);
        setConflictDialogOpen(true);
      }
    } catch (err) {
      console.error('Error checking trip conflicts:', err);
    }
  }, [user]);

  useEffect(() => {
    checkTripConflicts();
  }, [checkTripConflicts]);

  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold md:text-2xl">Trips</h1>
          <p className="hidden text-muted-foreground md:block">
            Track your upcoming trips and travel plans
          </p>
        </div>
        <Button
          size="sm"
          variant="default"
          className="gap-2 shrink-0"
          onClick={() => setGuidedSheetOpen(true)}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </div>

      <TripsList refreshKey={tripsRefreshKey} />

      <MissingReturnDialog
        open={missingReturnOpen}
        onOpenChange={setMissingReturnOpen}
        trips={pendingReturnTrips}
        onComplete={() => {
          loadProfileAndAvailability();
          loadPlans();
          checkTripConflicts();
        }}
      />

      <TripConflictDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflicts={tripConflicts}
        onResolved={() => {
          loadProfileAndAvailability();
          loadPlans();
        }}
      />

      <GuidedTripSheet
        open={guidedSheetOpen}
        onOpenChange={(open) => {
          setGuidedSheetOpen(open);
          if (!open) {
            setTripsRefreshKey(k => k + 1);
            loadProfileAndAvailability();
          }
        }}
      />
    </div>
  );
}
