import { useNavigate } from 'react-router-dom';
import { useSmartNudges } from '@/hooks/useSmartNudges';
import { X, MessageCircle, Users, CalendarPlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NUDGE_ICONS: Record<string, React.ReactNode> = {
  fading_friendship: <MessageCircle className="h-4 w-4" />,
  friends_available: <Users className="h-4 w-4" />,
  reconnect: <Sparkles className="h-4 w-4" />,
};

const NUDGE_COLORS: Record<string, string> = {
  fading_friendship: 'border-l-amber-400 dark:border-l-amber-500',
  friends_available: 'border-l-emerald-400 dark:border-l-emerald-500',
  reconnect: 'border-l-violet-400 dark:border-l-violet-500',
};

const URGENCY_BG: Record<string, string> = {
  high: 'bg-amber-50/80 dark:bg-amber-950/30',
  medium: 'bg-muted/50',
  low: 'bg-muted/30',
};

export function SmartNudges() {
  const { nudges, dismissNudge, markActedOn } = useSmartNudges();
  const navigate = useNavigate();

  if (nudges.length === 0) return null;

  const handleAction = (nudge: typeof nudges[0]) => {
    markActedOn(nudge.id);
    if (nudge.nudge_type === 'fading_friendship' && nudge.friend_user_id) {
      navigate(`/friend/${nudge.friend_user_id}`);
    } else if (nudge.nudge_type === 'friends_available') {
      navigate('/plans');
    } else {
      navigate('/friends');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">For You</h3>
      </div>
      <div className="space-y-2">
        {nudges.slice(0, 3).map((nudge) => {
          const urgency = (nudge.metadata?.urgency as string) || 'low';
          return (
            <div
              key={nudge.id}
              className={cn(
                "relative rounded-lg border-l-[3px] px-3 py-2.5 transition-all cursor-pointer group",
                NUDGE_COLORS[nudge.nudge_type] || 'border-l-primary',
                URGENCY_BG[urgency] || 'bg-muted/30',
                "hover:shadow-sm"
              )}
              onClick={() => handleAction(nudge)}
            >
              <button
                className="absolute top-1.5 right-1.5 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNudge(nudge.id);
                }}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>

              <div className="flex items-start gap-2.5 pr-6">
                <div className="mt-0.5 shrink-0 text-muted-foreground">
                  {NUDGE_ICONS[nudge.nudge_type] || <Sparkles className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{nudge.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{nudge.message}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-2 ml-[26px]">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(nudge);
                  }}
                >
                  {nudge.nudge_type === 'fading_friendship' ? (
                    <>
                      <CalendarPlus className="h-3 w-3 mr-1" />
                      Reach out
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="h-3 w-3 mr-1" />
                      Make plans
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
