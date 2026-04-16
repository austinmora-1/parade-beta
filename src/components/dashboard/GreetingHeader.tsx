import { useMemo, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { Sun, Moon, Sunset, Coffee, MapPin, Plus, CalendarPlus, Plane, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { getTimezoneForCity } from '@/lib/timezone';
import { useTheme } from 'next-themes';

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
  const { profile } = useCurrentUserProfile();
  const { plans, friends, availabilityMap, userTimezone } = usePlannerStore();
  const { resolvedTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

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

  const currentCity = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const todayAvail = availabilityMap[todayKey];
    if (todayAvail?.locationStatus === 'away' && todayAvail?.tripLocation) {
      return todayAvail.tripLocation.split(',')[0];
    }
    const homeAddress = profile?.home_address;
    return homeAddress?.split(',')[0] || 'Set location';
  }, [availabilityMap, profile?.home_address]);

  const handleSelect = (key: string) => {
    setMenuOpen(false);
    if (key === 'plan') setPlanOpen(true);
    else if (key === 'trip') setTripOpen(true);
    else if (key === 'invite') setInviteOpen(true);
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
              <div className="flex items-center gap-1 text-muted-foreground -mt-0.5">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="text-xs">{currentCity}</span>
              </div>
            </div>

            {/* FAB */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-90"
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
