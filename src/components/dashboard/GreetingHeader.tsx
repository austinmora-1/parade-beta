import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { Sun, Moon, Sunset, Coffee, Sparkles } from 'lucide-react';

function getGreetingConfig(hour: number) {
  if (hour >= 5 && hour < 12) return { greeting: 'Good morning', icon: Coffee, emoji: '☀️', gradient: 'from-amber-400/20 to-orange-300/10' };
  if (hour >= 12 && hour < 17) return { greeting: 'Good afternoon', icon: Sun, emoji: '🌤️', gradient: 'from-sky-400/15 to-blue-300/10' };
  if (hour >= 17 && hour < 21) return { greeting: 'Good evening', icon: Sunset, emoji: '🌅', gradient: 'from-orange-400/15 to-pink-300/10' };
  return { greeting: 'Night owl mode', icon: Moon, emoji: '🌙', gradient: 'from-indigo-400/15 to-purple-300/10' };
}

function getContextMessage(planCount: number, friendCount: number, hour: number): string {
  if (planCount > 0 && hour < 12) return 'You have ' + planCount + (planCount > 1 ? ' plans' : ' plan') + ' coming up';
  if (planCount > 0) return planCount + (planCount > 1 ? ' plans' : ' plan') + ' on deck';
  if (friendCount > 0 && hour < 12) return 'What are we getting into today?';
  if (hour >= 17) return 'Any plans tonight?';
  if (hour >= 12) return "What's the move?";
  return 'Ready to make some plans?';
}

export function GreetingHeader() {
  const { profile } = useCurrentUserProfile();
  const { plans, friends } = usePlannerStore();

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
    const firstName = profile?.display_name?.split(' ')[0] || '';
    return { ...greetConfig, context, firstName };
  }, [profile?.display_name, plans, friends]);

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
          {config.greeting}{config.firstName ? `, ${config.firstName}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground mt-0">
          {config.context}
        </p>
      </div>
    </motion.div>
  );
}
