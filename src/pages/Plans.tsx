import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { PlanCard } from '@/components/plans/PlanCard';
import { CalendarView } from '@/components/plans/CalendarView';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { Button } from '@/components/ui/button';
import { Plus, LayoutList, CalendarDays } from 'lucide-react';
import { Plan } from '@/types/planner';
import { cn } from '@/lib/utils';

export default function Plans() {
  const { plans, deletePlan } = usePlannerStore();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deletePlan(id);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingPlan(null);
      setDefaultDate(undefined);
    }
  };

  const handleCreatePlan = (date: Date) => {
    setDefaultDate(date);
    setDialogOpen(true);
  };

  const sortedPlans = [...plans].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  return (
    <div className="animate-fade-in space-y-4 md:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold md:text-2xl">Plans</h1>
          <p className="hidden text-muted-foreground md:block">
            Manage and organize your upcoming activities
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Plan</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>
      
      {/* View Toggle */}
      <div className="flex rounded-lg border border-border p-0.5 self-start">
        <button
          onClick={() => setView('list')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all md:gap-2 md:px-3 md:py-2 md:text-sm",
            view === 'list'
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutList className="h-3.5 w-3.5 md:h-4 md:w-4" />
          List
        </button>
        <button
          onClick={() => setView('calendar')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all md:gap-2 md:px-3 md:py-2 md:text-sm",
            view === 'calendar'
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" />
          Calendar
        </button>
      </div>

      {/* Content */}
      {view === 'list' ? (
        <div className="space-y-4">
          {sortedPlans.length > 0 ? (
            sortedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-soft">
              <div className="mx-auto mb-4 text-6xl">📅</div>
              <h3 className="font-display text-xl font-semibold">No plans yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create your first plan or chat with Elly to get started!
              </p>
              <Button onClick={() => setDialogOpen(true)} className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Plan
              </Button>
            </div>
          )}
        </div>
      ) : (
        <CalendarView onEditPlan={handleEdit} onDeletePlan={handleDelete} onCreatePlan={handleCreatePlan} />
      )}

      <CreatePlanDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editPlan={editingPlan}
        defaultDate={defaultDate}
      />
    </div>
  );
}
