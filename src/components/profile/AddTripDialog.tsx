import { useState } from 'react';
import { format, eachDayOfInterval, isAfter, isBefore, startOfDay } from 'date-fns';
import { CalendarIcon, Plane, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AddTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTripAdded: () => void;
}

export function AddTripDialog({ open, onOpenChange, onTripAdded }: AddTripDialogProps) {
  const { session } = useAuth();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const today = startOfDay(new Date());

  const handleSave = async () => {
    if (!session?.user || !startDate || !endDate) return;

    if (isAfter(startDate, endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setIsLoading(true);

    try {
      // Get all days in the range
      const days = eachDayOfInterval({ start: startDate, end: endDate });

      // Upsert availability for each day with location
      const upsertData = days.map(day => ({
        user_id: session.user.id,
        date: format(day, 'yyyy-MM-dd'),
        location_status: 'away',
        trip_location: location.trim() || null,
      }));

      const { error } = await supabase
        .from('availability')
        .upsert(upsertData, { 
          onConflict: 'user_id,date',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      const locationText = location.trim() ? ` to ${location.trim()}` : '';
      toast.success(`Trip${locationText} added: ${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`);
      onTripAdded();
      onOpenChange(false);
      setStartDate(undefined);
      setEndDate(undefined);
      setLocation('');
    } catch (error) {
      console.error('Error adding trip:', error);
      toast.error('Failed to add trip');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date);
    // If end date is before new start date, clear it
    if (date && endDate && isBefore(endDate, date)) {
      setEndDate(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-orange-600" />
            Add Trip
          </DialogTitle>
          <DialogDescription>
            Set your away dates and destination. All days in this range will be marked as "Away".
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Destination (optional)
            </label>
            <Input
              placeholder="e.g. Paris, Tokyo, New York..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Select start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleStartDateSelect}
                  disabled={(date) => isBefore(date, today)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Select end date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => 
                    isBefore(date, today) || 
                    (startDate ? isBefore(date, startDate) : false)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Preview */}
          {startDate && endDate && (
            <div className="rounded-lg bg-orange-500/10 p-3 text-sm">
              <p className="font-medium text-orange-700">
                {location.trim() && <span>{location.trim()} · </span>}
                {format(startDate, 'MMM d')} – {format(endDate, 'MMM d, yyyy')}
              </p>
              <p className="text-orange-600/70">
                {eachDayOfInterval({ start: startDate, end: endDate }).length} days will be marked as away
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!startDate || !endDate || isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? 'Adding...' : 'Add Trip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
