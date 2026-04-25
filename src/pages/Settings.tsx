import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
import { ElephantLoader } from '@/components/ui/ElephantLoader';
import { User, Bell, MapPin, Share2, LogOut, Loader2, Calendar, Save, Clock, Gamepad2, Sun, Moon, Palette, Globe, Check, Heart, Sparkles, Users, Search, X } from 'lucide-react';
import { ACTIVITY_CONFIG } from '@/types/planner';
import { useAuth } from '@/hooks/useAuth';
import { useFeedback } from '@/components/feedback/FeedbackContext';
import { toast } from 'sonner';
import { CalendarIntegration } from '@/components/settings/CalendarIntegration';
const DeleteAccountDialog = lazy(() => import('@/components/settings/DeleteAccountDialog'));
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { VIBE_CONFIG, VibeType, TimeSlot } from '@/types/planner';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { format, addDays, startOfWeek } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { getTimezoneForCity, getTimezoneAbbreviation } from '@/lib/timezone';
import { TimezoneCombobox } from '@/components/settings/TimezoneCombobox';

import { PushNotificationsToggle } from '@/components/settings/PushNotificationsToggle';

// Helper function for formatting time
const formatTime = (decimalHour: number) => {
  const hours = Math.floor(decimalHour);
  const minutes = Math.round((decimalHour - hours) * 60);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  if (minutes === 0) {
    return `${displayHours}${period}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
};

interface Friend {
  id: string;
  friend_name: string;
  friend_user_id: string | null;
}

export default function Settings() {
  const { signOut, session } = useAuth();
  const { openFeedback } = useFeedback();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [originalUsername, setOriginalUsername] = useState('');

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');

  // Notification settings
  const [planReminders, setPlanReminders] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [planInvitations, setPlanInvitations] = useState(true);

  // Privacy settings
  const [showAvailability, setShowAvailability] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showVibeStatus, setShowVibeStatus] = useState(true);
  
  const [allowAllHangRequests, setAllowAllHangRequests] = useState(true);
  const [allowedFriendIds, setAllowedFriendIds] = useState<string[]>([]);

  // Default Availability settings
  const [workDays, setWorkDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [workStartHour, setWorkStartHour] = useState(9);
  const [workEndHour, setWorkEndHour] = useState(17);
  const [defaultAvailability, setDefaultAvailability] = useState<'free' | 'unavailable'>('free');
  const [timezone, setTimezone] = useState<string>('');

  // Social Circle & Preferences (extended)
  const [preferredSocialTimes, setPreferredSocialTimes] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [socialGoals, setSocialGoals] = useState<string[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<string[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);

  // Friends list
  const [friends, setFriends] = useState<Friend[]>([]);

  // Load profile data on mount
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        setEmail(session.user.email || '');

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
          toast.error("Couldn't load your profile — try refreshing?");
        }

        if (profile) {
          const fullName = profile.display_name || '';
          setDisplayName(fullName);
          setOriginalUsername(fullName);
          setFirstName((profile as any).first_name || '');
          setLastName((profile as any).last_name || '');
          setPhoneNumber((profile as any).phone_number || '');
          setHomeAddress(profile.home_address || '');
          setNeighborhood((profile as any).neighborhood || '');
          setPlanReminders(profile.plan_reminders ?? true);
          setFriendRequests(profile.friend_requests_notifications ?? true);
          setPlanInvitations(profile.plan_invitations_notifications ?? true);
          setShowAvailability(profile.show_availability ?? true);
          setShowLocation(profile.show_location ?? true);
          setShowVibeStatus(profile.show_vibe_status ?? true);
          
          setAllowAllHangRequests(profile.allow_all_hang_requests ?? true);
          setAllowedFriendIds(profile.allowed_hang_request_friend_ids || []);
          // Load default availability settings
          setWorkDays((profile as any).default_work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
          setWorkStartHour((profile as any).default_work_start_hour ?? 9);
          setWorkEndHour((profile as any).default_work_end_hour ?? 17);
          setDefaultAvailability((profile as any).default_availability_status || 'free');
          setTimezone((profile as any).timezone || '');
          setPreferredSocialTimes((profile as any).preferred_social_times || []);
          setInterests((profile as any).interests || []);
          setSocialGoals((profile as any).social_goals || []);
          setCloseFriendIds((profile as any).close_friend_ids || []);
        }

        // Load friends (connected)
        const { data: friendsData } = await supabase
          .from('friendships')
          .select('id, friend_name, friend_user_id')
          .eq('user_id', session.user.id)
          .eq('status', 'connected');

        if (friendsData) {
          setFriends(friendsData);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [session?.user]);

  // Debounced username availability check
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!displayName.trim() || displayName === originalUsername) {
      setUsernameError('');
      setIsCheckingUsername(false);
      return;
    }
    setIsCheckingUsername(true);
    setUsernameError('');
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('check_username_available', {
          p_username: displayName.trim(),
        });
        if (error) throw error;
        if (!data) {
          setUsernameError('This username is already taken');
        } else {
          setUsernameError('');
        }
      } catch (err) {
        console.error('Username check error:', err);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, [displayName, originalUsername]);

  const handleSaveChanges = async () => {
    if (!session?.user) {
      toast.error('Sign in first to save changes');
      return;
    }

    if (usernameError) {
      toast.error('Pick a different username first');
      return;
    }

    setIsSaving(true);
    try {
      // Save profile settings
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          first_name: firstName || null,
          last_name: lastName || null,
          phone_number: phoneNumber || null,
          home_address: homeAddress,
          neighborhood: neighborhood || null,
          plan_reminders: planReminders,
          friend_requests_notifications: friendRequests,
          plan_invitations_notifications: planInvitations,
          show_availability: showAvailability,
          show_location: showLocation,
          show_vibe_status: showVibeStatus,
          
          allow_all_hang_requests: allowAllHangRequests,
          allowed_hang_request_friend_ids: allowedFriendIds,
          // Save default availability settings
          default_work_days: workDays,
          default_work_start_hour: workStartHour,
          default_work_end_hour: workEndHour,
          default_availability_status: defaultAvailability,
          timezone: timezone || null,
          preferred_social_times: preferredSocialTimes,
          interests,
          social_goals: socialGoals,
          close_friend_ids: closeFriendIds,
        } as any)
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Apply work hours to availability for the next 30 days
      await applyWorkHoursToAvailability(session.user.id, workDays, workStartHour, workEndHour);

      // Reload profile and availability to reflect changes
      const { loadProfileAndAvailability } = usePlannerStore.getState();
      await loadProfileAndAvailability();

      toast.success('Saved ✨');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("Couldn't save those — try again?");
    } finally {
      setIsSaving(false);
    }
  };

  // Apply work hours to availability records
  const applyWorkHoursToAvailability = async (
    userId: string, 
    workDaysConfig: string[], 
    startHour: number, 
    endHour: number
  ) => {
    // Time slot hour ranges
    const TIME_SLOT_HOURS: Record<TimeSlot, { start: number; end: number }> = {
      'early-morning': { start: 6, end: 9 },
      'late-morning': { start: 9, end: 12 },
      'early-afternoon': { start: 12, end: 15 },
      'late-afternoon': { start: 15, end: 18 },
      'evening': { start: 18, end: 22 },
      'late-night': { start: 22, end: 26 },
    };

    // Generate dates for next 30 days
    const today = new Date();
    const dates: { date: string; dayOfWeek: string }[] = [];
    
    for (let i = 0; i < 30; i++) {
      const date = addDays(today, i);
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
      dates.push({ date: format(date, 'yyyy-MM-dd'), dayOfWeek });
    }

    // For each work day, upsert availability with work hours marked as unavailable
    const workDayDates = dates.filter(d => workDaysConfig.includes(d.dayOfWeek));
    
    for (const { date } of workDayDates) {
      // Calculate which slots should be unavailable based on work hours
      const updates: Record<string, boolean> = {};
      
      for (const [slot, hours] of Object.entries(TIME_SLOT_HOURS)) {
        const slotColumn = slot.replace('-', '_');
        // Check if this slot overlaps with work hours
        const slotOverlapsWork = hours.start < endHour && hours.end > startHour;
        if (slotOverlapsWork) {
          updates[slotColumn] = false;
        }
      }

      // Only update if there are slots to mark as unavailable
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('availability')
          .upsert({
            user_id: userId,
            date: date,
            ...updates,
          }, { onConflict: 'user_id,date' });
      }
    }
  };

  const handleChange = () => {
    setHasChanges(true);
  };

  const toggleFriendAllowed = (friendId: string) => {
    setAllowedFriendIds(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      }
      return [...prev, friendId];
    });
    handleChange();
  };


  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Logged out successfully');
      navigate('/landing');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <ElephantLoader />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="min-w-0">
          <h1 className="font-display text-base font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
        {hasChanges && (
          <Button 
            onClick={handleSaveChanges} 
            disabled={isSaving} 
            size="sm" 
            className="gap-1.5 h-7 px-2.5 text-xs shrink-0"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {isSaving ? 'Saving' : 'Save'}
          </Button>
        )}
      </div>

      <Accordion type="multiple" defaultValue={[]} className="space-y-1.5">
        {/* Profile Section */}
        <AccordionItem value="profile" className="rounded-xl border border-border bg-card shadow-soft overflow-visible">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Profile</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 overflow-visible">
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="space-y-1">
                <Label htmlFor="firstName" className="text-xs">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); handleChange(); }}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); handleChange(); }}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="username" className="text-xs">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    placeholder="Choose a unique username"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); handleChange(); }}
                    className={cn("h-8 text-sm pr-8", usernameError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {isCheckingUsername && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  {!isCheckingUsername && displayName && displayName !== originalUsername && !usernameError && (
                    <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-availability-available" />
                  )}
                </div>
                {usernameError ? (
                  <p className="text-[10px] text-destructive">{usernameError}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">This is how you appear to friends across Parade</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => { setPhoneNumber(e.target.value); handleChange(); }}
                  className="h-8 text-sm"
                />
              </div>

              {/* Home Base */}
              <div className="space-y-1 sm:col-span-2">
                <Label className="flex items-center gap-1.5 text-xs">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  Home Base
                </Label>
                <CityAutocomplete
                  value={homeAddress}
                  onChange={(value) => { setHomeAddress(value); handleChange(); }}
                  placeholder="Search for your city..."
                  compact
                />
              </div>

              {/* Neighborhood */}
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="neighborhood" className="text-xs">Neighborhood</Label>
                <Input
                  id="neighborhood"
                  placeholder="e.g. Mission District, Williamsburg"
                  value={neighborhood}
                  onChange={(e) => { setNeighborhood(e.target.value); handleChange(); }}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Optional — helps friends find nearby plans</p>
              </div>

              {/* Timezone */}
              <div className="space-y-1 sm:col-span-2">
                <TimezoneCombobox
                  value={timezone || (homeAddress ? getTimezoneForCity(homeAddress) : Intl.DateTimeFormat().resolvedOptions().timeZone)}
                  onChange={(value) => { setTimezone(value); handleChange(); }}
                  isAutoDetected={!timezone}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Social Circle & Preferences */}
        <AccordionItem value="availability" className="rounded-xl border border-border bg-card shadow-soft overflow-visible">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Social Circle & Preferences</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 overflow-visible">
            <Accordion type="multiple" className="space-y-2 pt-1">
              {/* Work Hours */}
              <AccordionItem value="sub-work" className="rounded-lg border border-border/60 bg-muted/20">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/40 text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    Standard Work Hours
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-3 pt-1">
                    <p className="text-[10px] text-muted-foreground">
                      We'll mark you as busy during these times
                    </p>

                    {/* Work Days */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-muted-foreground">Work days</span>
                      <div className="flex gap-1">
                        {[
                          { id: 'monday', label: 'M' },
                          { id: 'tuesday', label: 'T' },
                          { id: 'wednesday', label: 'W' },
                          { id: 'thursday', label: 'T' },
                          { id: 'friday', label: 'F' },
                          { id: 'saturday', label: 'S' },
                          { id: 'sunday', label: 'S' },
                        ].map((day) => {
                          const isSelected = workDays.includes(day.id);
                          return (
                            <button
                              key={day.id}
                              onClick={() => {
                                setWorkDays(prev =>
                                  prev.includes(day.id)
                                    ? prev.filter(d => d !== day.id)
                                    : [...prev, day.id]
                                );
                                handleChange();
                              }}
                              className={cn(
                                "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Sliders */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Start</span>
                          <span className="text-[10px] font-bold text-primary">{formatTime(workStartHour)}</span>
                        </div>
                        <Slider
                          value={[workStartHour]}
                          onValueChange={([value]) => { setWorkStartHour(value); handleChange(); }}
                          min={5}
                          max={12}
                          step={0.25}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">End</span>
                          <span className="text-[10px] font-bold text-primary">{formatTime(workEndHour)}</span>
                        </div>
                        <Slider
                          value={[workEndHour]}
                          onValueChange={([value]) => { setWorkEndHour(value); handleChange(); }}
                          min={14}
                          max={22}
                          step={0.25}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Preferred Social Times */}
              <AccordionItem value="sub-social-times" className="rounded-lg border border-border/60 bg-muted/20">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/40 text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    Preferred Social Times
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-3 pt-1">
                    {/* Default Availability Status */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Default Status</Label>
                      <p className="text-[10px] text-muted-foreground">Are you generally free or busy by default?</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setDefaultAvailability('free'); handleChange(); }}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                            defaultAvailability === 'free'
                              ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          ✓ Free
                        </button>
                        <button
                          onClick={() => { setDefaultAvailability('unavailable'); handleChange(); }}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                            defaultAvailability === 'unavailable'
                              ? "bg-destructive/20 text-destructive ring-1 ring-destructive/30"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          ✗ Busy
                        </button>
                      </div>
                    </div>

                    <Separator />

                    <p className="text-[10px] text-muted-foreground">Pick the slots you most enjoy hanging out</p>

                    {/* Quick select presets */}
                    {(() => {
                      const WEEKDAYS = ['monday','tuesday','wednesday','thursday','friday'];
                      const WEEKENDS = ['saturday','sunday'];
                      const ALL_DAYS = [...WEEKDAYS, ...WEEKENDS];
                      const presets: { id: string; label: string; keys: string[] }[] = [
                        { id: 'we-aft', label: 'Weekend afternoons', keys: WEEKENDS.map(d => `${d}:afternoon`) },
                        { id: 'we-eve', label: 'Weekend evenings', keys: WEEKENDS.map(d => `${d}:evening`) },
                        { id: 'wd-eve', label: 'Weekday evenings', keys: WEEKDAYS.map(d => `${d}:evening`) },
                        { id: 'wd-am', label: 'Weekday mornings', keys: WEEKDAYS.map(d => `${d}:morning`) },
                        { id: 'late', label: 'Late nights', keys: ALL_DAYS.map(d => `${d}:late-night`) },
                        { id: 'we-all', label: 'All weekend', keys: WEEKENDS.flatMap(d => ['morning','afternoon','evening','late-night'].map(s => `${d}:${s}`)) },
                      ];
                      const isPresetActive = (keys: string[]) => keys.every(k => preferredSocialTimes.includes(k));
                      return (
                        <div className="flex flex-wrap gap-1.5">
                          {presets.map((p) => {
                            const active = isPresetActive(p.keys);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setPreferredSocialTimes(prev => {
                                    if (active) {
                                      return prev.filter(k => !p.keys.includes(k));
                                    }
                                    const next = new Set(prev);
                                    p.keys.forEach(k => next.add(k));
                                    return Array.from(next);
                                  });
                                  handleChange();
                                }}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ring-1',
                                  active
                                    ? 'bg-primary/15 text-primary ring-primary/30'
                                    : 'bg-muted/50 text-muted-foreground ring-transparent hover:bg-muted'
                                )}
                              >
                                {active ? '✓ ' : '+ '}{p.label}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted/20 border-b border-border">
                        <div />
                        {[
                          { id: 'monday', label: 'M' },
                          { id: 'tuesday', label: 'T' },
                          { id: 'wednesday', label: 'W' },
                          { id: 'thursday', label: 'T' },
                          { id: 'friday', label: 'F' },
                          { id: 'saturday', label: 'S' },
                          { id: 'sunday', label: 'S' },
                        ].map((day) => (
                          <div key={day.id} className="py-1.5 text-center text-[10px] font-semibold text-muted-foreground">
                            {day.label}
                          </div>
                        ))}
                      </div>
                      {[
                        { id: 'morning', label: '🌅 AM', sublabel: '6–12' },
                        { id: 'afternoon', label: '☀️ PM', sublabel: '12–5' },
                        { id: 'evening', label: '🌙 Eve', sublabel: '5–10' },
                        { id: 'late-night', label: '🦉 Late', sublabel: '10+' },
                      ].map((slot, slotIdx, slots) => (
                        <div
                          key={slot.id}
                          className={cn(
                            'grid grid-cols-[60px_repeat(7,1fr)] items-center',
                            slotIdx < slots.length - 1 && 'border-b border-border/40'
                          )}
                        >
                          <div className="px-1 py-1">
                            <div className="text-[10px] font-medium leading-tight">{slot.label}</div>
                            <div className="text-[8px] text-muted-foreground leading-tight">{slot.sublabel}</div>
                          </div>
                          {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map((day) => {
                            const key = `${day}:${slot.id}`;
                            const isSelected = preferredSocialTimes.includes(key);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  setPreferredSocialTimes(prev =>
                                    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                                  );
                                  handleChange();
                                }}
                                className={cn(
                                  'flex items-center justify-center py-1.5 text-[11px] border-l border-border/20 transition-all',
                                  isSelected
                                    ? 'bg-accent/40 text-accent-foreground'
                                    : 'text-muted-foreground/30 hover:bg-muted/50 hover:text-muted-foreground'
                                )}
                              >
                                {isSelected ? '✓' : '·'}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Favorite Activities / Interests */}
              <AccordionItem value="sub-activities" className="rounded-lg border border-border/60 bg-muted/20 overflow-visible">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/40 text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <Gamepad2 className="h-3 w-3 text-muted-foreground" />
                    Favorite Activities
                    {interests.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">({interests.length})</span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 overflow-visible">
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-muted-foreground">Search and add activities you love</p>

                    {/* Search input with dropdown */}
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          type="text"
                          value={activitySearch}
                          onChange={(e) => {
                            setActivitySearch(e.target.value);
                            setActivitySearchOpen(true);
                          }}
                          onFocus={() => setActivitySearchOpen(true)}
                          onBlur={() => setTimeout(() => setActivitySearchOpen(false), 150)}
                          placeholder="Search activities..."
                          className="h-9 pl-8 text-xs"
                        />
                      </div>
                      {activitySearchOpen && (() => {
                        const matches = Object.entries(ACTIVITY_CONFIG)
                          .filter(([id]) => id !== 'custom')
                          .map(([id, config]: any) => ({ id, display: `${config.icon} ${config.label}`, label: config.label }))
                          .filter(o => !interests.includes(o.display))
                          .filter(o => o.label.toLowerCase().includes(activitySearch.toLowerCase()));
                        if (matches.length === 0) return null;
                        return (
                          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                            {matches.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setInterests(prev => [...prev, o.display]);
                                  setActivitySearch('');
                                  setActivitySearchOpen(false);
                                  handleChange();
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                              >
                                {o.display}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Selected tags */}
                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {interests.map((display) => (
                          <span
                            key={display}
                            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[11px] font-medium bg-primary/15 text-primary ring-1 ring-primary/30"
                          >
                            {display}
                            <button
                              type="button"
                              onClick={() => {
                                setInterests(prev => prev.filter(i => i !== display));
                                handleChange();
                              }}
                              className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                              aria-label={`Remove ${display}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Social Goals */}
              <AccordionItem value="sub-goals" className="rounded-lg border border-border/60 bg-muted/20">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/40 text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                    Social Goals
                    {socialGoals.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">({socialGoals.length})</span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-muted-foreground">What are you trying to do more of?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'stay_connected', label: 'Stay connected' },
                        { id: 'try_new_things', label: 'Try new things' },
                        { id: 'be_more_social', label: 'Be more social' },
                        { id: 'less_flaking', label: 'Follow through' },
                        { id: 'work_life_balance', label: 'Work-life balance' },
                        { id: 'meet_new_people', label: 'Meet new people' },
                      ].map((goal) => {
                        const isSelected = socialGoals.includes(goal.id);
                        return (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => {
                              setSocialGoals(prev =>
                                prev.includes(goal.id) ? prev.filter(g => g !== goal.id) : [...prev, goal.id]
                              );
                              handleChange();
                            }}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ring-1',
                              isSelected
                                ? 'bg-accent/30 text-accent-foreground ring-accent/40'
                                : 'bg-muted/50 text-muted-foreground ring-transparent hover:bg-muted'
                            )}
                          >
                            {goal.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Close Friends */}
              <AccordionItem value="sub-close-friends" className="rounded-lg border border-border/60 bg-muted/20">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/40 text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-3 w-3 text-primary" />
                    Close Friends
                    {closeFriendIds.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">({closeFriendIds.length})</span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-muted-foreground">
                      Your inner circle — we'll prioritize them in suggestions and nudges
                    </p>
                    {friends.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic pt-1">
                        Connect with friends first to mark close friends.
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto pt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {friends.map((friend) => {
                            const isSelected = closeFriendIds.includes(friend.id);
                            return (
                              <button
                                key={friend.id}
                                type="button"
                                onClick={() => {
                                  setCloseFriendIds(prev =>
                                    prev.includes(friend.id)
                                      ? prev.filter(id => id !== friend.id)
                                      : [...prev, friend.id]
                                  );
                                  handleChange();
                                }}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                                  isSelected
                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                                )}
                              >
                                {isSelected && <Heart className="h-2.5 w-2.5 fill-primary text-primary" />}
                                <span className="truncate max-w-[140px]">{friend.friend_name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <AccordionItem value="notifications" className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Notifications</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3">
            <PushNotificationsToggle />
            <Separator className="my-2" />
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Plan Reminders</p>
                  <p className="text-[10px] text-muted-foreground">Get notified before your plans</p>
                </div>
                <Switch
                  checked={planReminders}
                  onCheckedChange={(checked) => { setPlanReminders(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Friend Requests</p>
                  <p className="text-[10px] text-muted-foreground">Notify when someone wants to connect</p>
                </div>
                <Switch
                  checked={friendRequests}
                  onCheckedChange={(checked) => { setFriendRequests(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Plan Invitations</p>
                  <p className="text-[10px] text-muted-foreground">Notify when you're invited to a plan</p>
                </div>
                <Switch
                  checked={planInvitations}
                  onCheckedChange={(checked) => { setPlanInvitations(checked); handleChange(); }}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Calendar Integration */}
        <AccordionItem value="calendar" className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Calendar</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3">
            <div className="pt-1">
              <CalendarIntegration isEmbedded />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Sharing & Privacy */}
        <AccordionItem value="privacy" className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Sharing & Privacy</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3">
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Show Availability</p>
                  <p className="text-[10px] text-muted-foreground">Let friends see your availability</p>
                </div>
                <Switch
                  checked={showAvailability}
                  onCheckedChange={(checked) => { setShowAvailability(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Show Location</p>
                  <p className="text-[10px] text-muted-foreground">Let friends know if you're home or away</p>
                </div>
                <Switch
                  checked={showLocation}
                  onCheckedChange={(checked) => { setShowLocation(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Show Vibe</p>
                  <p className="text-[10px] text-muted-foreground">Display your current vibe</p>
                </div>
                <Switch
                  checked={showVibeStatus}
                  onCheckedChange={(checked) => { setShowVibeStatus(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">Hangout Requests</p>
                    <p className="text-[10px] text-muted-foreground">
                      {allowAllHangRequests ? 'All friends can request' : 'Only selected friends'}
                    </p>
                  </div>
                  <Switch
                    checked={allowAllHangRequests}
                    onCheckedChange={(checked) => { setAllowAllHangRequests(checked); handleChange(); }}
                  />
                </div>
                <AnimatePresence>
                  {!allowAllHangRequests && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs font-medium mb-2">Select friends:</p>
                        {friends.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">No connected friends yet.</p>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {friends.map((friend) => (
                              <div
                                key={friend.id}
                                className="flex items-center gap-2 rounded-md border border-border p-2 hover:bg-muted/50 transition-colors"
                              >
                                <Checkbox
                                  id={`friend-${friend.id}`}
                                  checked={allowedFriendIds.includes(friend.id)}
                                  onCheckedChange={() => toggleFriendAllowed(friend.id)}
                                />
                                <Label htmlFor={`friend-${friend.id}`} className="flex-1 cursor-pointer font-normal text-xs">
                                  {friend.friend_name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>


        {/* Account / Logout */}
        <AccordionItem value="account" className="rounded-xl border border-destructive/20 bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-destructive" />
              <span className="font-display text-sm font-semibold">Account</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3 space-y-3">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">Sign Out</p>
                <p className="text-[10px] text-muted-foreground">Log out of your Parade account</p>
              </div>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive">Delete Account</p>
                <p className="text-[10px] text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <Suspense fallback={null}>
                <DeleteAccountDialog />
              </Suspense>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col items-center gap-2 pt-2 pb-4">
        <div className="flex justify-center gap-4">
          <a href="/privacy" className="text-xs text-muted-foreground hover:text-primary hover:underline">Privacy Policy</a>
          <span className="text-xs text-muted-foreground">·</span>
          <a href="/terms" className="text-xs text-muted-foreground hover:text-primary hover:underline">Terms of Service</a>
        </div>
        <button
          onClick={openFeedback}
          className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
        >
          💬 Let us know what you think!
        </button>
        <button
          onClick={() => {
            import('@/components/onboarding/ParadeTour').then(({ startParadeTour }) => startParadeTour());
          }}
          className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
        >
          ✨ Take the tour
        </button>
      </div>
    </div>
  );
}
