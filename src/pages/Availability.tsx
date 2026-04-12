import { useState, useRef, useCallback } from 'react';
import { AvailabilityGrid } from '@/components/availability/AvailabilityGrid';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { AddTripDialog } from '@/components/profile/AddTripDialog';
import { MissingReturnDialog, PendingReturnTrip } from '@/components/trips/MissingReturnDialog';
import { Button } from '@/components/ui/button';
import { CalendarShareIcon } from '@/components/ui/CalendarShareIcon';
import { RefreshCw, Loader2, Plus, PlaneTakeoff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAppleCalendar } from '@/hooks/useAppleCalendar';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TripsList } from '@/components/trips/TripsList';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { id: 'grid', label: 'Daily' },
  { id: 'trips', label: 'Trips' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Availability() {
  const navigate = useNavigate();
  const { isConnected: isGcalConnected, isSyncing: isGcalSyncing, syncCalendar: syncGcal } = useGoogleCalendar();
  const { isConnected: isIcalConnected, isSyncing: isIcalSyncing, syncCalendar: syncIcal } = useAppleCalendar();
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);
  const loadPlans = usePlannerStore((s) => s.loadPlans);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planDefaultDate, setPlanDefaultDate] = useState<Date | undefined>(undefined);
  const [tripDialogOpen, setTripDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('grid');
  const [direction, setDirection] = useState(0);
  const [pendingReturnTrips, setPendingReturnTrips] = useState<PendingReturnTrip[]>([]);
  const [missingReturnOpen, setMissingReturnOpen] = useState(false);

  // Swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const openPlanDialog = (date?: Date) => {
    setPlanDefaultDate(date);
    setPlanDialogOpen(true);
  };

  const isConnected = isGcalConnected || isIcalConnected;
  const isSyncing = isGcalSyncing || isIcalSyncing;

  const handleSync = async () => {
    const results: string[] = [];
    let anySynced = false;
    const allPendingTrips: PendingReturnTrip[] = [];

    if (isGcalConnected) {
      const result = await syncGcal();
      if (result.synced) { anySynced = true; results.push('Google Calendar'); }
      if (result.pendingReturnTrips?.length) allPendingTrips.push(...result.pendingReturnTrips);
    }
    if (isIcalConnected) {
      const result = await syncIcal();
      if (result.synced) { anySynced = true; results.push('Apple Calendar'); }
      if (result.pendingReturnTrips?.length) allPendingTrips.push(...result.pendingReturnTrips);
    }

    if (anySynced) {
      toast.success(`Synced ${results.join(' & ')} successfully`);
      await Promise.all([loadProfileAndAvailability(), loadPlans()]);
    } else {
      toast.error('Failed to sync calendar');
    }

    // Show missing return dialog if there are one-way flights
    if (allPendingTrips.length > 0) {
      setPendingReturnTrips(allPendingTrips);
      setMissingReturnOpen(true);
    }
  };

  const activeIndex = TABS.findIndex(t => t.id === activeTab);

  const goToTab = useCallback((tabId: TabId) => {
    const newIndex = TABS.findIndex(t => t.id === tabId);
    const oldIndex = TABS.findIndex(t => t.id === activeTab);
    setDirection(newIndex > oldIndex ? 1 : -1);
    setActiveTab(tabId);
  }, [activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isHorizontalSwipe.current === null) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (deltaX > 10 || deltaY > 10) {
        isHorizontalSwipe.current = deltaX > deltaY;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isHorizontalSwipe.current) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0 && activeIndex < TABS.length - 1) {
        goToTab(TABS[activeIndex + 1].id);
      } else if (deltaX > 0 && activeIndex > 0) {
        goToTab(TABS[activeIndex - 1].id);
      }
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -100 : 100, opacity: 0 }),
  };

  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold md:text-2xl">Plans</h1>
            <p className="hidden text-muted-foreground md:block">
              Set when you're free and share with friends
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
            onClick={() => setTripDialogOpen(true)}
          >
            <PlaneTakeoff className="h-4 w-4" />
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
          <button
            onClick={() => navigate('/plans')}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors ml-auto"
          >
            View Plan List →
          </button>
        </div>
      </div>

      {/* Tab labels + dots */}
      <div className="flex flex-col items-center gap-1">
        <h2 className="font-display text-sm font-semibold">
          {TABS[activeIndex].label}
        </h2>
        <div className="flex gap-2">
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => goToTab(tab.id)}
              className={cn(
                "rounded-full transition-all duration-200",
                activeIndex === i
                  ? "h-2.5 w-6 bg-primary"
                  : "h-2.5 w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={tab.label}
            />
          ))}
        </div>
      </div>

      {/* Swipeable content */}
      <div
        className="relative overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {activeTab === 'grid' && <AvailabilityGrid onCreatePlan={(date) => openPlanDialog(date)} />}
            {activeTab === 'trips' && <TripsList />}
          </motion.div>
        </AnimatePresence>
      </div>


      <CreatePlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        defaultDate={planDefaultDate}
      />

      <AddTripDialog
        open={tripDialogOpen}
        onOpenChange={setTripDialogOpen}
        onTripAdded={() => loadProfileAndAvailability()}
      />

      <MissingReturnDialog
        open={missingReturnOpen}
        onOpenChange={setMissingReturnOpen}
        trips={pendingReturnTrips}
        onComplete={() => {
          loadProfileAndAvailability();
          loadPlans();
        }}
      />
    </div>
  );
}
