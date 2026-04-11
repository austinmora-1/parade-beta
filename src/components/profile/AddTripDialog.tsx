import { useState, useEffect, useMemo } from 'react';
import { format, eachDayOfInterval, isAfter, isBefore, startOfDay } from 'date-fns';
import { CalendarIcon, Plane, Trash2, X, Users, Clock } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { usePlannerStore } from '@/stores/plannerStore';

export interface TripData {
  id?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  availableSlots?: string[];
  priorityFriendIds?: string[];
}

interface FriendOption {
  id: string;
  friendUserId: string;
  name: string;
  avatarUrl?: string;
}

interface AddTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTripAdded: () => void;
  editingTrip?: TripData | null;
}

const ALL_SLOTS: TimeSlot[] = ['early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];

export function AddTripDialog({ open, onOpenChange, onTripAdded, editingTrip }: AddTripDialogProps) {
  const { session } = useAuth();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [location, setLocation] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set(ALL_SLOTS));
  const [priorityFriendIds, setPriorityFriendIds] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const friends = usePlannerStore((s) => s.friends);

  const connectedFriends = useMemo<FriendOption[]>(() => {
    return friends
      .filter(f => f.status === 'connected' && f.friendUserId)
      .map(f => ({
        id: f.id,
        friendUserId: f.friendUserId!,
        name: f.name,
        avatarUrl: f.avatar,
      }));
  }, [friends]);

  const filteredFriends = useMemo(() => {
    const search = friendSearch.toLowerCase();
    return connectedFriends
      .filter(f => !priorityFriendIds.includes(f.friendUserId))
      .filter(f => !search || f.name.toLowerCase().includes(search));
  }, [connectedFriends, priorityFriendIds, friendSearch]);

  const selectedFriendDetails = useMemo(() => {
    return priorityFriendIds
      .map(id => connectedFriends.find(f => f.friendUserId === id))
      .filter(Boolean) as FriendOption[];
  }, [priorityFriendIds, connectedFriends]);

  const isEditing = !!editingTrip;
  const today = startOfDay(new Date());

  // Populate form when editing
  useEffect(() => {
    if (editingTrip) {
      setStartDate(editingTrip.startDate);
      setEndDate(editingTrip.endDate);
      setLocation(editingTrip.location || '');
      setSelectedSlots(new Set(editingTrip.availableSlots?.length ? editingTrip.availableSlots : ALL_SLOTS));
      setPriorityFriendIds(editingTrip.priorityFriendIds || []);
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
      setLocation('');
      setSelectedSlots(new Set(ALL_SLOTS));
      setPriorityFriendIds([]);
    }
    setFriendSearch('');
  }, [editingTrip, open]);

  const toggleSlot = (slot: string) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
  };

  const addFriend = (friendUserId: string) => {
    setPriorityFriendIds(prev => [...prev, friendUserId]);
    setFriendSearch('');
  };

  const removeFriend = (friendUserId: string) => {
    setPriorityFriendIds(prev => prev.filter(id => id !== friendUserId));
  };

  const handleSave = async () => {
    if (!session?.user || !startDate || !endDate) return;

    if (isAfter(startDate, endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setIsLoading(true);

    try {
      const slotsArray = Array.from(selectedSlots);

      // If editing, first clear the old trip dates that are no longer in the new range
      if (editingTrip) {
        const oldDays = eachDayOfInterval({ start: editingTrip.startDate, end: editingTrip.endDate });
        const newDays = eachDayOfInterval({ start: startDate, end: endDate });
        const newDayStrings = new Set(newDays.map(d => format(d, 'yyyy-MM-dd')));
        
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
            .upsert(resetData, { onConflict: 'user_id,date', ignoreDuplicates: false });
        }
      }

      // Get all days in the new range
      const days = eachDayOfInterval({ start: startDate, end: endDate });

      // Build availability rows with slot-level control
      const upsertData = days.map(day => ({
        user_id: session.user.id,
        date: format(day, 'yyyy-MM-dd'),
        location_status: 'away',
        trip_location: location.trim() || null,
        early_morning: selectedSlots.has('early-morning'),
        late_morning: selectedSlots.has('late-morning'),
        early_afternoon: selectedSlots.has('early-afternoon'),
        late_afternoon: selectedSlots.has('late-afternoon'),
        evening: selectedSlots.has('evening'),
        late_night: selectedSlots.has('late-night'),
      }));

      const { error: availError } = await supabase
        .from('availability')
        .upsert(upsertData, { onConflict: 'user_id,date', ignoreDuplicates: false });

      if (availError) throw availError;

      // Upsert trip record
      const tripPayload = {
        user_id: session.user.id,
        location: location.trim() || null,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        available_slots: slotsArray,
        priority_friend_ids: priorityFriendIds,
      };

      if (editingTrip?.id) {
        const { error: tripError } = await supabase
          .from('trips')
          .update(tripPayload)
          .eq('id', editingTrip.id);
        if (tripError) throw tripError;
      } else {
        // Check for existing trip with same dates to avoid duplicates
        const { data: existingTrip } = await supabase
          .from('trips')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('start_date', format(startDate, 'yyyy-MM-dd'))
          .eq('end_date', format(endDate, 'yyyy-MM-dd'))
          .maybeSingle();

        if (existingTrip) {
          const { error: tripError } = await supabase
            .from('trips')
            .update(tripPayload)
            .eq('id', existingTrip.id);
          if (tripError) throw tripError;
        } else {
          const { error: tripError } = await supabase
            .from('trips')
            .insert(tripPayload);
          if (tripError) throw tripError;
        }
      }

      const locationText = location.trim() ? ` to ${location.trim()}` : '';
      toast.success(`Trip${locationText} ${isEditing ? 'updated' : 'added'}: ${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`);
      onTripAdded();
      onOpenChange(false);
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
        .upsert(resetData, { onConflict: 'user_id,date', ignoreDuplicates: false });

      if (error) throw error;

      // Delete trip record
      if (editingTrip.id) {
        await supabase.from('trips').delete().eq('id', editingTrip.id);
      } else {
        // Try to find and delete by date range
        await supabase
          .from('trips')
          .delete()
          .eq('user_id', session.user.id)
          .eq('start_date', format(editingTrip.startDate, 'yyyy-MM-dd'))
          .eq('end_date', format(editingTrip.endDate, 'yyyy-MM-dd'));
      }

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
    if (date && endDate && isBefore(endDate, date)) {
      setEndDate(undefined);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-availability-away-foreground" />
              {isEditing ? 'Edit Trip' : 'Add Trip'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update your trip dates, availability, and friends to see.'
                : 'Set your trip details, when you\'re free, and who you want to see.'
              }
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
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

              {/* Available Time Slots */}
              {startDate && endDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Available time slots
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Which times are you free during this trip?
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_SLOTS.map(slot => {
                      const info = TIME_SLOT_LABELS[slot];
                      const isSelected = selectedSlots.has(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => toggleSlot(slot)}
                          className={cn(
                            "rounded-lg px-3 py-2 text-left transition-colors border",
                            isSelected
                              ? "bg-availability-available-light border-availability-available text-foreground"
                              : "bg-muted/30 border-transparent text-muted-foreground"
                          )}
                        >
                          <span className="text-xs font-medium">{info.label}</span>
                          <span className="text-[10px] ml-1 opacity-70">{info.time}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Priority Friends */}
              {startDate && endDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Friends to see
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Tag friends you want to hang out with during this trip
                  </p>

                  {/* Selected friends chips */}
                  {selectedFriendDetails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFriendDetails.map(friend => (
                        <span
                          key={friend.friendUserId}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-1 pr-2 py-0.5 text-xs"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={friend.avatarUrl} />
                            <AvatarFallback className="text-[8px]">
                              {friend.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{friend.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFriend(friend.friendUserId)}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Friend search */}
                  <Input
                    placeholder="Search friends..."
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="h-8 text-sm"
                  />

                  {/* Friend suggestions */}
                  {(friendSearch || priorityFriendIds.length === 0) && filteredFriends.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
                      {filteredFriends.slice(0, 8).map(friend => (
                        <button
                          key={friend.friendUserId}
                          type="button"
                          onClick={() => addFriend(friend.friendUserId)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={friend.avatarUrl} />
                            <AvatarFallback className="text-[10px]">
                              {friend.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{friend.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Preview */}
              {startDate && endDate && (
                <div className="rounded-lg bg-availability-away/10 p-3 text-sm">
                  <p className="font-medium text-availability-away-foreground">
                    {location.trim() && <span>{location.trim()} · </span>}
                    {format(startDate, 'MMM d')} – {format(endDate, 'MMM d, yyyy')}
                  </p>
                  <p className="text-availability-away-foreground/70">
                    {eachDayOfInterval({ start: startDate, end: endDate }).length} days · {selectedSlots.size} of 6 slots free
                    {priorityFriendIds.length > 0 && ` · ${priorityFriendIds.length} friend${priorityFriendIds.length > 1 ? 's' : ''} to see`}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

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
