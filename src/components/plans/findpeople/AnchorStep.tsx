import { useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, Users, Plus, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Plan, ACTIVITY_CONFIG, ActivityType } from '@/types/planner';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getElephantAvatar } from '@/lib/elephantAvatars';

interface AnchorStepProps {
  onSelectPlan: (plan: Plan) => void;
  onSelectNew: () => void;
}

export function AnchorStep({ onSelectPlan, onSelectNew }: AnchorStepProps) {
  const { user } = useAuth();
  const { plans } = usePlannerStore();

  const eligiblePlans = useMemo(() => {
    if (!user?.id) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return plans
      .filter(p => p.userId === user.id && p.date >= today && p.status !== 'cancelled')
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 20);
  }, [plans, user?.id]);

  return (
    <motion.div
      key="anchor"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3"
    >
      <p className="text-xs text-muted-foreground text-center">
        What are you trying to fill?
      </p>

      <button
        onClick={onSelectNew}
        className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Plus className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Something new</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Describe a fresh plan and broadcast it
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {eligiblePlans.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Or fill an existing plan
          </p>
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {eligiblePlans.map(plan => {
              const cfg = ACTIVITY_CONFIG[plan.activity as ActivityType];
              const icon = cfg?.icon || '✨';
              const participantCount = plan.participants?.length || 0;
              return (
                <button
                  key={plan.id}
                  onClick={() => onSelectPlan(plan)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-left transition-all',
                    'hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-base shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{plan.title}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {format(plan.date, 'EEE, MMM d')}
                      <span aria-hidden>·</span>
                      <Users className="h-2.5 w-2.5" />
                      {participantCount} {participantCount === 1 ? 'invited' : 'invited'}
                    </p>
                  </div>
                  {participantCount > 0 && (
                    <div className="flex -space-x-2 shrink-0">
                      {plan.participants.slice(0, 3).map(f => (
                        <Avatar key={f.id} className="h-6 w-6 border-2 border-card">
                          <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                          <AvatarFallback className="text-[8px]">{f.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
