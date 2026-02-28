import { useMemo } from 'react';
import { addDays, isAfter, isBefore } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { Calendar, Clock, Sparkles, CalendarCheck, BarChart3 } from 'lucide-react';
import { CollapsibleWidget } from './CollapsibleWidget';

export function QuickStats() {
  const { plans, availability, currentVibe } = usePlannerStore();

  const stats = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    
    const upcomingPlans = plans.filter(
      (p) => isAfter(p.date, now) && isBefore(p.date, weekFromNow)
    );
    
    const availableSlots = availability.reduce((total, day) => {
      const daySlots = Object.values(day.slots).filter(Boolean).length;
      return total + daySlots;
    }, 0);
    
    return {
      plansThisWeek: upcomingPlans.length,
      totalHours: Math.round(upcomingPlans.reduce((sum, p) => sum + p.duration, 0) / 60),
      availableSlots,
    };
  }, [plans, availability]);

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
      icon: CalendarCheck,
      label: 'Available slots',
      value: stats.availableSlots,
      color: 'bg-availability-available/10 text-availability-available',
    },
    {
      icon: Sparkles,
      label: 'Current vibe',
      value: currentVibe?.type === 'custom' 
        ? (currentVibe.customText || currentVibe.customTags?.join(', ') || 'Custom') 
        : currentVibe?.type || 'Not set',
      isText: true,
      color: 'bg-accent text-accent-foreground',
    },
  ];

  return (
    <CollapsibleWidget
      title="Quick Stats"
      icon={<BarChart3 className="h-4 w-4 text-primary" />}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-background p-3 md:p-4"
          >
            <div className={`mb-2 inline-flex rounded-lg p-2 ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`font-display text-xl font-bold ${stat.isText ? 'text-base capitalize' : ''}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </CollapsibleWidget>
  );
}
