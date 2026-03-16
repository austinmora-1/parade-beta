import { useState, useEffect } from 'react';
import { format, eachDayOfInterval, isAfter, isBefore, startOfDay } from 'date-fns';
import { CalendarIcon, Plane, MapPin, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TripData {
  startDate: Date;
  endDate: Date;
  location?: string;
}

interface AddTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTripAdded: () => void;
  editingTrip?: TripData | null;
}

export function AddTripDialog({ open, onOpenChange, onTripAdded, editingTrip }: AddTripDialogProps) {
  const { session } = useAuth();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isEditing = !!editingTrip;
  const today = startOfDay(new Date());

  // Populate form when editing
  useEffect(() => {
    if (editingTrip) {
      setStartDate(editingTrip.startDate);
      setEndDate(editingTrip.endDate);
      setLocation(editingTrip.location || '');
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
      setLocation('');
    }
  }, [editingTrip, open]);


  const handleSave = async () => {
    if (!session?.user || !startDate || !endDate) return;

    if (isAfter(startDate, endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setIsLoading(true);

    try {
      // If editing, first clear the old trip dates that are no longer in the new range
      if (editingTrip) {
        const oldDays = eachDayOfInterval({ start: editingTrip.startDate, end: editingTrip.endDate });
        const newDays = eachDayOfInterval({ start: startDate, end: endDate });
        const newDayStrings = new Set(newDays.map(d => format(d, 'yyyy-MM-dd')));
        
        // Find days that were in old trip but not in new trip
        const daysToReset = oldDays.filter(d => !newDayStrings.has(format(d, 'yyyy-MM-dd')));
        
        if (daysToReset.length > 0) {
          const resetData = daysToReset.map(day => ({
            user_id: session.user.id,
            date: format(day, 'yyyy-MM-dd'),
            location_status: 'home',
            trip_location: null,
          }));

          await supabase
            .from('availability')
            .upsert(resetData, { 
              onConflict: 'user_id,date',
              ignoreDuplicates: false 
            });
        }
      }

      // Get all days in the new range
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
      toast.success(`Trip${locationText} ${isEditing ? 'updated' : 'added'}: ${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`);
      onTripAdded();
      onOpenChange(false);
      setStartDate(undefined);
      setEndDate(undefined);
      setLocation('');
    } catch (error) {
      console.error('Error saving trip:', error);
      toast.error(`Failed to ${isEditing ? 'update' : 'add'} trip`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.user || !editingTrip) return;

    setIsLoading(true);

    try {
      const days = eachDayOfInterval({ start: editingTrip.startDate, end: editingTrip.endDate });
      
      const resetData = days.map(day => ({
        user_id: session.user.id,
        date: format(day, 'yyyy-MM-dd'),
        location_status: 'home',
        trip_location: null,
      }));

      const { error } = await supabase
        .from('availability')
        .upsert(resetData, { 
          onConflict: 'user_id,date',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast.success('Trip deleted');
      onTripAdded();
      onOpenChange(false);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error('Failed to delete trip');
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-availability-away-foreground" />
              {isEditing ? 'Edit Trip' : 'Add Trip'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update your trip dates and destination.'
                : 'Set your away dates and destination. All days in this range will be marked as "Away".'
              }
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
              <div className="rounded-lg bg-availability-away/10 p-3 text-sm">
                <p className="font-medium text-availability-away-foreground">
                  {location.trim() && <span>{location.trim()} · </span>}
                  {format(startDate, 'MMM d')} – {format(endDate, 'MMM d, yyyy')}
                </p>
                <p className="text-availability-away-foreground/70">
                  {eachDayOfInterval({ start: startDate, end: endDate }).length} days will be marked as away
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {isEditing && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isLoading}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!startDate || !endDate || isLoading}
                className="bg-availability-away hover:bg-availability-away/90"
              >
                {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Trip')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this trip? All days will be reset to "Home" status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
