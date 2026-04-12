import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, eachDayOfInterval, isAfter, isBefore, startOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { CalendarIcon, Plane, Trash2, X, Users, Clock, CheckSquare, Square, ChevronDown, Loader2 } from 'lucide-react';
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
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
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

// Per-day slots map: dateString -> Set<slotName>
type DaySlotsMap = Map<string, Set<string>>;

function buildDaySlotsMap(days: Date[], defaultSlots: string[] = ALL_SLOTS as string[]): DaySlotsMap {
  const map: DaySlotsMap = new Map();
  for (const day of days) {
    map.set(format(day, 'yyyy-MM-dd'), new Set(defaultSlots));
  }
  return map;
}

export function AddTripDialog({ open, onOpenChange, onTripAdded, editingTrip }: AddTripDialogProps) {
  const { session } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [location, setLocation] = useState('');
  const [daySlots, setDaySlots] = useState<DaySlotsMap>(new Map());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [priorityFriendIds, setPriorityFriendIds] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [nearbyFriendIds, setNearbyFriendIds] = useState<string[] | null>(null);
  const [visitingFriendIds, setVisitingFriendIds] = useState<string[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);

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

  // Fetch friend home addresses and filter by proximity when location changes
  useEffect(() => {
    const trimmedLocation = location.trim();
    if (!trimmedLocation || connectedFriends.length === 0 || !session?.user) {
      setNearbyFriendIds(null);
      setVisitingFriendIds([]);
      return;
    }

    let cancelled = false;
    const fetchNearby = async () => {
      setIsLoadingNearby(true);
      try {
        const friendUserIds = connectedFriends.map(f => f.friendUserId);

        // Fetch home_address for all connected friends
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, home_address')
          .in('user_id', friendUserIds);

        const friendCities = (profiles || [])
          .filter(p => p.home_address && p.home_address.trim().length > 0)
          .map(p => ({ userId: p.user_id, city: p.home_address! }));

        // Fetch friends' trips that overlap with our date range and match destination
        let overlappingVisitors: string[] = [];
        if (dateRange?.from && dateRange?.to) {
          const startStr = format(dateRange.from, 'yyyy-MM-dd');
          const endStr = format(dateRange.to, 'yyyy-MM-dd');

          // Get trips from friends that overlap our dates
          const { data: friendTrips } = await supabase
            .from('trips')
            .select('user_id, location, start_date, end_date')
            .in('user_id', friendUserIds)
            .lte('start_date', endStr)
            .gte('end_date', startStr);

          if (friendTrips && friendTrips.length > 0) {
            // Filter trips whose location matches/is near our destination via the edge function
            const tripCities = friendTrips
              .filter(t => t.location && t.location.trim().length > 0)
              .map(t => ({ userId: t.user_id, city: t.location! }));

            if (tripCities.length > 0) {
              const { data: tripData, error: tripErr } = await supabase.functions.invoke('filter-friends-by-location', {
                body: { tripLocation: trimmedLocation, friendCities: tripCities }
              });
              if (!tripErr && tripData?.nearbyFriendIds) {
                overlappingVisitors = tripData.nearbyFriendIds;
              }
            }
          }
        }

        // Geocode home addresses for "lives there" friends
        let homeNearbyIds: string[] = [];
        if (friendCities.length > 0) {
          const { data, error } = await supabase.functions.invoke('filter-friends-by-location', {
            body: { tripLocation: trimmedLocation, friendCities }
          });
          if (!error && data?.nearbyFriendIds) {
            homeNearbyIds = data.nearbyFriendIds;
          }
        }

        if (!cancelled) {
          setNearbyFriendIds(homeNearbyIds);
          // Visiting = friends whose trip overlaps but who don't already live there
          setVisitingFriendIds(overlappingVisitors.filter(id => !homeNearbyIds.includes(id)));
        }
      } catch (err) {
        console.error('Error fetching nearby friends:', err);
        if (!cancelled) {
          setNearbyFriendIds(null);
          setVisitingFriendIds([]);
        }
      } finally {
        if (!cancelled) setIsLoadingNearby(false);
      }
    };

    const timeout = setTimeout(fetchNearby, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [location, connectedFriends, session?.user, dateRange?.from, dateRange?.to]);

  // Combined set of suggested friend IDs (lives nearby + visiting)
  const suggestedFriendIds = useMemo(() => {
    if (nearbyFriendIds === null) return null;
    const set = new Set([...nearbyFriendIds, ...visitingFriendIds]);
    return Array.from(set);
  }, [nearbyFriendIds, visitingFriendIds]);

  const filteredFriends = useMemo(() => {
    const search = friendSearch.toLowerCase();
    let pool = connectedFriends.filter(f => !priorityFriendIds.includes(f.friendUserId));
    
    // If we have nearby/visiting data, filter to only those friends (unless searching)
    if (suggestedFriendIds !== null && !friendSearch.trim()) {
      pool = pool.filter(f => suggestedFriendIds.includes(f.friendUserId));
    }
    
    return pool.filter(f => !search || f.name.toLowerCase().includes(search));
  }, [connectedFriends, priorityFriendIds, friendSearch, suggestedFriendIds]);

  const selectedFriendDetails = useMemo(() => {
    return priorityFriendIds
      .map(id => connectedFriends.find(f => f.friendUserId === id))
      .filter(Boolean) as FriendOption[];
  }, [priorityFriendIds, connectedFriends]);

  const startDate = dateRange?.from;
  const endDate = dateRange?.to;

  const tripDays = useMemo(() => {
    if (!startDate || !endDate) return [];
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  const isEditing = !!editingTrip;
  const today = startOfDay(new Date());

  // Rebuild daySlots when dates change
  useEffect(() => {
    if (tripDays.length > 0) {
      setDaySlots(prev => {
        const next: DaySlotsMap = new Map();
        for (const day of tripDays) {
          const key = format(day, 'yyyy-MM-dd');
          // Preserve existing selections if the day was already configured
          next.set(key, prev.get(key) ?? new Set(ALL_SLOTS));
        }
        return next;
      });
    }
  }, [tripDays]);

  // Populate form when editing
  useEffect(() => {
    if (editingTrip) {
      setDateRange({ from: editingTrip.startDate, to: editingTrip.endDate });
      setLocation(editingTrip.location || '');
      const days = eachDayOfInterval({ start: editingTrip.startDate, end: editingTrip.endDate });
      const defaultSlots = editingTrip.availableSlots?.length ? editingTrip.availableSlots : ALL_SLOTS as string[];
      setDaySlots(buildDaySlotsMap(days, defaultSlots));
      setPriorityFriendIds(editingTrip.priorityFriendIds || []);
    } else {
      setDateRange(undefined);
      setLocation('');
      setDaySlots(new Map());
      setPriorityFriendIds([]);
    }
    setFriendSearch('');
  }, [editingTrip, open]);

  const toggleDaySlot = useCallback((dateKey: string, slot: string) => {
    setDaySlots(prev => {
      const next = new Map(prev);
      const daySet = new Set(next.get(dateKey) ?? ALL_SLOTS);
      if (daySet.has(slot)) {
        daySet.delete(slot);
      } else {
        daySet.add(slot);
      }
      next.set(dateKey, daySet);
      return next;
    });
  }, []);

  const toggleAllSlotsForDay = useCallback((dateKey: string) => {
    setDaySlots(prev => {
      const next = new Map(prev);
      const daySet = next.get(dateKey) ?? new Set();
      if (daySet.size === ALL_SLOTS.length) {
        next.set(dateKey, new Set());
      } else {
        next.set(dateKey, new Set(ALL_SLOTS));
      }
      return next;
    });
  }, []);

  const selectAllDays = useCallback(() => {
    setDaySlots(prev => {
      const next = new Map(prev);
      for (const [key] of next) {
        next.set(key, new Set(ALL_SLOTS));
      }
      return next;
    });
  }, []);

  const clearAllDays = useCallback(() => {
    setDaySlots(prev => {
      const next = new Map(prev);
      for (const [key] of next) {
        next.set(key, new Set());
      }
      return next;
    });
  }, []);

  const addFriend = (friendUserId: string) => {
    setPriorityFriendIds(prev => [...prev, friendUserId]);
    setFriendSearch('');
  };

  const removeFriend = (friendUserId: string) => {
    setPriorityFriendIds(prev => prev.filter(id => id !== friendUserId));
  };

  // Count total selected slots across all days
  const totalSelectedSlots = useMemo(() => {
    let total = 0;
    for (const [, set] of daySlots) {
      total += set.size;
    }
    return total;
  }, [daySlots]);

  const totalPossibleSlots = tripDays.length * ALL_SLOTS.length;

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

      // Build availability rows with per-day slot-level control
      const upsertData = days.map(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const slots = daySlots.get(dateKey) ?? new Set(ALL_SLOTS);
        return {
          user_id: session.user.id,
          date: dateKey,
          location_status: 'away',
          trip_location: location.trim() || null,
          early_morning: slots.has('early-morning'),
          late_morning: slots.has('late-morning'),
          early_afternoon: slots.has('early-afternoon'),
          late_afternoon: slots.has('late-afternoon'),
          evening: slots.has('evening'),
          late_night: slots.has('late-night'),
        };
      });

      const { error: availError } = await supabase
        .from('availability')
        .upsert(upsertData, { onConflict: 'user_id,date', ignoreDuplicates: false });

      if (availError) throw availError;

      // Collect the union of all selected slots for the trips table summary
      const allSelectedSlots = new Set<string>();
      for (const [, set] of daySlots) {
        for (const s of set) allSelectedSlots.add(s);
      }

      // Upsert trip record
      const tripPayload = {
        user_id: session.user.id,
        location: location.trim() || null,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        available_slots: Array.from(allSelectedSlots),
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

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setCalendarOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] flex flex-col overflow-hidden">
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

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y -mx-6 px-6"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="grid gap-4 py-4">
              {/* Location */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Destination (optional)
                </label>
                <CityAutocomplete
                  value={location}
                  onChange={setLocation}
                  placeholder="e.g. Paris, Tokyo, New York..."
                  compact
                />
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Trip Dates</label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange?.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          `${format(dateRange.from, 'MMM d, yyyy')} – ${format(dateRange.to, 'MMM d, yyyy')}`
                        ) : (
                          format(dateRange.from, 'MMM d, yyyy')
                        )
                      ) : (
                        'Select dates'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={handleDateRangeSelect}
                      disabled={(date) => isBefore(date, today)}
                      numberOfMonths={1}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Per-Day Available Time Slots */}
              {tripDays.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Available time slots
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={selectAllDays}
                        className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
                      >
                        All free
                      </button>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <button
                        type="button"
                        onClick={clearAllDays}
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Pick which slots you want to hang with friends
                  </p>

                  <div className="space-y-2">
                    {tripDays.map(day => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const slots = daySlots.get(dateKey) ?? new Set(ALL_SLOTS);
                      const allSelected = slots.size === ALL_SLOTS.length;

                      return (
                        <div key={dateKey} className="rounded-lg border border-border overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedDays(prev => {
                              const next = new Set(prev);
                              next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
                              return next;
                            })}
                            className="flex w-full items-center justify-between p-2.5 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expandedDays.has(dateKey) && "rotate-180")} />
                              <span className="text-xs font-semibold">
                                {format(day, 'EEE, MMM d')}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {slots.size}/{ALL_SLOTS.length} slots
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleAllSlotsForDay(dateKey); }}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {allSelected ? (
                                <CheckSquare className="h-3 w-3" />
                              ) : (
                                <Square className="h-3 w-3" />
                              )}
                              {allSelected ? 'All' : 'None'}
                            </button>
                          </button>
                          {expandedDays.has(dateKey) && (
                            <div className="grid grid-cols-3 gap-1 px-2.5 pb-2.5">
                              {ALL_SLOTS.map(slot => {
                                const info = TIME_SLOT_LABELS[slot];
                                const isSelected = slots.has(slot);
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => toggleDaySlot(dateKey, slot)}
                                    className={cn(
                                      "rounded-md px-1.5 py-1 text-center transition-colors border",
                                      isSelected
                                        ? "bg-availability-available-light border-availability-available text-foreground"
                                        : "bg-muted/30 border-transparent text-muted-foreground"
                                    )}
                                  >
                                    <span className="text-[10px] font-medium leading-tight block">{info.label}</span>
                                    <span className="text-[8px] opacity-60 leading-tight block">{info.time}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Priority Friends */}
              {tripDays.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Friends to see
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {isLoadingNearby
                      ? 'Finding friends near your destination...'
                      : suggestedFriendIds !== null && location.trim()
                        ? `${nearbyFriendIds?.length || 0} live${(nearbyFriendIds?.length || 0) === 1 ? 's' : ''} nearby${visitingFriendIds.length > 0 ? ` · ${visitingFriendIds.length} visiting` : ''}`
                        : 'Tag friends you want to hang out with during this trip'
                    }
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
                  {isLoadingNearby && (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching nearby friends...
                    </div>
                  )}
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
                          {nearbyFriendIds?.includes(friend.friendUserId) && (
                            <span className="ml-auto text-[10px] text-primary font-medium">Nearby</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {nearbyFriendIds !== null && !friendSearch.trim() && filteredFriends.length === 0 && !isLoadingNearby && (
                    <p className="text-xs text-muted-foreground italic">
                      No friends found near {location.trim()}. Search above to add any friend.
                    </p>
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
                    {tripDays.length} days · {totalSelectedSlots}/{totalPossibleSlots} slots free
                    {priorityFriendIds.length > 0 && ` · ${priorityFriendIds.length} friend${priorityFriendIds.length > 1 ? 's' : ''} to see`}
                  </p>
                </div>
              )}
            </div>
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
