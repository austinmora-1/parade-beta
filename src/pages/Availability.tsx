import { useState, useCallback } from 'react';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { MergePlansDialog } from '@/components/plans/MergePlansDialog';
import { Button } from '@/components/ui/button';
import { CalendarShareIcon } from '@/components/ui/CalendarShareIcon';
import { RefreshCw, Loader2, Plus, Merge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAppleCalendar } from '@/hooks/useAppleCalendar';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import { WeeklyPlanSwiper } from '@/components/plans/WeeklyPlanSwiper';

export default function Availability() {
  const navigate = useNavigate();
  const { isConnected: isGcalConnected, isSyncing: isGcalSyncing, syncCalendar: syncGcal } = useGoogleCalendar();
  const { isConnected: isIcalConnected, isSyncing: isIcalSyncing, syncCalendar: syncIcal } = useAppleCalendar();
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);
  const loadPlans = usePlannerStore((s) => s.loadPlans);
  const plans = usePlannerStore((s) => s.plans);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planDefaultDate, setPlanDefaultDate] = useState<Date | undefined>(undefined);
  const [editPlan, setEditPlan] = useState<any>(undefined);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePreselected, setMergePreselected] = useState<string[] | undefined>(undefined);

  const openPlanDialog = (date?: Date) => {
    setPlanDefaultDate(date);
    setEditPlan(undefined);
    setPlanDialogOpen(true);
  };

  const isConnected = isGcalConnected || isIcalConnected;
  const isSyncing = isGcalSyncing || isIcalSyncing;

  const handleSync = async () => {
    const results: string[] = [];
    let anySynced = false;

    if (isGcalConnected) {
      const result = await syncGcal();
      if (result.synced) { anySynced = true; results.push('Google Calendar'); }
    }
    if (isIcalConnected) {
      const result = await syncIcal();
      if (result.synced) { anySynced = true; results.push('Apple Calendar'); }
    }

    if (anySynced) {
      toast.success(`Synced ${results.join(' & ')} successfully`);
      await Promise.all([loadProfileAndAvailability(), loadPlans()]);
    } else {
      toast.error('Failed to sync calendar');
    }
  };

  const handleEditPlan = useCallback((plan: any) => {
    setEditPlan(plan);
    setPlanDefaultDate(plan.date);
    setPlanDialogOpen(true);
  }, []);

  const handleMergeSelected = useCallback((planIds: string[]) => {
    setMergePreselected(planIds);
    setMergeOpen(true);
  }, []);

  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold md:text-2xl">Plans</h1>
            <p className="hidden text-muted-foreground md:block">
              Your weekly plans at a glance
            </p>
          </div>
          {isConnected && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-2"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-2"
            onClick={() => openPlanDialog()}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Plan</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-2"
            onClick={() => { setMergePreselected(undefined); setMergeOpen(true); }}
          >
            <Merge className="h-4 w-4" />
            <span className="hidden sm:inline">Merge</span>
          </Button>
          <ShareDialog
            trigger={
              <Button size="sm" variant="outline" className="shrink-0 gap-2">
                <CalendarShareIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            }
          />
          <button
            onClick={() => navigate('/plans')}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors ml-auto"
          >
            View Plan List →
          </button>
        </div>
      </div>

      {/* Weekly card swiper */}
      <WeeklyPlanSwiper
        plans={plans}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        onEditPlan={handleEditPlan}
        onMergeSelected={handleMergeSelected}
      />

      <CreatePlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        defaultDate={planDefaultDate}
        editPlan={editPlan}
      />

      <MergePlansDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        preselectedPlanIds={mergePreselected}
      />
    </div>
  );
}
