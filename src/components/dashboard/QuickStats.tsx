import { useMemo } from 'react';
import { addDays, isAfter, isBefore } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { Calendar, Users, Clock, Sparkles } from 'lucide-react';

export function QuickStats() {
  const { plans, friends, currentVibe } = usePlannerStore();

  const stats = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    
    const upcomingPlans = plans.filter(
      (p) => isAfter(p.date, now) && isBefore(p.date, weekFromNow)
    );
    
    const connectedFriends = friends.filter((f) => f.status === 'connected');
    
    return {
      plansThisWeek: upcomingPlans.length,
      totalHours: Math.round(upcomingPlans.reduce((sum, p) => sum + p.duration, 0) / 60),
      connectedFriends: connectedFriends.length,
    };
  }, [plans, friends]);

  const statCards = [
    {
      icon: Calendar,
      label: 'Plans this week',
      value: stats.plansThisWeek,
      color: 'bg-primary/10 text-primary',
    },
    {
      icon: Clock,
      label: 'Hours planned',
      value: stats.totalHours,
      color: 'bg-activity-sports/10 text-activity-sports',
    },
    {
      icon: Users,
      label: 'Friends',
      value: stats.connectedFriends,
      color: 'bg-activity-drinks/10 text-activity-drinks',
    },
    {
      icon: Sparkles,
      label: 'Current vibe',
      value: currentVibe?.type === 'custom' ? currentVibe.customText : currentVibe?.type || 'Not set',
      isText: true,
      color: 'bg-accent text-accent-foreground',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {statCards.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:shadow-glow md:rounded-2xl md:p-5"
        >
          <div className={`mb-2 inline-flex rounded-lg p-2 md:mb-3 md:rounded-xl md:p-2.5 ${stat.color}`}>
            <stat.icon className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <p className="text-xs text-muted-foreground md:text-sm">{stat.label}</p>
          <p className={`font-display text-xl font-bold md:text-2xl ${stat.isText ? 'text-base capitalize md:text-lg' : ''}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
