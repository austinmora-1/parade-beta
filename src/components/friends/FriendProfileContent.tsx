import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageCircle, MapPin, Home, Plane, ChevronDown, CalendarPlus, Calendar, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay } from 'date-fns';
import { TimeSlot, TIME_SLOT_LABELS, ACTIVITY_CONFIG, ActivityType, VIBE_CONFIG, VibeType } from '@/types/planner';
import { useLastHungOut } from '@/hooks/useLastHungOut';
import { SharedVibeHistory } from '@/components/friends/SharedVibeHistory';
import { usePlannerStore } from '@/stores/plannerStore';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon',
  'late-afternoon', 'evening', 'late-night',
];

const SLOT_TO_DB_COL: Record<TimeSlot, string> = {
  'early-morning': 'early_morning',
  'late-morning': 'late_morning',
  'early-afternoon': 'early_afternoon',
  'late-afternoon': 'late_afternoon',
  'evening': 'evening',
  'late-night': 'late_night',
};

interface FriendProfileData {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_vibe: string | null;
  custom_vibe_tags: string[] | null;
  location_status: string | null;
  share_code: string | null;
  cover_photo_url: string | null;
  vibe_gif_url: string | null;
}

interface AvailabilityDay {
  date: string;
  slots: Record<TimeSlot, boolean>;
  location_status: string | null;
  trip_location: string | null;
}

interface SharedPlan {
  id: string;
  title: string;
  activity: string;
  date: string;
  time_slot: string;
  location: string | null;
  notes: string | null;
  owner_name: string | null;
  is_mine: boolean;
}

interface FriendProfileContentProps {
  userId: string;
  showBackButton?: boolean;
  onMessageClick?: () => void;
}

export function FriendProfileContent({ userId, showBackButton = true, onMessageClick }: FriendProfileContentProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { availabilityMap: myAvailabilityMap, plans: myPlans } = usePlannerStore();
  const [profile, setProfile] = useState<FriendProfileData | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [sharedPlans, setSharedPlans] = useState<SharedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [availabilityOpen, setAvailabilityOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [previousOpen, setPreviousOpen] = useState(false);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [quickPlanDate, setQuickPlanDate] = useState<Date | undefined>(undefined);
  const [quickPlanSlot, setQuickPlanSlot] = useState<TimeSlot | undefined>(undefined);

  const friendIds = useMemo(() => [userId], [userId]);
  const lastHungOut = useLastHungOut(friendIds);
  const lastDate = lastHungOut[userId];

  const next7Days = useMemo(() => {
    const days: { date: Date; label: string; dateStr: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      days.push({
        date: d,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(d, 'EEE'),
        dateStr: format(d, 'yyyy-MM-dd'),
      });
    }
    return days;
  }, []);

  const getMySlotStatus = (dateStr: string, slot: TimeSlot): 'free' | 'busy' => {
    const dayDate = next7Days.find(d => d.dateStr === dateStr)?.date;
    if (!dayDate) return 'free';
    const hasPlan = myPlans.some(p => isSameDay(p.date, dayDate) && p.timeSlot === slot);
    if (hasPlan) return 'busy';
    const dayAvail = myAvailabilityMap[format(dayDate, 'yyyy-MM-dd')];
    if (dayAvail && !dayAvail.slots[slot]) return 'busy';
    return 'free';
  };

  const getFriendSlotStatus = (dateStr: string, slot: TimeSlot): 'free' | 'busy' => {
    const dayAvail = availability.find(a => a.date === dateStr);
    if (dayAvail && !dayAvail.slots[slot]) return 'busy';
    return 'free';
  };

  const getMutualStatus = (dateStr: string, slot: TimeSlot): 'both-free' | 'friend-free' | 'me-free' | 'both-busy' => {
    const my = getMySlotStatus(dateStr, slot);
    const friend = getFriendSlotStatus(dateStr, slot);
    if (my === 'free' && friend === 'free') return 'both-free';
    if (my === 'busy' && friend === 'busy') return 'both-busy';
    if (friend === 'free') return 'friend-free';
    return 'me-free';
  };

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: profileData } = await supabase
        .from('public_profiles')
        .select('display_name, avatar_url, bio')
        .eq('user_id', userId)
        .single();

      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('current_vibe, custom_vibe_tags, location_status, share_code, cover_photo_url, vibe_gif_url')
        .eq('user_id', userId)
        .single();

      setProfile({
        display_name: profileData?.display_name || null,
        avatar_url: profileData?.avatar_url || null,
        bio: profileData?.bio || null,
        current_vibe: fullProfile?.current_vibe || null,
        custom_vibe_tags: fullProfile?.custom_vibe_tags || null,
        location_status: fullProfile?.location_status || null,
        share_code: fullProfile?.share_code || null,
        cover_photo_url: (fullProfile as any)?.cover_photo_url || null,
        vibe_gif_url: (fullProfile as any)?.vibe_gif_url || null,
      });

      const today = format(new Date(), 'yyyy-MM-dd');
      const weekOut = format(addDays(new Date(), 6), 'yyyy-MM-dd');

      const { data: availData } = await supabase
        .from('availability')
        .select('date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location')
        .eq('user_id', userId)
        .gte('date', today)
        .lte('date', weekOut)
        .order('date');

      if (availData) {
        const mapped: AvailabilityDay[] = availData.map((row: any) => ({
          date: row.date,
          slots: Object.fromEntries(
            TIME_SLOT_ORDER.map(slot => [slot, row[SLOT_TO_DB_COL[slot]] !== false])
          ) as Record<TimeSlot, boolean>,
          location_status: row.location_status,
          trip_location: row.trip_location,
        }));
        setAvailability(mapped);
      }

      if (user) {
        const { data: myPlansWithFriend } = await supabase
          .from('plan_participants')
          .select('plan_id, plans!inner(id, title, activity, date, time_slot, location, notes, user_id)')
          .eq('friend_id', userId);

        const { data: friendPlansWithMe } = await supabase
          .from('plan_participants')
          .select('plan_id, plans!inner(id, title, activity, date, time_slot, location, notes, user_id)')
          .eq('friend_id', user.id);

        const { data: myParticipations } = await supabase
          .from('plan_participants')
          .select('plan_id')
          .eq('friend_id', user.id);

        const myParticipatedPlanIds = new Set(myParticipations?.map(p => p.plan_id) || []);

        const { data: friendParticipations } = await supabase
          .from('plan_participants')
          .select('plan_id, plans!inner(id, title, activity, date, time_slot, location, notes, user_id)')
          .eq('friend_id', userId);

        const planMap = new Map<string, SharedPlan>();

        myPlansWithFriend?.forEach((pp: any) => {
          const p = pp.plans;
          if (p && p.user_id === user.id) {
            planMap.set(p.id, {
              id: p.id, title: p.title, activity: p.activity,
              date: p.date, time_slot: p.time_slot,
              location: p.location, notes: p.notes,
              owner_name: 'You', is_mine: true,
            });
          }
        });

        friendPlansWithMe?.forEach((pp: any) => {
          const p = pp.plans;
          if (p && p.user_id === userId && !planMap.has(p.id)) {
            planMap.set(p.id, {
              id: p.id, title: p.title, activity: p.activity,
              date: p.date, time_slot: p.time_slot,
              location: p.location, notes: p.notes,
              owner_name: profileData?.display_name || 'Friend', is_mine: false,
            });
          }
        });

        friendParticipations?.forEach((pp: any) => {
          const p = pp.plans;
          if (p && p.user_id !== user.id && p.user_id !== userId && myParticipatedPlanIds.has(p.id) && !planMap.has(p.id)) {
            planMap.set(p.id, {
              id: p.id, title: p.title, activity: p.activity,
              date: p.date, time_slot: p.time_slot,
              location: p.location, notes: p.notes,
              owner_name: 'Group', is_mine: false,
            });
          }
        });

        const slotOrder: Record<string, number> = {
          'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
          'late-afternoon': 3, 'evening': 4, 'late-night': 5,
        };
        setSharedPlans(Array.from(planMap.values()).sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (slotOrder[a.time_slot] ?? 0) - (slotOrder[b.time_slot] ?? 0);
        }));
      }

      setLoading(false);
    };

    fetchData();
  }, [userId, user?.id]);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDaySummary = (dateStr: string) => {
    const dayAvail = availability.find(a => a.date === dateStr);
    if (!dayAvail) return { available: 0, mutual: 0, total: TIME_SLOT_ORDER.length };
    const available = TIME_SLOT_ORDER.filter(s => dayAvail.slots[s]).length;
    const mutual = TIME_SLOT_ORDER.filter(s => getMutualStatus(dateStr, s) === 'both-free').length;
    return { available, mutual, total: TIME_SLOT_ORDER.length };
  };

  const toggleDay = (key: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="animate-fade-in space-y-4 text-center py-12">
        <p className="text-4xl">🔒</p>
        <h2 className="font-display text-lg font-semibold">Profile not available</h2>
        <p className="text-sm text-muted-foreground">This user's profile is private or doesn't exist.</p>
        {showBackButton && (
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        )}
      </div>
    );
  }

  const slotLabels: Record<string, string> = {
    'early-morning': '6-9am', 'late-morning': '9am-12pm',
    'early-afternoon': '12-3pm', 'late-afternoon': '3-6pm',
    'evening': '6-9pm', 'late-night': '9pm+',
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = sharedPlans.filter(p => new Date(p.date) >= startOfToday);
  const previous = sharedPlans.filter(p => new Date(p.date) < startOfToday);

  const renderPlan = (plan: SharedPlan) => {
    const config = ACTIVITY_CONFIG[plan.activity as ActivityType];
    const locationData = plan.location ? (() => {
      try { return JSON.parse(plan.location); } catch { return null; }
    })() : null;
    const locationName = locationData?.name || (typeof plan.location === 'string' ? plan.location : null);
    return (
      <div key={plan.id} onClick={() => navigate(`/plan/${plan.id}`)} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/50 transition-colors cursor-pointer">
        <span className="text-base shrink-0 mt-0.5">{config?.icon || '📅'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{plan.title}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
            <Calendar className="h-2.5 w-2.5 shrink-0" />
            <span>{format(new Date(plan.date), 'EEE, MMM d')}</span>
            <span>·</span>
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span>{slotLabels[plan.time_slot] || plan.time_slot}</span>
          </div>
          {locationName && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{locationName}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {showBackButton && (
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="h-28 md:h-36">
          {profile.cover_photo_url ? (
            <img src={profile.cover_photo_url} alt="Cover photo" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20" />
          )}
        </div>

        <div className="relative px-4 pb-4 md:px-6 md:pb-5">
          <div className="-mt-10 mb-3 md:-mt-12">
            <Avatar
              className="h-20 w-20 border-4 border-background shadow-lg md:h-24 md:w-24 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => setShowAvatarLightbox(true)}
            >
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name || 'User'} />
              <AvatarFallback className="bg-primary/20 text-primary text-lg md:text-xl font-display font-semibold">
                {getInitials(profile.display_name)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold md:text-2xl truncate">
              {profile.display_name || 'User'}
            </h1>
            {profile.bio && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {profile.vibe_gif_url && (
                <div className="w-full mb-1">
                  <img src={profile.vibe_gif_url} alt="Vibe GIF" className="h-20 rounded-lg object-cover" />
                </div>
              )}
              {profile.current_vibe && (() => {
                const isCustom = profile.current_vibe === 'custom';
                const vibeConfig = !isCustom ? VIBE_CONFIG[profile.current_vibe as VibeType] : null;
                const tags = profile.custom_vibe_tags || [];
                return isCustom && tags.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {vibeConfig ? <vibeConfig.icon className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />} {vibeConfig?.label || profile.current_vibe}
                  </span>
                );
              })()}
              {profile.location_status && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {profile.location_status === 'home' ? 'Home' : 'Away'}
                </span>
              )}
              {lastDate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Last hung out {(() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const dateStart = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
                    const diffDays = Math.round((todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays === 0) return 'today';
                    if (diffDays === 1) return 'yesterday';
                    if (diffDays < 7) return `${diffDays} days ago`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
                    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
                    return `${Math.floor(diffDays / 365)}y ago`;
                  })()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 flex-1 text-xs h-8"
          onClick={() => {
            if (onMessageClick) {
              onMessageClick();
            } else if (userId) {
              navigate('/interact');
            }
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Message
        </Button>
        <Button
          variant="default"
          size="sm"
          className="gap-1.5 flex-1 text-xs h-8"
          onClick={() => setQuickPlanOpen(true)}
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Suggest a Plan
        </Button>
      </div>

      {/* Availability - Collapsible */}
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <button
          onClick={() => setAvailabilityOpen(prev => !prev)}
          className="flex w-full items-center justify-between p-4 md:p-6 text-left"
        >
          <h2 className="font-display text-base font-semibold md:text-lg">
            This Week's Availability
          </h2>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            availabilityOpen && "rotate-180"
          )} />
        </button>

        {availabilityOpen && (
          <div className="px-4 pb-4 md:px-6 md:pb-6">
            {availability.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-sm text-muted-foreground">
                  No availability shared for this week
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-availability-available" /> Both free
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-availability-available/30" /> They're free
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/20" /> Unavailable
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {next7Days.map((day) => {
                    const dayAvail = availability.find(a => a.date === day.dateStr);
                    const isToday = isSameDay(day.date, new Date());
                    const isAway = dayAvail?.location_status === 'away';
                    const summary = getDaySummary(day.dateStr);
                    const isExpanded = expandedDays.has(day.dateStr);
                    const mutualScore = summary.mutual / summary.total;
                    const hasData = !!dayAvail;

                    return (
                      <div key={day.dateStr}>
                        <button
                          onClick={() => hasData && toggleDay(day.dateStr)}
                          className={cn(
                            "w-full text-left rounded-lg p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20",
                            hasData && "hover:bg-muted/50",
                            !hasData && "opacity-50 cursor-default",
                            isToday && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={cn("text-xs font-semibold", isToday && "text-primary")}>
                                {day.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {format(day.date, 'd')}
                              </span>
                              {isToday && (
                                <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded-full font-medium">
                                  Today
                                </span>
                              )}
                            </div>
                            {hasData && (
                              <ChevronDown className={cn(
                                "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                                isExpanded && "rotate-180"
                              )} />
                            )}
                          </div>

                          <div className="mt-1.5 flex gap-0.5">
                            {TIME_SLOT_ORDER.map((slot) => {
                              const status = hasData ? getMutualStatus(day.dateStr, slot) : 'both-busy';
                              return (
                                <div
                                  key={slot}
                                  className={cn(
                                    "h-1 flex-1 rounded-full",
                                    status === 'both-free' && "bg-availability-available",
                                    status === 'friend-free' && "bg-availability-available/30",
                                    status === 'me-free' && "bg-availability-available/30",
                                    status === 'both-busy' && "bg-muted-foreground/20"
                                  )}
                                />
                              );
                            })}
                          </div>

                          <div className="mt-1 flex items-center justify-between">
                            <span className={cn(
                              "text-[10px] font-medium",
                              hasData && mutualScore >= 0.5 ? "text-availability-available" : "text-muted-foreground"
                            )}>
                              {hasData ? `${summary.mutual}/${summary.total} mutual` : 'No data'}
                            </span>
                            {hasData && (
                              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                {isAway ? <Plane className="h-2.5 w-2.5 shrink-0" /> : <Home className="h-2.5 w-2.5 shrink-0" />}
                              </div>
                            )}
                          </div>
                        </button>

                        {isExpanded && dayAvail && (
                          <div className="space-y-0.5 animate-fade-in px-0.5 pb-1">
                            {TIME_SLOT_ORDER.map((slot) => {
                              const status = getMutualStatus(day.dateStr, slot);
                              const slotInfo = TIME_SLOT_LABELS[slot];
                              return (
                                <button
                                  key={slot}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (status !== 'both-busy') {
                                      setQuickPlanDate(day.date);
                                      setQuickPlanSlot(slot);
                                      setQuickPlanOpen(true);
                                    }
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors text-left",
                                    status === 'both-free' && "bg-availability-available/20 text-foreground hover:bg-availability-available/30 cursor-pointer",
                                    status === 'friend-free' && "bg-availability-available/10 text-foreground hover:bg-availability-available/20 cursor-pointer",
                                    status === 'me-free' && "bg-muted/30 text-muted-foreground hover:bg-muted/50 cursor-pointer",
                                    status === 'both-busy' && "bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <span className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    status === 'both-free' && "bg-availability-available",
                                    status === 'friend-free' && "bg-availability-available/40",
                                    (status === 'me-free' || status === 'both-busy') && "bg-muted-foreground/40"
                                  )} />
                                  <span className="font-medium truncate">{slotInfo.label}</span>
                                  <span className="text-muted-foreground ml-auto text-[9px] shrink-0">{slotInfo.time}</span>
                                  {status !== 'both-busy' && (
                                    <CalendarPlus className="h-3 w-3 text-muted-foreground/50 shrink-0 ml-0.5" />
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Shared Vibe History */}
      <SharedVibeHistory friendUserId={userId} />

      {/* Upcoming Plans */}
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <button
          onClick={() => setUpcomingOpen(prev => !prev)}
          className="flex w-full items-center justify-between p-4 md:p-6 text-left"
        >
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold md:text-lg">Upcoming Plans</h2>
            {upcoming.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {upcoming.length}
              </span>
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", upcomingOpen && "rotate-180")} />
        </button>
        {upcomingOpen && (
          <div className="px-4 pb-4 md:px-6 md:pb-6">
            {upcoming.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-2xl mb-1">🤝</p>
                <p className="text-xs text-muted-foreground">No upcoming shared plans yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">{upcoming.map(renderPlan)}</div>
            )}
          </div>
        )}
      </div>

      {/* Previous Plans */}
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <button
          onClick={() => setPreviousOpen(prev => !prev)}
          className="flex w-full items-center justify-between p-4 md:p-6 text-left"
        >
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold md:text-lg">Previous Plans</h2>
            {previous.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {previous.length}
              </span>
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", previousOpen && "rotate-180")} />
        </button>
        {previousOpen && (
          <div className="px-4 pb-4 md:px-6 md:pb-6">
            {previous.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-2xl mb-1">📖</p>
                <p className="text-xs text-muted-foreground">No past plans together yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">{previous.map(renderPlan)}</div>
            )}
          </div>
        )}
      </div>

      {/* Avatar Lightbox */}
      <Dialog open={showAvatarLightbox} onOpenChange={setShowAvatarLightbox}>
        <DialogContent className="max-w-xs sm:max-w-sm p-2 bg-background/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 py-2">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name || 'User'}
                className="h-56 w-56 rounded-full object-cover ring-2 ring-border shadow-lg"
              />
            ) : (
              <div className="h-56 w-56 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-border shadow-lg">
                <span className="text-5xl font-display font-semibold text-primary">
                  {getInitials(profile.display_name)}
                </span>
              </div>
            )}
            <p className="font-display font-semibold text-base">{profile.display_name || 'User'}</p>
          </div>
        </DialogContent>
      </Dialog>

      <QuickPlanSheet
        open={quickPlanOpen}
        onOpenChange={(open) => {
          setQuickPlanOpen(open);
          if (!open) {
            setQuickPlanDate(undefined);
            setQuickPlanSlot(undefined);
          }
        }}
        preSelectedFriend={userId ? {
          userId,
          name: profile?.display_name || 'Friend',
          avatar: profile?.avatar_url || undefined,
        } : undefined}
        preSelectedDate={quickPlanDate}
        preSelectedTimeSlot={quickPlanSlot}
      />
    </div>
  );
}
