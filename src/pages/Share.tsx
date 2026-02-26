import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { format, addDays, addWeeks, startOfWeek, isSameDay, isToday, isSameWeek } from 'date-fns';
import { Sparkles, Calendar, Home, Building2, Car, Loader2, Clock, MapPin, Send, X, ChevronLeft, ChevronRight, ChevronDown, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { TIME_SLOT_LABELS, TimeSlot, VIBE_CONFIG, VibeType, ACTIVITY_CONFIG } from '@/types/planner';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  current_vibe: string | null;
  custom_vibe_tags: string[] | null;
  location_status: string | null;
}

interface AvailabilityData {
  date: string;
  early_morning: boolean | null;
  late_morning: boolean | null;
  early_afternoon: boolean | null;
  late_afternoon: boolean | null;
  evening: boolean | null;
  late_night: boolean | null;
  location_status: string | null;
  trip_location: string | null;
}

interface PlanData {
  id: string;
  title: string;
  activity: string;
  date: string;
  time_slot: string;
  duration: number;
  location: string | null;
}

interface SelectedSlot {
  day: Date;
  dayLabel: string;
  slot: TimeSlot;
  slotLabel: string;
}

const LOCATION_CONFIG = {
  home: { label: 'At Home', icon: Home, color: 'text-blue-500' },
  office: { label: 'At Office', icon: Building2, color: 'text-purple-500' },
  traveling: { label: 'Traveling', icon: Car, color: 'text-orange-500' },
};

export default function Share() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData[]>([]);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Hang request state
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  
  // Week navigation state — max offset depends on view param
  const viewParam = searchParams.get('view') || '1w';
  const maxWeekOffset = viewParam === '3m' ? 12 : viewParam === '1m' ? 4 : 0;
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleDay = (key: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Get week days based on offset (Monday to Sunday)
  const weekDays = useMemo(() => {
    const start = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekOffset]);
  
  const isCurrentWeek = isSameWeek(weekDays[0], new Date(), { weekStartsOn: 1 });

  useEffect(() => {
    const fetchData = async () => {
      if (!shareCode) {
        setError('No share code specified');
        setLoading(false);
        return;
      }

      try {
        // Fetch profile by share_code
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, current_vibe, custom_vibe_tags, location_status')
          .eq('share_code', shareCode)
          .single();

        if (profileError || !profileData) {
          setError('This share link is not valid');
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Fetch availability for the week
        const startDate = format(weekDays[0], 'yyyy-MM-dd');
        const endDate = format(weekDays[6], 'yyyy-MM-dd');

        const { data: availData } = await supabase
          .from('availability')
          .select('date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location')
          .eq('user_id', profileData.user_id)
          .gte('date', startDate)
          .lte('date', endDate);

        setAvailability(availData || []);

        // Fetch plans for the week
        const { data: plansData } = await supabase
          .from('plans')
          .select('id, title, activity, date, time_slot, duration, location')
          .eq('user_id', profileData.user_id)
          .gte('date', weekDays[0].toISOString())
          .lte('date', weekDays[6].toISOString())
          .order('date', { ascending: true });

        setPlans(plansData || []);
      } catch (err) {
        console.error('Error fetching share data:', err);
        setError('Failed to load availability');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shareCode, weekDays]);

  const getSlotStatus = (date: Date, slot: TimeSlot): 'available' | 'busy' | 'plan' => {
    // Check if there's a plan during this slot
    const hasPlan = plans.some(
      (p) => isSameDay(new Date(p.date), date) && p.time_slot === slot
    );
    
    if (hasPlan) return 'plan';
    
    // Check availability setting
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = availability.find((a) => a.date === dateStr);
    
    if (!dayAvail) return 'available'; // Default to available
    
    const slotMap: Record<TimeSlot, keyof AvailabilityData> = {
      'early-morning': 'early_morning',
      'late-morning': 'late_morning',
      'early-afternoon': 'early_afternoon',
      'late-afternoon': 'late_afternoon',
      'evening': 'evening',
      'late-night': 'late_night',
    };
    
    return dayAvail[slotMap[slot]] === false ? 'busy' : 'available';
  };

  const getDayAvailabilityScore = (date: Date): number => {
    const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
    const availableSlots = slots.filter(
      (slot) => getSlotStatus(date, slot) === 'available'
    ).length;
    return availableSlots / slots.length;
  };

  const handleSlotClick = (day: Date, slot: TimeSlot) => {
    setSelectedSlot({
      day,
      dayLabel: format(day, 'EEEE, MMM d'),
      slot,
      slotLabel: TIME_SLOT_LABELS[slot].label,
    });
    setRequestDialogOpen(true);
  };

  const handleSendRequest = async () => {
    if (!requesterName.trim() || !selectedSlot || !shareCode) {
      toast.error('Please enter your name');
      return;
    }

    setSendingRequest(true);

    try {
      const response = await supabase.functions.invoke('send-hang-request', {
        body: {
          shareCode,
          requesterName: requesterName.trim(),
          requesterEmail: requesterEmail.trim() || undefined,
          message: requestMessage.trim() || undefined,
          selectedDay: format(selectedSlot.day, 'yyyy-MM-dd'),
          selectedDayLabel: selectedSlot.dayLabel,
          selectedSlot: selectedSlot.slot,
          selectedSlotLabel: selectedSlot.slotLabel,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send request');
      }

      toast.success(`Request sent to ${profile?.display_name || 'user'}!`, {
        description: "They'll get an email with your request.",
      });
      
      setRequestDialogOpen(false);
      setRequesterName('');
      setRequesterEmail('');
      setRequestMessage('');
      setSelectedSlot(null);
    } catch (err) {
      console.error('Error sending hang request:', err);
      toast.error('Failed to send request', {
        description: 'Please try again later.',
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const getPlansForDay = (date: Date): PlanData[] => {
    return plans.filter((p) => isSameDay(new Date(p.date), date));
  };

  // Get upcoming plans (today and future)
  const upcomingPlans = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return plans
      .filter((p) => new Date(p.date) >= today)
      .slice(0, 5);
  }, [plans]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="rounded-2xl bg-card p-8 text-center shadow-lg">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {error || 'User not found'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            This availability page is not available.
          </p>
          {!user && (
            <Link
              to="/landing"
              className="mt-6 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get Parade
            </Link>
          )}
        </div>
      </div>
    );
  }

  const locationConfig = profile.location_status
    ? LOCATION_CONFIG[profile.location_status as keyof typeof LOCATION_CONFIG]
    : null;
  const LocationIcon = locationConfig?.icon;

  const vibeConfig = profile.current_vibe
    ? VIBE_CONFIG[profile.current_vibe as VibeType]
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <ParadeWordmark size="md" />
          {!user && (
            <Link
              to="/landing"
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get Parade
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Profile Card */}
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-primary/10">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || 'User'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                  {(profile.display_name || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">
                {(profile.display_name?.split(' ')[0]) || 'User'}'s Week
              </h1>
              <p className="text-sm text-muted-foreground">See what I'm up to!</p>
            </div>
          </div>

          {/* Status Row */}
          {(locationConfig || vibeConfig || (profile.current_vibe === 'custom' && profile.custom_vibe_tags?.length)) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Location Status */}
              {locationConfig && LocationIcon && (
                <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                  <LocationIcon className={cn('h-3.5 w-3.5', locationConfig.color)} />
                  <span className="text-xs font-medium">{locationConfig.label}</span>
                </div>
              )}

              {/* Vibe Status */}
              {vibeConfig && (
                <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                  <span className="text-sm">{vibeConfig.icon}</span>
                  <span className="text-xs font-medium">{vibeConfig.label}</span>
                </div>
              )}

              {/* Custom Vibe Tags */}
              {profile.current_vibe === 'custom' &&
                profile.custom_vibe_tags?.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 px-2.5 py-1"
                  >
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium">#{tag}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Week Overview — matching dashboard style */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setWeekOffset(prev => prev - 1)}
                disabled={weekOffset <= 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium min-w-[80px] text-center text-muted-foreground">
                {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d')}`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setWeekOffset(prev => prev + 1)}
                disabled={weekOffset >= maxWeekOffset}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isCurrentWeek && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary h-6 px-2"
                  onClick={() => setWeekOffset(0)}
                >
                  ← Back to this week
                </Button>
              )}
            </div>
            {isCurrentWeek && (
              <span className="text-xs text-muted-foreground">
                {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {weekDays.map((day) => {
              const key = day.toISOString();
              const isTodayDay = isToday(day);
              const isPastDay = day < new Date(new Date().setHours(0, 0, 0, 0));
              const dayPlans = getPlansForDay(day);
              const summary = (() => {
                const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
                const available = slots.filter(s => getSlotStatus(day, s) === 'available').length;
                const planCount = slots.filter(s => getSlotStatus(day, s) === 'plan').length;
                return { available, planCount, total: slots.length };
              })();
              const score = summary.available / summary.total;
              const isExpanded = expandedDays.has(key);

              return (
                <div key={key} className={cn(isPastDay && "opacity-50")}>
                  <button
                    onClick={() => !isPastDay && toggleDay(key)}
                    disabled={isPastDay}
                    className={cn(
                      "w-full text-left rounded-lg p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20",
                      !isPastDay && "hover:bg-muted/50",
                      isPastDay && "cursor-default",
                      isTodayDay && "bg-primary/10 ring-2 ring-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn(
                          "text-xs font-semibold",
                          isTodayDay && "text-primary"
                        )}>
                          {format(day, 'EEE')}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {format(day, 'd')}
                        </span>
                        {isTodayDay && (
                          <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded-full font-medium">
                            Today
                          </span>
                        )}
                      </div>
                      {!isPastDay && (
                        <ChevronDown className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                          isExpanded && "rotate-180"
                        )} />
                      )}
                    </div>

                    {/* Slot density bars */}
                    <div className="mt-1.5 flex gap-0.5">
                      {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => {
                        const status = getSlotStatus(day, slot);
                        return (
                          <div
                            key={slot}
                            className={cn(
                              "h-1 flex-1 rounded-full",
                              status === 'available' && "bg-availability-available/60",
                              status === 'plan' && "bg-primary/60",
                              status === 'busy' && "bg-muted-foreground/20"
                            )}
                          />
                        );
                      })}
                    </div>

                    <div className="mt-1 flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-medium",
                        score >= 0.5 ? "text-availability-available" : "text-muted-foreground"
                      )}>
                        {summary.available}/{summary.total} free
                        {summary.planCount > 0 && ` · ${summary.planCount} ${summary.planCount === 1 ? 'plan' : 'plans'}`}
                      </span>
                      {(() => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayAvail = availability.find(a => a.date === dateStr);
                        const isAway = dayAvail?.location_status === 'away';
                        return (
                          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            {isAway ? (
                              <>
                                <Plane className="h-2.5 w-2.5 shrink-0" />
                                {dayAvail?.trip_location && (
                                  <span className="truncate max-w-[60px]">{dayAvail.trip_location}</span>
                                )}
                              </>
                            ) : (
                              <Home className="h-2.5 w-2.5 shrink-0" />
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </button>

                  {/* Expanded slot details — tappable for hang requests */}
                  {isExpanded && !isPastDay && (
                    <div className="space-y-0.5 animate-fade-in px-0.5 pb-1">
                      {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => {
                        const status = getSlotStatus(day, slot);
                        const isAvailable = status === 'available';
                        const slotInfo = TIME_SLOT_LABELS[slot];
                        const slotPlans = dayPlans.filter(p => p.time_slot === slot);

                        return (
                          <button
                            key={slot}
                            disabled={!isAvailable}
                            onClick={() => isAvailable && handleSlotClick(day, slot)}
                            className={cn(
                              "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors text-left",
                              isAvailable && "bg-availability-available/20 text-foreground hover:bg-availability-available/30 cursor-pointer",
                              status === 'plan' && "bg-muted/60 text-foreground cursor-not-allowed",
                              status === 'busy' && "bg-muted/30 text-muted-foreground cursor-not-allowed"
                            )}
                          >
                            <span className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              isAvailable && "bg-availability-available",
                              status === 'plan' && "bg-primary",
                              status === 'busy' && "bg-muted-foreground/40"
                            )} />
                            <span className="font-medium truncate">
                              {slotInfo.label}
                            </span>
                            <span className="text-muted-foreground ml-auto text-[9px] shrink-0">
                              {slotInfo.time}
                            </span>
                            {slotPlans.length > 0 && (
                              <span className="shrink-0 text-[9px]">
                                {(() => {
                                  const cfg = ACTIVITY_CONFIG[slotPlans[0].activity as keyof typeof ACTIVITY_CONFIG];
                                  return cfg?.icon || '📅';
                                })()}
                              </span>
                            )}
                            {isAvailable && (
                              <Send className="h-2.5 w-2.5 shrink-0 text-availability-available/60" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/50 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-4 rounded-full bg-availability-available/60" />
              <span className="text-muted-foreground">Free — tap to request</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-4 rounded-full bg-muted-foreground/20" />
              <span className="text-muted-foreground">Busy</span>
            </div>
          </div>
        </div>


        {/* CTA */}
        {!user && (
          <div className="text-center pt-2">
            <p className="mb-3 text-sm text-muted-foreground">
              Want to share your own availability with friends?
            </p>
            <Link
              to="/landing"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-medium text-primary-foreground shadow-md hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" />
              Get Parade - It's Free!
            </Link>
          </div>
        )}
      </main>

      {/* Hang Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Request to Hang 🎉</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Selected time display */}
            {selectedSlot && (
              <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{selectedSlot.dayLabel}</p>
                  <p className="text-sm text-muted-foreground">{selectedSlot.slotLabel}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="requester-name">Your Name *</Label>
              <Input
                id="requester-name"
                placeholder="What's your name?"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="requester-email">Your Email (optional)</Label>
              <Input
                id="requester-email"
                type="email"
                placeholder="So they can reply to you"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="request-message">Message (optional)</Label>
              <Textarea
                id="request-message"
                placeholder="What do you want to do?"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
              />
            </div>
            
            <Button 
              onClick={handleSendRequest} 
              disabled={!requesterName.trim() || sendingRequest}
              className="w-full gap-2"
            >
              {sendingRequest ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Request to {profile?.display_name || 'User'}
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              They'll receive an email with your request
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
