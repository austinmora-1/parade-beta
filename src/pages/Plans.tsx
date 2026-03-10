import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { PlanCard } from '@/components/plans/PlanCard';
import { CalendarView } from '@/components/plans/CalendarView';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { RecurringPlansList } from '@/components/plans/RecurringPlansList';
import { Button } from '@/components/ui/button';
import { Plus, LayoutList, CalendarDays } from 'lucide-react';
import { Plan } from '@/types/planner';
import { cn } from '@/lib/utils';
import { useRecurringPlans } from '@/hooks/useRecurringPlans';
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
import { toast } from 'sonner';
import { usePlanChangeRequests } from '@/hooks/usePlanChangeRequests';

export default function Plans() {
  const { plans, deletePlan, userId } = usePlannerStore();
  const { changeRequests, respondToChange, refetch: refetchChangeRequests } = usePlanChangeRequests();
  const { recurringPlans, pauseRecurringPlan, resumeRecurringPlan, deleteRecurringPlan } = useRecurringPlans();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isRespondingToChange, setIsRespondingToChange] = useState(false);

  const planToDelete = deleteConfirmId ? plans.find(p => p.id === deleteConfirmId) : null;

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const isOwner = planToDelete && (!planToDelete.userId || planToDelete.userId === userId);

  const confirmDelete = async () => {
    if (!deleteConfirmId || !planToDelete) return;
    const hadParticipants = planToDelete.participants.length > 0;
    await deletePlan(deleteConfirmId);
    setDeleteConfirmId(null);
    if (!isOwner) {
      toast.success('You have declined this plan.');
    } else if (hadParticipants) {
      toast.success('Plan deleted. Participants have been notified.');
    } else {
      toast.success('Plan deleted.');
    }
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

  const handleAcceptChange = async (changeRequestId: string) => {
    setIsRespondingToChange(true);
    const success = await respondToChange(changeRequestId, 'accepted');
    setIsRespondingToChange(false);
    if (success) {
      toast.success('Change accepted!');
    }
  };

  const handleDeclineChange = async (changeRequestId: string) => {
    setIsRespondingToChange(true);
    const success = await respondToChange(changeRequestId, 'declined');
    setIsRespondingToChange(false);
    if (success) {
      toast.info('Change declined.');
    }
  };

  const timeSlotOrder: Record<string, number> = {
    'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
    'late-afternoon': 3, 'evening': 4, 'late-night': 5,
  };
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const futurePlans = [...plans]
    .filter(p => (p.endDate || p.date) >= today)
    .sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return (timeSlotOrder[a.timeSlot] ?? 0) - (timeSlotOrder[b.timeSlot] ?? 0);
    });
  const pastPlans = [...plans]
    .filter(p => (p.endDate || p.date) < today)
    .sort((a, b) => {
      const dateDiff = b.date.getTime() - a.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return (timeSlotOrder[b.timeSlot] ?? 0) - (timeSlotOrder[a.timeSlot] ?? 0);
    });

  const renderPlanCard = (plan: Plan) => (
    <PlanCard
      key={plan.id}
      plan={plan}
      onEdit={handleEdit}
      onDelete={handleDelete}
      changeRequest={changeRequests.find(cr => cr.planId === plan.id)}
      onAcceptChange={handleAcceptChange}
      onDeclineChange={handleDeclineChange}
      isRespondingToChange={isRespondingToChange}
    />
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

      {/* Recurring Plans */}
      <RecurringPlansList
        recurringPlans={recurringPlans}
        onPause={pauseRecurringPlan}
        onResume={resumeRecurringPlan}
        onDelete={deleteRecurringPlan}
      />

      {/* Content */}
      {view === 'list' ? (
        <div className="space-y-4">
          {futurePlans.length === 0 && pastPlans.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-soft">
              <div className="mx-auto mb-4 text-6xl">📅</div>
              <h3 className="font-display text-xl font-semibold">No plans yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create your first plan or chat with Elly to get started!
              </p>
              <Button onClick={() => setDialogOpen(true)} className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Make Your First Plan
              </Button>
            </div>
          ) : (
            <>
              {/* Upcoming */}
              {futurePlans.length > 0 && (
                <div className="space-y-1">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Upcoming</h2>
                  {futurePlans.map(renderPlanCard)}
                </div>
              )}

              {/* Past */}
              {pastPlans.length > 0 && (
                <div className="space-y-1">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Past</h2>
                  {pastPlans.map(renderPlanCard)}
                </div>
              )}
            </>
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
        onChangeProposed={refetchChangeRequests}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isOwner ? 'Delete plan?' : 'Decline this plan?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {!isOwner
                ? `This will remove "${planToDelete?.title}" from your plans and show as a decline to the organiser.`
                : planToDelete?.participants && planToDelete.participants.length > 0
                  ? `This will permanently delete "${planToDelete.title}" and notify ${planToDelete.participants.map(p => p.name).join(', ')} that the plan has been cancelled.`
                  : `This will permanently delete "${planToDelete?.title}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isOwner ? 'Delete' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
