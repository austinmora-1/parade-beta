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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {statCards.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:shadow-glow"
        >
          <div className={`mb-3 inline-flex rounded-xl p-2.5 ${stat.color}`}>
            <stat.icon className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className={`font-display text-2xl font-bold ${stat.isText ? 'capitalize text-lg' : ''}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
