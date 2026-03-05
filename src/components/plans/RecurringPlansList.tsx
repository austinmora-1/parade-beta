import { useState } from 'react';
import { RecurringPlan, getRecurrenceLabel, useRecurringPlans } from '@/hooks/useRecurringPlans';
import { ACTIVITY_CONFIG, ActivityType } from '@/types/planner';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Repeat, Pause, Play, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RecurringPlansListProps {
  recurringPlans: RecurringPlan[];
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onDelete: (id: string, deleteFuture: boolean) => Promise<void>;
}

export function RecurringPlansList({ recurringPlans, onPause, onResume, onDelete }: RecurringPlansListProps) {
  const [deletingPlan, setDeletingPlan] = useState<RecurringPlan | null>(null);
  const [deleteFutureInstances, setDeleteFutureInstances] = useState(true);

  if (recurringPlans.length === 0) return null;

  const handleDelete = async () => {
    if (!deletingPlan) return;
    try {
      await onDelete(deletingPlan.id, deleteFutureInstances);
      toast.success('Recurring plan deleted');
      setDeletingPlan(null);
    } catch {
      toast.error('Failed to delete recurring plan');
    }
  };

  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Repeat className="h-3.5 w-3.5" />
        Recurring ({recurringPlans.length})
      </h2>
      <div className="space-y-1.5">
        {recurringPlans.map((rp) => {
          const config = ACTIVITY_CONFIG[rp.activity as ActivityType] || { label: rp.activity, icon: '✨', color: 'activity-misc', vibeType: 'social' as const };
          return (
            <div
              key={rp.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 shadow-soft transition-opacity",
                !rp.isActive && "opacity-50"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <ActivityIcon config={config} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{rp.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {getRecurrenceLabel(rp)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!rp.isActive && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    Paused
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[130px]">
                    {rp.isActive ? (
                      <DropdownMenuItem
                        className="text-xs"
                        onClick={async () => {
                          await onPause(rp.id);
                          toast.success('Recurring plan paused');
                        }}
                      >
                        <Pause className="mr-1.5 h-3 w-3" />
                        Pause
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="text-xs"
                        onClick={async () => {
                          await onResume(rp.id);
                          toast.success('Recurring plan resumed');
                        }}
                      >
                        <Play className="mr-1.5 h-3 w-3" />
                        Resume
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive text-xs"
                      onClick={() => setDeletingPlan(rp)}
                    >
                      <Trash2 className="mr-1.5 h-3 w-3" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recurring plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop generating new instances of "{deletingPlan?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteFutureInstances}
              onChange={(e) => setDeleteFutureInstances(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-xs text-muted-foreground">
              Also delete future plan instances
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
