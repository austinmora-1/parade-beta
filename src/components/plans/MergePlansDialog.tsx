import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { addDays, subDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS, Friend } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Merge, ChevronRight, ChevronLeft, Check, MapPin, Clock, Users } from 'lucide-react';

type Step = 'select' | 'details' | 'participants' | 'confirm';

interface MergePlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPlanIds?: string[];
  onMerged?: () => void;
}

export function MergePlansDialog({ open, onOpenChange, preselectedPlanIds, onMerged }: MergePlansDialogProps) {
  const plans = usePlannerStore((s) => s.plans);
  const addPlan = usePlannerStore((s) => s.addPlan);
  const deletePlan = usePlannerStore((s) => s.deletePlan);
  const loadPlans = usePlannerStore((s) => s.loadPlans);

  // If only 1 plan preselected, show a selection step to pick others
  const needsSelectStep = (preselectedPlanIds?.length ?? 0) === 1;
  const [step, setStep] = useState<Step>(needsSelectStep ? 'select' : 'details');
  const [merging, setMerging] = useState(false);
  const [additionalPlanIds, setAdditionalPlanIds] = useState<Set<string>>(new Set());

  // Detail choices
  const [chosenTitle, setChosenTitle] = useState<string>('');
  const [chosenActivity, setChosenActivity] = useState<string>('');
  const [chosenDate, setChosenDate] = useState<string>('');
  const [chosenTimeSlot, setChosenTimeSlot] = useState<string>('');
  const [chosenLocation, setChosenLocation] = useState<string>('');
  const [chosenNotes, setChosenNotes] = useState<string>('');
  const [chosenStartTime, setChosenStartTime] = useState<string>('');
  const [chosenEndTime, setChosenEndTime] = useState<string>('');

  // Participant choices
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());

  const allMergeIds = useMemo(() => {
    const ids = new Set(preselectedPlanIds || []);
    additionalPlanIds.forEach(id => ids.add(id));
    return Array.from(ids);
  }, [preselectedPlanIds, additionalPlanIds]);

  const selectedPlans = useMemo(
    () => plans.filter(p => allMergeIds.includes(p.id)),
    [plans, allMergeIds]
  );

  // Plans available to pick from in the select step (exclude already-selected)
  const pickablePlans = useMemo(() => {
    // Find the preselected plan to anchor the date range
    const anchorPlan = preselectedPlanIds?.length
      ? plans.find(p => p.id === preselectedPlanIds[0])
      : null;
    const rangeStart = anchorPlan ? subDays(anchorPlan.date, 3) : new Date();
    const rangeEnd = anchorPlan ? addDays(anchorPlan.date, 3) : addDays(new Date(), 365);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);
    return plans
      .filter(p => {
        if (preselectedPlanIds?.includes(p.id)) return false;
        const planDate = p.endDate || p.date;
        return planDate >= rangeStart && p.date <= rangeEnd;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [plans, preselectedPlanIds]);

  // All unique participants from selected plans
  const allParticipants = useMemo(() => {
    const map = new Map<string, Friend>();
    for (const plan of selectedPlans) {
      for (const p of plan.participants) {
        if (p.friendUserId && !map.has(p.friendUserId)) {
          map.set(p.friendUserId, p);
        }
      }
    }
    return Array.from(map.values());
  }, [selectedPlans]);

  // Initialize details when moving to details step
  const initDetails = (plansToMerge: Plan[]) => {
    const first = plansToMerge[0];
    setChosenTitle(first.id);
    setChosenActivity(first.id);
    setChosenDate(first.id);
    setChosenTimeSlot(first.id);
    const withLocation = plansToMerge.find(p => p.location);
    setChosenLocation(withLocation?.id || '');
    const withNotes = plansToMerge.find(p => p.notes);
    setChosenNotes(withNotes?.id || '');
    const withStartTime = plansToMerge.find(p => p.startTime);
    setChosenStartTime(withStartTime?.id || '');
    const withEndTime = plansToMerge.find(p => p.endTime);
    setChosenEndTime(withEndTime?.id || '');
    setSelectedParticipantIds(new Set(
      Array.from(new Map(plansToMerge.flatMap(p => p.participants).filter(p => p.friendUserId).map(p => [p.friendUserId!, p])).keys())
    ));
  };

  // Initialize when dialog opens with 2+ preselected
  useEffect(() => {
    if (open) {
      setAdditionalPlanIds(new Set());
      if (needsSelectStep) {
        setStep('select');
      } else if (selectedPlans.length >= 2) {
        initDetails(selectedPlans);
        setStep('details');
      }
    }
  }, [open]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPlanById = (id: string) => selectedPlans.find(p => p.id === id);

  function formatTime12(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour12 = h % 12 || 12;
    return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
  }

  const mergedPlanPreview = useMemo(() => {
    const titlePlan = getPlanById(chosenTitle);
    const activityPlan = getPlanById(chosenActivity);
    const datePlan = getPlanById(chosenDate);
    const timeSlotPlan = getPlanById(chosenTimeSlot);
    const locationPlan = chosenLocation ? getPlanById(chosenLocation) : undefined;
    const notesPlan = chosenNotes ? getPlanById(chosenNotes) : undefined;
    const startTimePlan = chosenStartTime ? getPlanById(chosenStartTime) : undefined;
    const endTimePlan = chosenEndTime ? getPlanById(chosenEndTime) : undefined;

    return {
      title: titlePlan?.title || '',
      activity: activityPlan?.activity || 'hanging-out',
      date: datePlan?.date || new Date(),
      endDate: datePlan?.endDate,
      timeSlot: timeSlotPlan?.timeSlot || 'evening',
      duration: timeSlotPlan?.duration || 60,
      startTime: startTimePlan?.startTime,
      endTime: endTimePlan?.endTime,
      location: locationPlan?.location,
      notes: notesPlan?.notes,
      status: 'confirmed' as const,
      feedVisibility: 'private' as const,
      participants: allParticipants.filter(p => p.friendUserId && selectedParticipantIds.has(p.friendUserId)),
    };
  }, [chosenTitle, chosenActivity, chosenDate, chosenTimeSlot, chosenLocation, chosenNotes, chosenStartTime, chosenEndTime, selectedPlans, allParticipants, selectedParticipantIds]);

  const handleMerge = async () => {
    setMerging(true);
    try {
      await addPlan(mergedPlanPreview);
      for (const plan of selectedPlans) {
        await deletePlan(plan.id);
      }
      await loadPlans();
      toast.success(`Merged ${selectedPlans.length} plans into one`);
      onMerged?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error merging plans:', err);
      toast.error('Failed to merge plans');
    } finally {
      setMerging(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep(needsSelectStep ? 'select' : 'details');
      setAdditionalPlanIds(new Set());
    }
    onOpenChange(v);
  };

  const toggleAdditionalPlan = (id: string) => {
    setAdditionalPlanIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stepsForIndicator: Step[] = needsSelectStep
    ? ['select', 'details', 'participants', 'confirm']
    : ['details', 'participants', 'confirm'];

  // Show select step or need 2+ plans
  const readyForDetails = selectedPlans.length >= 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] flex flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Merge Plans
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 shrink-0 pb-2">
          {stepsForIndicator.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={cn(
                'h-2 w-2 rounded-full transition-colors',
                step === s ? 'bg-primary w-5' : (
                  stepsForIndicator.indexOf(step) > i
                    ? 'bg-primary/40' : 'bg-muted-foreground/20'
                )
              )} />
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-1 pb-4">
            {/* Select step (when coming from plan detail with 1 plan) */}
            {step === 'select' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select plans to merge with this one.
                </p>
                {pickablePlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No other upcoming plans to merge with.</p>
                ) : (
                  pickablePlans.map(plan => {
                    const config = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
                    const checked = additionalPlanIds.has(plan.id);
                    return (
                      <button
                        key={plan.id}
                        onClick={() => toggleAdditionalPlan(plan.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                          checked ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <Checkbox checked={checked} className="shrink-0" />
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <ActivityIcon config={config} size={16} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{getPlanDisplayTitle(plan)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(plan.date, 'EEE, MMM d')} · {plan.startTime ? formatTime12(plan.startTime) : TIME_SLOT_LABELS[plan.timeSlot]?.time}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Choose details */}
            {step === 'details' && (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Choose which details to keep for the merged plan.
                </p>

                <DetailPicker
                  label="Title"
                  plans={selectedPlans}
                  value={chosenTitle}
                  onChange={setChosenTitle}
                  renderOption={(plan) => getPlanDisplayTitle(plan)}
                />

                <DetailPicker
                  label="Activity"
                  plans={selectedPlans}
                  value={chosenActivity}
                  onChange={setChosenActivity}
                  renderOption={(plan) => {
                    const config = ACTIVITY_CONFIG[plan.activity] || { label: plan.activity, icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
                    return (
                      <span className="flex items-center gap-1.5">
                        <ActivityIcon config={config} size={14} />
                        {config.label}
                      </span>
                    );
                  }}
                />

                <DetailPicker
                  label="Date"
                  plans={selectedPlans}
                  value={chosenDate}
                  onChange={setChosenDate}
                  renderOption={(plan) => format(plan.date, 'EEE, MMM d')}
                  dedup={(plan) => format(plan.date, 'yyyy-MM-dd')}
                />

                <DetailPicker
                  label="Time"
                  plans={selectedPlans}
                  value={chosenTimeSlot}
                  onChange={setChosenTimeSlot}
                  renderOption={(plan) => (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {plan.startTime ? formatTime12(plan.startTime) + (plan.endTime ? ` – ${formatTime12(plan.endTime)}` : '') : TIME_SLOT_LABELS[plan.timeSlot]?.time}
                    </span>
                  )}
                  dedup={(plan) => `${plan.timeSlot}-${plan.startTime || ''}`}
                />

                {selectedPlans.some(p => p.location) && (
                  <DetailPicker
                    label="Location"
                    plans={selectedPlans.filter(p => p.location)}
                    value={chosenLocation}
                    onChange={setChosenLocation}
                    renderOption={(plan) => (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {plan.location?.name}
                      </span>
                    )}
                    allowNone
                    dedup={(plan) => plan.location?.name || ''}
                  />
                )}

                {selectedPlans.some(p => p.notes) && (
                  <DetailPicker
                    label="Notes"
                    plans={selectedPlans.filter(p => p.notes)}
                    value={chosenNotes}
                    onChange={setChosenNotes}
                    renderOption={(plan) => (
                      <span className="truncate max-w-[200px]">{plan.notes}</span>
                    )}
                    allowNone
                  />
                )}
              </div>
            )}

            {/* Step 2: Choose participants */}
            {step === 'participants' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Choose which participants to include in the merged plan.
                </p>
                {allParticipants.length === 0 ? (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No participants to merge.</p>
                    <p className="text-xs text-muted-foreground/60">The merged plan will be a solo plan.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {allParticipants.map(p => {
                      const checked = selectedParticipantIds.has(p.friendUserId!);
                      return (
                        <button
                          key={p.friendUserId}
                          onClick={() => toggleParticipant(p.friendUserId!)}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                            checked
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <Checkbox checked={checked} className="shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            {p.email && <p className="text-[11px] text-muted-foreground">{p.email}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Review the merged plan before confirming.
                </p>

                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ActivityIcon
                      config={ACTIVITY_CONFIG[mergedPlanPreview.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const }}
                      size={20}
                    />
                    <span className="text-base font-semibold">{mergedPlanPreview.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {format(mergedPlanPreview.date, 'EEE, MMM d')}
                    {' · '}
                    {mergedPlanPreview.startTime
                      ? formatTime12(mergedPlanPreview.startTime) + (mergedPlanPreview.endTime ? ` – ${formatTime12(mergedPlanPreview.endTime)}` : '')
                      : TIME_SLOT_LABELS[mergedPlanPreview.timeSlot]?.time}
                  </div>

                  {mergedPlanPreview.location && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {mergedPlanPreview.location.name}
                    </div>
                  )}

                  {mergedPlanPreview.participants.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      w/ {mergedPlanPreview.participants.map(p => p.name).join(', ')}
                    </div>
                  )}

                  {mergedPlanPreview.notes && (
                    <p className="text-xs text-muted-foreground/70 italic">
                      {mergedPlanPreview.notes}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                  <p className="text-xs text-destructive font-medium">
                    This will delete {selectedPlans.length} original plan{selectedPlans.length > 1 ? 's' : ''} and create one merged plan.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border shrink-0">
          {step !== stepsForIndicator[0] ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const idx = stepsForIndicator.indexOf(step);
                if (idx > 0) setStep(stepsForIndicator[idx - 1]);
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step === 'select' && (
            <Button
              size="sm"
              disabled={additionalPlanIds.size < 1}
              onClick={() => {
                initDetails(selectedPlans.length >= 2 ? selectedPlans : plans.filter(p => allMergeIds.includes(p.id)));
                setStep('details');
              }}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 'details' && (
            <Button size="sm" onClick={() => setStep('participants')}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 'participants' && (
            <Button size="sm" onClick={() => setStep('confirm')}>
              Review
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 'confirm' && (
            <Button size="sm" disabled={merging} onClick={handleMerge}>
              {merging ? 'Merging...' : 'Merge Plans'}
              <Check className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Helper: radio picker for a field across selected plans ---

interface DetailPickerProps {
  label: string;
  plans: Plan[];
  value: string;
  onChange: (id: string) => void;
  renderOption: (plan: Plan) => React.ReactNode;
  allowNone?: boolean;
  dedup?: (plan: Plan) => string;
}

function DetailPicker({ label, plans, value, onChange, renderOption, allowNone, dedup }: DetailPickerProps) {
  const uniquePlans = useMemo(() => {
    if (!dedup) return plans;
    const seen = new Set<string>();
    return plans.filter(p => {
      const key = dedup(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [plans, dedup]);

  if (uniquePlans.length <= 1 && !allowNone) return null;

  return (
    <div>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} className="mt-1.5 space-y-1">
        {uniquePlans.map(plan => (
          <label
            key={plan.id}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all text-sm',
              value === plan.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            )}
          >
            <RadioGroupItem value={plan.id} className="shrink-0" />
            {renderOption(plan)}
          </label>
        ))}
        {allowNone && (
          <label
            className={cn(
              'flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all text-sm',
              value === '' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            )}
          >
            <RadioGroupItem value="" className="shrink-0" />
            <span className="text-muted-foreground italic">None</span>
          </label>
        )}
      </RadioGroup>
    </div>
  );
}
