import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { Sun, Moon, Sunset, Coffee, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { getTimezoneForCity } from '@/lib/timezone';

function getGreetingConfig(hour: number) {
  if (hour >= 5 && hour < 12) return { greeting: 'Good morning', icon: Coffee, emoji: '☀️', gradient: 'from-amber-400/20 to-orange-300/10' };
  if (hour >= 12 && hour < 17) return { greeting: 'Good afternoon', icon: Sun, emoji: '🌤️', gradient: 'from-sky-400/15 to-blue-300/10' };
  if (hour >= 17 && hour < 21) return { greeting: 'Good evening', icon: Sunset, emoji: '🌅', gradient: 'from-orange-400/15 to-pink-300/10' };
  return { greeting: 'Night owl mode', icon: Moon, emoji: '🌙', gradient: 'from-indigo-400/15 to-purple-300/10' };
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
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} rounded-2xl`} />
      
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
