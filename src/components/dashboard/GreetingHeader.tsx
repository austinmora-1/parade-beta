import { useMemo, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { Sun, Moon, Sunset, Coffee, MapPin, Plus, CalendarPlus, Plane, UserPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { getTimezoneForCity } from '@/lib/timezone';
import { formatCityForDisplay } from '@/lib/formatCity';
import { useTheme } from 'next-themes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { toast } from 'sonner';

const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));
const GuidedTripSheet = lazy(() => import('@/components/trips/GuidedTripSheet'));
const InviteFriendDialog = lazy(() => import('@/components/friends/InviteFriendDialog'));

function getGreetingConfig(hour: number) {
  if (hour >= 5 && hour < 12) return {
    greeting: 'Good morning', icon: Coffee, emoji: '☀️',
    lightGradient: 'linear-gradient(135deg, rgba(251,191,36,0.35) 0%, rgba(251,146,60,0.25) 40%, rgba(244,114,182,0.15) 100%)',
    darkGradient: 'linear-gradient(135deg, rgba(14,116,144,0.3) 0%, rgba(30,64,175,0.2) 50%, rgba(20,184,166,0.15) 100%)',
  };
  if (hour >= 12 && hour < 17) return {
    greeting: 'Good afternoon', icon: Sun, emoji: '🌤️',
    lightGradient: 'linear-gradient(135deg, rgba(56,189,248,0.3) 0%, rgba(34,211,238,0.2) 40%, rgba(52,211,153,0.18) 100%)',
    darkGradient: 'linear-gradient(135deg, rgba(30,58,138,0.3) 0%, rgba(22,78,99,0.2) 50%, rgba(6,78,59,0.15) 100%)',
  };
  if (hour >= 17 && hour < 21) return {
    greeting: 'Good evening', icon: Sunset, emoji: '🌅',
    lightGradient: 'linear-gradient(135deg, rgba(251,146,60,0.35) 0%, rgba(244,114,182,0.25) 40%, rgba(167,139,250,0.18) 100%)',
    darkGradient: 'linear-gradient(135deg, rgba(49,46,129,0.3) 0%, rgba(88,28,135,0.2) 50%, rgba(30,41,59,0.15) 100%)',
  };
  return {
    greeting: 'Night owl mode', icon: Moon, emoji: '🌙',
    lightGradient: 'linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(129,140,248,0.22) 45%, rgba(96,165,250,0.15) 100%)',
    darkGradient: 'linear-gradient(135deg, rgba(15,23,42,0.35) 0%, rgba(30,27,75,0.25) 50%, rgba(76,29,149,0.15) 100%)',
  };
}

function getContextMessage(planCount: number, friendCount: number, hour: number): string {
  if (friendCount > 0 && hour < 12) return 'What are we getting into today?';
  if (hour >= 17) return 'Any plans tonight?';
  if (hour >= 12) return "What's the move?";
  return 'Ready to make some plans?';
}

const menuItems = [
  { key: 'plan', label: 'Create a Plan', icon: CalendarPlus },
  { key: 'trip', label: 'Create a Trip', icon: Plane },
  { key: 'invite', label: 'Invite Friends', icon: UserPlus },
] as const;

export function GreetingHeader() {
  const { profile, updateProfile } = useCurrentUserProfile();
  const { plans, friends, availabilityMap, userTimezone } = usePlannerStore();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
  const [saveAsHome, setSaveAsHome] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const config = useMemo(() => {
    const hour = new Date().getHours();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2);
    const upcomingCount = plans.filter(p => p.date >= today && p.date < tomorrow).length;
    const connectedFriends = friends.filter(f => f.status === 'connected').length;
    const greetConfig = getGreetingConfig(hour);
    const context = getContextMessage(upcomingCount, connectedFriends, hour);
    return { ...greetConfig, context };
  }, [plans, friends]);

  const { currentCity, needsLocation } = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const todayAvail = availabilityMap[todayKey];
    if (todayAvail?.locationStatus === 'away' && todayAvail?.tripLocation) {
      return {
        currentCity: formatCityForDisplay(todayAvail.tripLocation) || todayAvail.tripLocation.split(',')[0],
        needsLocation: false,
      };
    }
    const homeAddress = profile?.home_address;
    if (!homeAddress) return { currentCity: 'Set location', needsLocation: true };
    return {
      currentCity: formatCityForDisplay(homeAddress) || homeAddress.split(',')[0],
      needsLocation: false,
    };
  }, [availabilityMap, profile?.home_address]);

  const handleSelect = (key: string) => {
    setMenuOpen(false);
    if (key === 'plan') setPlanOpen(true);
    else if (key === 'trip') setTripOpen(true);
    else if (key === 'invite') setInviteOpen(true);
  };

  const handleSaveLocation = async () => {
    const trimmed = locationDraft.trim();
    if (!trimmed || !user?.id) return;
    setSavingLocation(true);
    try {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const tz = getTimezoneForCity(trimmed) || profile?.timezone || null;

      // 1. Always: set today's current location via availability upsert
      const { error: availErr } = await supabase
        .from('availability')
        .upsert(
          {
            user_id: user.id,
            date: todayKey,
            location_status: 'away',
            trip_location: trimmed,
          },
          { onConflict: 'user_id,date' }
        );
      if (availErr) throw availErr;

      // Patch local availability store so today's banner reflects new location immediately
      const availStore = useAvailabilityStore.getState();
      const { availability, availabilityMap } = availStore;
      const existing = availabilityMap[todayKey];
      if (existing) {
        const updated = { ...existing, locationStatus: 'away' as const, tripLocation: trimmed };
        availStore._setAvailability({
          availability: availability.map(a => format(a.date, 'yyyy-MM-dd') === todayKey ? updated : a),
          availabilityMap: { ...availabilityMap, [todayKey]: updated },
          locationStatus: 'away',
        } as any);
      }

      // 2. Optional: persist as home base
      if (saveAsHome) {
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ home_address: trimmed, ...(tz ? { timezone: tz } : {}) })
          .eq('user_id', user.id);
        if (profErr) throw profErr;
        updateProfile({ home_address: trimmed, ...(tz ? { timezone: tz } : {}) });
      }

      toast.success(saveAsHome ? 'Location saved as home' : 'Current location set');
      setLocationOpen(false);
      setLocationDraft('');
      setSaveAsHome(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save location');
    } finally {
      setSavingLocation(false);
    }
  };

  const Icon = config.icon;

  return (
    <>
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl w-full"
        >
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: resolvedTheme === 'dark'
                ? config.darkGradient
                : config.lightGradient,
            }}
          />

          <div className="relative px-4 py-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display text-foreground">
                {config.greeting}
              </h2>
              {needsLocation ? (
                <Popover open={locationOpen} onOpenChange={(o) => { setLocationOpen(o); if (o) setLocationDraft(''); }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 -mt-0.5 rounded-md px-1 py-0.5 -mx-1 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs font-medium underline-offset-2 underline decoration-dotted">Set location</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[280px] p-3 z-50" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Where are you based?</p>
                      <CityAutocomplete
                        value={locationDraft}
                        onChange={setLocationDraft}
                        placeholder="Search for your city…"
                        compact
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setLocationOpen(false)}
                          className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveLocation}
                          disabled={!locationDraft.trim() || savingLocation}
                          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {savingLocation && <Loader2 className="h-3 w-3 animate-spin" />}
                          Save
                        </button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground -mt-0.5">
                  <MapPin className="h-3 w-3 text-primary" />
                  <span className="text-xs">{currentCity}</span>
                </div>
              )}
            </div>

            {/* FAB */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md transition-transform active:scale-90"
              style={{
                background: 'linear-gradient(135deg, #E6533C 0%, #FFAD9E 100%)',
                boxShadow: '0 4px 12px -2px rgba(230, 83, 60, 0.5)',
              }}
            >
              <motion.div animate={{ rotate: menuOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
                <Plus className="h-5 w-5" />
              </motion.div>
            </button>
          </div>
        </motion.div>

        {/* Dropdown rendered outside overflow-hidden */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-popover p-1 shadow-lg"
              >
                {menuItems.map(({ key, label, icon: ItemIcon }) => (
                  <button
                    key={key}
                    onClick={() => handleSelect(key)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent"
                  >
                    <ItemIcon className="h-4 w-4 text-primary" />
                    {label}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Sheets / Dialogs */}
      {planOpen && (
        <Suspense fallback={null}>
          <GuidedPlanSheet open={planOpen} onOpenChange={setPlanOpen} preSelectedFriends={[]} />
        </Suspense>
      )}
      {tripOpen && (
        <Suspense fallback={null}>
          <GuidedTripSheet open={tripOpen} onOpenChange={setTripOpen} />
        </Suspense>
      )}
      {inviteOpen && (
        <Suspense fallback={null}>
          <InviteFriendDialog open={inviteOpen} onOpenChange={setInviteOpen} />
        </Suspense>
      )}
    </>
  );
}
