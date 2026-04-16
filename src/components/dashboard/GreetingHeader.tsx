import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { Sun, Moon, Sunset, Coffee, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { getTimezoneForCity } from '@/lib/timezone';

function getGreetingConfig(hour: number) {
  if (hour >= 5 && hour < 12) return { greeting: 'Good morning', icon: Coffee, emoji: '☀️', lightGradient: 'from-amber-300/40 via-orange-200/30 to-rose-200/20', darkGradient: 'from-sky-800/30 via-indigo-700/20 to-teal-700/15' };
  if (hour >= 12 && hour < 17) return { greeting: 'Good afternoon', icon: Sun, emoji: '🌤️', lightGradient: 'from-sky-300/35 via-cyan-200/25 to-emerald-200/20', darkGradient: 'from-slate-700/30 via-blue-800/20 to-cyan-800/15' };
  if (hour >= 17 && hour < 21) return { greeting: 'Good evening', icon: Sunset, emoji: '🌅', lightGradient: 'from-orange-300/40 via-pink-300/30 to-violet-200/20', darkGradient: 'from-indigo-800/30 via-purple-800/20 to-slate-700/15' };
  return { greeting: 'Night owl mode', icon: Moon, emoji: '🌙', lightGradient: 'from-violet-300/35 via-indigo-200/25 to-blue-200/20', darkGradient: 'from-slate-800/35 via-indigo-900/25 to-violet-900/15' };
}

function getContextMessage(planCount: number, friendCount: number, hour: number): string {
  if (friendCount > 0 && hour < 12) return 'What are we getting into today?';
  if (hour >= 17) return 'Any plans tonight?';
  if (hour >= 12) return "What's the move?";
  return 'Ready to make some plans?';
}

export function GreetingHeader() {
  const { profile } = useCurrentUserProfile();
  const { plans, friends, availabilityMap, userTimezone } = usePlannerStore();

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

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl w-full"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${config.lightGradient} dark:${config.darkGradient} rounded-2xl`} />
      
      <div className="relative px-4 py-2">
        <h2 className="text-lg font-display text-foreground">
          {config.greeting}
        </h2>
        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
          <MapPin className="h-3 w-3 text-primary" />
          <span className="text-xs">{currentCity}</span>
        </div>
      </div>
    </motion.div>
  );
}
