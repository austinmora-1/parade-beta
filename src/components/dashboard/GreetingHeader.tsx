import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { Sun, Moon, Sunset, Coffee, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { getTimezoneForCity } from '@/lib/timezone';
import { useTheme } from 'next-themes';

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

export function GreetingHeader() {
  const { profile } = useCurrentUserProfile();
  const { plans, friends, availabilityMap, userTimezone } = usePlannerStore();
  const { resolvedTheme } = useTheme();

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
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: resolvedTheme === 'dark'
            ? config.darkGradient
            : config.lightGradient,
        }}
      />
      
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
