import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlaneTakeoff, CalendarIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface PendingReturnTrip {
  destination: string;
  departureDate: string;
}

interface MissingReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trips: PendingReturnTrip[];
  onComplete: () => void;
}

export function MissingReturnDialog({ open, onOpenChange, trips, onComplete }: MissingReturnDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentTrip = trips[currentIndex];
  if (!currentTrip) return null;

  const departureDate = new Date(currentTrip.departureDate + 'T00:00:00');

  const handleSaveReturnDate = async () => {
    if (!selectedDate) return;
    setSaving(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = authData.user;
      if (!user) throw new Error('User not found');

      const returnDateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data: exactTrips, error: exactTripsError } = await supabase
        .from('trips')
        .select('id')
        .eq('user_id', user.id)
        .eq('start_date', currentTrip.departureDate)
        .ilike('location', `%${currentTrip.destination}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (exactTripsError) throw exactTripsError;

      let tripId = exactTrips?.[0]?.id;

      if (!tripId) {
        const { data: overlappingTrips, error: overlappingTripsError } = await supabase
          .from('trips')
          .select('id')
          .eq('user_id', user.id)
          .lte('start_date', currentTrip.departureDate)
          .gte('end_date', currentTrip.departureDate)
          .ilike('location', `%${currentTrip.destination}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (overlappingTripsError) throw overlappingTripsError;
        tripId = overlappingTrips?.[0]?.id;
      }

      if (tripId) {
        const { error: updateTripError } = await supabase
          .from('trips')
          .update({ end_date: returnDateStr, needs_return_date: false })
          .eq('id', tripId);

        if (updateTripError) throw updateTripError;
      } else {
        const { error: insertTripError } = await supabase
          .from('trips')
          .insert({
            user_id: user.id,
            location: currentTrip.destination,
            start_date: currentTrip.departureDate,
            end_date: returnDateStr,
            needs_return_date: false,
          });

        if (insertTripError) throw insertTripError;
      }

      const dates: string[] = [];
      const current = new Date(currentTrip.departureDate + 'T00:00:00');
      const end = new Date(returnDateStr + 'T00:00:00');
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const { error: availabilityError } = await supabase
        .from('availability')
        .upsert(
          dates.map((date) => ({
            date,
            location_status: 'away',
            trip_location: currentTrip.destination,
            user_id: user.id,
          })),
          { onConflict: 'user_id,date' }
        );

      if (availabilityError) throw availabilityError;

      toast.success(`Welcome back from ${currentTrip.destination} 🏠`);
    } catch (err) {
      console.error('Error setting return date:', err);
      toast.error("Couldn't save that return date — try again?");
    } finally {
      setSaving(false);
      goToNext();
    }
  };

  const handleSkip = async () => {
    // Clear the flag so we don't keep asking
    try {
      const { data: existingTrips } = await supabase
        .from('trips')
        .select('id')
        .lte('start_date', currentTrip.departureDate)
        .gte('end_date', currentTrip.departureDate)
        .ilike('location', `%${currentTrip.destination}%`);

      if (existingTrips && existingTrips.length > 0) {
        await supabase
          .from('trips')
          .update({ needs_return_date: false })
          .eq('id', existingTrips[0].id);
      }
    } catch {
      // silent
    }
    goToNext();
  };

  const goToNext = () => {
    setSelectedDate(undefined);
    setDatePickerOpen(false);
    if (currentIndex < trips.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onOpenChange(false);
      onComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlaneTakeoff className="h-5 w-5 text-primary" />
            Missing Return Flight
          </DialogTitle>
          <DialogDescription>
            We found a one-way flight to <strong>{currentTrip.destination}</strong> on{' '}
            <strong>{format(departureDate, 'MMM d, yyyy')}</strong> but no return flight.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {trips.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Trip {currentIndex + 1} of {trips.length}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">When are you coming back?</p>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Pick a return date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setDatePickerOpen(false);
                  }}
                  disabled={(date) => date <= departureDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveReturnDate}
              disabled={!selectedDate || saving}
              className="flex-1"
            >
              {saving ? 'Saving...' : 'Set Return Date'}
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="shrink-0"
            >
              <X className="h-4 w-4 mr-1" />
              Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
