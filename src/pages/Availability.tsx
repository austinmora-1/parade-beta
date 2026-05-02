import { useState, useCallback, useMemo, lazy, Suspense, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShareDialog } from '@/components/dashboard/ShareDialog';

const CreatePlanDialog = lazy(() => import('@/components/plans/CreatePlanDialog'));
const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));
const GuidedTripSheet = lazy(() => import('@/components/trips/GuidedTripSheet'));
const MergePlansDialog = lazy(() => import('@/components/plans/MergePlansDialog'));
const InviteToPlanDialog = lazy(() => import('@/components/plans/InviteToPlanDialog'));
import { Button } from '@/components/ui/button';
import { CalendarShareIcon } from '@/components/ui/CalendarShareIcon';
import { RefreshCw, Loader2, Plus, Plane } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAppleCalendar } from '@/hooks/useAppleCalendar';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import { WeeklyPlanSwiper } from '@/components/plans/WeeklyPlanSwiper';
import { useDisplayPlans } from '@/hooks/useDisplayPlans';
import { useUserTrips } from '@/hooks/useUserTrips';
import { TripsList } from '@/components/trips/TripsList';

type ViewFilter = 'all' | 'plans' | 'trips';

const VALID_VIEWS: ViewFilter[] = ['all', 'plans', 'trips'];

export default function Availability() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected: isGcalConnected, isSyncing: isGcalSyncing, syncCalendar: syncGcal } = useGoogleCalendar();
  const { isConnected: isIcalConnected, isSyncing: isIcalSyncing, syncCalendar: syncIcal } = useAppleCalendar();
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);
  const loadPlans = usePlannerStore((s) => s.loadPlans);
  const rawPlans = usePlannerStore((s) => s.plans);
  const { displayPlans: plans } = useDisplayPlans(rawPlans);
  const deletePlan = usePlannerStore((s) => s.deletePlan);
  const { trips } = useUserTrips();

  const [guidedPlanOpen, setGuidedPlanOpen] = useState(false);
  const [guidedTripOpen, setGuidedTripOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [planDefaultDate, setPlanDefaultDate] = useState<Date | undefined>(undefined);
  const [editPlan, setEditPlan] = useState<any>(undefined);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePreselected, setMergePreselected] = useState<string[] | undefined>(undefined);
  const [sharePlanId, setSharePlanId] = useState<string | null>(null);
  const [sharePlanTitle, setSharePlanTitle] = useState('');

  // URL-synced view filter (?view=all|plans|trips)
  const viewParam = searchParams.get('view');
  const viewFilter: ViewFilter = (VALID_VIEWS as string[]).includes(viewParam || '')
    ? (viewParam as ViewFilter)
    : 'all';

  const setViewFilter = useCallback((v: ViewFilter) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'all') next.delete('view');
    else next.set('view', v);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // When viewing only trips, hide hangout cards by passing an empty array.
  const filteredPlans = useMemo(() => {
    if (viewFilter === 'trips') return [];
    return plans;
  }, [plans, viewFilter]);

  const showTripBanners = viewFilter !== 'plans';

  const openNewPlan = () => setGuidedPlanOpen(true);
  const openNewTrip = () => setGuidedTripOpen(true);

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
    navigate(`/plan/${plan.id}?edit=1`);
  }, [navigate]);

  const handleDeletePlan = useCallback((id: string) => {
    deletePlan(id);
    toast.success('Plan deleted');
  }, [deletePlan]);

  const handleSharePlan = useCallback((plan: any) => {
    setSharePlanId(plan.id);
    setSharePlanTitle(plan.title || plan.activity);
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
            <h1 className="font-display text-lg font-bold md:text-2xl">Plans &amp; Trips</h1>
            <p className="hidden text-muted-foreground md:block">
              Your hangouts and travel at a glance
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
            onClick={openNewPlan}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Plan</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-2"
            onClick={openNewTrip}
          >
            <Plane className="h-4 w-4" />
            <span className="hidden sm:inline">Add Trip</span>
          </Button>
          <ShareDialog
            trigger={
              <Button size="sm" variant="outline" className="shrink-0 gap-2">
                <CalendarShareIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            }
          />
          <ToggleGroup
            type="single"
            size="sm"
            value={viewFilter}
            onValueChange={(v) => v && setViewFilter(v as ViewFilter)}
            className="ml-auto"
          >
            <ToggleGroupItem value="all" className="text-xs h-8 px-2.5">All</ToggleGroupItem>
            <ToggleGroupItem value="plans" className="text-xs h-8 px-2.5">Plans</ToggleGroupItem>
            <ToggleGroupItem value="trips" className="text-xs h-8 px-2.5">Trips</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Weekly card swiper (with optional trip banners) */}
      <WeeklyPlanSwiper
        plans={filteredPlans}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        onEditPlan={handleEditPlan}
        onDeletePlan={handleDeletePlan}
        onMergeSelected={handleMergeSelected}
        onSharePlan={handleSharePlan}
        trips={trips}
        showTripBanners={showTripBanners}
      />

      {/* Full trips management surface when filter == trips */}
      {viewFilter === 'trips' && (
        <div className="pt-2">
          <TripsList />
        </div>
      )}

      {guidedPlanOpen && (
        <Suspense fallback={null}>
          <GuidedPlanSheet
            open={guidedPlanOpen}
            onOpenChange={setGuidedPlanOpen}
            preSelectedFriends={[]}
          />
        </Suspense>
      )}

      {guidedTripOpen && (
        <Suspense fallback={null}>
          <GuidedTripSheet
            open={guidedTripOpen}
            onOpenChange={(open) => {
              setGuidedTripOpen(open);
              if (!open) {
                loadProfileAndAvailability();
              }
            }}
          />
        </Suspense>
      )}

      {editDialogOpen && (
        <Suspense fallback={null}>
          <CreatePlanDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            defaultDate={planDefaultDate}
            editPlan={editPlan}
          />
        </Suspense>
      )}

      {mergeOpen && (
        <Suspense fallback={null}>
          <MergePlansDialog
            open={mergeOpen}
            onOpenChange={setMergeOpen}
            preselectedPlanIds={mergePreselected}
          />
        </Suspense>
      )}

      {sharePlanId && (
        <Suspense fallback={null}>
          <InviteToPlanDialog
            open={!!sharePlanId}
            onOpenChange={(open) => { if (!open) setSharePlanId(null); }}
            planId={sharePlanId}
            planTitle={sharePlanTitle}
          />
        </Suspense>
      )}
    </div>
  );
}
