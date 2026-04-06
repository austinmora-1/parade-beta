import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { Home, Plane, Plus, Trash2, CalendarDays } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { cn } from '@/lib/utils';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, ACTIVITY_CONFIG, TIME_SLOT_LABELS, TimeSlot, Plan } from '@/types/planner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { PlanRsvpButtons } from '@/components/plans/PlanRsvpButtons';
import { useAuth } from '@/hooks/useAuth';

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}
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

interface DaySummaryDropdownProps {
  selectedDate: Date;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SLOT_ORDER: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon',
  'late-afternoon', 'evening', 'late-night',
];

export function DaySummaryDropdown({ selectedDate, isOpen, onOpenChange }: DaySummaryDropdownProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    plans, 
    availabilityMap,
    getVibeForDate,
    setVibeForDate,
    getLocationStatusForDate, 
    setLocationStatus,
    setAvailability,
    deletePlan,
    userId
  } = usePlannerStore();

  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
  const [createDefaultSlot, setCreateDefaultSlot] = useState<TimeSlot | undefined>();

  const locationStatus = getLocationStatusForDate(selectedDate);
  const dayVibe = getVibeForDate(selectedDate);
  
  const timeSlotOrder: Record<string, number> = {
    'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
    'late-afternoon': 3, 'evening': 4, 'late-night': 5,
  };
  const dayPlans = useMemo(() => {
    return plans
      .filter((p) => isSameDay(p.date, selectedDate))
      .sort((a, b) => (timeSlotOrder[a.timeSlot] ?? 0) - (timeSlotOrder[b.timeSlot] ?? 0));
  }, [plans, selectedDate]);

  const vibeOptions = Object.entries(VIBE_CONFIG).filter(([key]) => key !== 'custom');

  const getSlotStatus = (slot: TimeSlot) => {
    const hasPlan = plans.some(
      (p) => isSameDay(p.date, selectedDate) && p.timeSlot === slot
    );
    if (hasPlan) return 'busy';

    const dayAvail = availabilityMap[format(selectedDate, 'yyyy-MM-dd')];
    if (dayAvail && !dayAvail.slots[slot]) return 'unavailable';

    return 'available';
  };

  const getPlansForSlot = (slot: TimeSlot): Plan[] => {
    return dayPlans.filter(p => p.timeSlot === slot);
  };

  const toggleSlot = (slot: TimeSlot) => {
    const currentStatus = getSlotStatus(slot);
    if (currentStatus === 'busy') return;

    const dayAvail = availabilityMap[format(selectedDate, 'yyyy-MM-dd')];
    const isCurrentlyAvailable = dayAvail ? dayAvail.slots[slot] : true;
    setAvailability(selectedDate, slot, !isCurrentlyAvailable);
  };

  if (!isOpen) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft animate-fade-in space-y-3">
      {/* Location toggle */}
      <div className="flex items-center gap-1.5">
        {locationStatus === 'home' ? (
          <Home className="h-3.5 w-3.5 text-availability-available" />
        ) : (
          <Plane className="h-3.5 w-3.5 text-primary" />
        )}
        <span className="text-xs font-medium">
          {locationStatus === 'home' ? 'Home' : 'Away'}
        </span>
        <Switch
          className="scale-75"
          checked={locationStatus === 'home'}
          onCheckedChange={(checked) => setLocationStatus(checked ? 'home' : 'away', selectedDate)}
        />
      </div>

      {/* Vertical Timeline Day View */}
      <div className="space-y-0.5">
        {SLOT_ORDER.map((slot) => {
          const status = getSlotStatus(slot);
          const slotPlans = getPlansForSlot(slot);
          const slotInfo = TIME_SLOT_LABELS[slot];
          const isAvailable = status === 'available';
          const isBusy = status === 'busy';

          return (
            <div
              key={slot}
              className={cn(
                "rounded-lg transition-colors",
                isAvailable && "bg-availability-available-light",
                status === 'unavailable' && "bg-muted/30",
                isBusy && "bg-muted/50"
              )}
            >
              {/* Slot header row */}
              <button
                onClick={() => toggleSlot(slot)}
                disabled={isBusy}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors rounded-lg",
                  !isBusy && "hover:bg-muted/40 active:scale-[0.99]",
                  isBusy && "cursor-default"
                )}
              >
                {/* Time label */}
                <span className="text-[10px] text-muted-foreground w-[52px] shrink-0 font-medium">
                  {slotInfo.time}
                </span>

                {/* Slot label */}
                <span className={cn(
                  "text-xs font-medium flex-1",
                  isAvailable && "text-availability-available",
                  status === 'unavailable' && "text-muted-foreground",
                  isBusy && "text-foreground"
                )}>
                  {slotInfo.label}
                </span>

                {/* Quick add button for available slots */}
                {isAvailable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateDefaultSlot(slot);
                      setCreatePlanOpen(true);
                    }}
                    className="p-0.5 rounded hover:bg-availability-available/20 transition-colors"
                  >
                    <Plus className="h-3 w-3 text-availability-available/60" />
                  </button>
                )}
              </button>

              {/* Plans within this slot */}
              {slotPlans.length > 0 && (
                <div className="px-2.5 pb-1.5 space-y-1 ml-[52px]">
                  {slotPlans.map((plan) => {
                    const activityConfig = ACTIVITY_CONFIG[plan.activity];
                    const isOwner = !plan.userId || plan.userId === userId;
                    const myParticipation = plan.participants?.find((p: any) => p.friendUserId === userId);
                    const myRsvp = plan.myRsvpStatus ?? myParticipation?.rsvpStatus;
                    const isPendingRsvp = !isOwner && myRsvp && myRsvp !== 'accepted' && myRsvp !== 'declined';
                    const isTentativePlan = plan.status === 'tentative' || (plan.status === 'proposed' && isOwner) || isPendingRsvp;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => navigate(`/plan/${plan.id}`)}
                        className={cn(
                          "rounded-md bg-background/80 border border-border/50 px-2 py-1.5 group cursor-pointer hover:bg-muted/50 transition-colors",
                          isTentativePlan && "border-dashed opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {activityConfig ? (
                            <ActivityIcon config={activityConfig} size={14} />
                          ) : (
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-medium truncate">{getPlanDisplayTitle(plan)}</p>
                              {isTentativePlan && (
                                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">tentative</span>
                              )}
                            </div>
                            {(plan.startTime || plan.endTime) && (
                              <p className="text-[10px] text-muted-foreground">
                                {plan.startTime && formatTime12(plan.startTime)}
                                {plan.startTime && plan.endTime && ' – '}
                                {plan.endTime && formatTime12(plan.endTime)}
                              </p>
                            )}
                            {plan.participants.length > 0 && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                w/ {plan.participants.map(p => p.name).join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingPlan(plan);
                              }}
                              className="p-1 rounded hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                        {/* Inline RSVP for plans user is invited to */}
                        {(() => {
                          if (isOwner || !userId) return null;
                          const effectiveRsvp = myRsvp;
                          if (!effectiveRsvp || effectiveRsvp === 'accepted' || effectiveRsvp === 'declined') return null;
                          return (
                            <div className="mt-1" onClick={e => e.stopPropagation()}>
                              <PlanRsvpButtons planId={plan.id} userId={userId} currentStatus={effectiveRsvp} compact />
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create/Edit Plan Dialog */}
      <CreatePlanDialog 
        open={createPlanOpen || !!editingPlan} 
        onOpenChange={(open) => {
          if (!open) {
            setCreatePlanOpen(false);
            setEditingPlan(null);
          }
        }}
        editPlan={editingPlan}
        defaultDate={selectedDate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPlan?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingPlan) {
                  deletePlan(deletingPlan.id);
                  setDeletingPlan(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
