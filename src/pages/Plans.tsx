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

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deletePlan(id);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingPlan(null);
  };

  const sortedPlans = [...plans].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Your Plans</h1>
          <p className="mt-1 text-muted-foreground">
            Manage and organize your upcoming activities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-xl border border-border p-1">
            <button
              onClick={() => setView('list')}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                view === 'list'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                view === 'calendar'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </button>
          </div>

          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Plan
          </Button>
        </div>
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
        <CalendarView onEditPlan={handleEdit} onDeletePlan={handleDelete} />
      )}

      <CreatePlanDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editPlan={editingPlan}
      />
    </div>
  );
}
