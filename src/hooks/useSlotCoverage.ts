import { useMemo } from 'react';
import { format } from 'date-fns';
import { Plan, TimeSlot } from '@/types/planner';
import { usePlannerStore } from '@/stores/plannerStore';
import { getPlanSlotCoverage, mergeCoverages, SlotCoverage } from '@/lib/planSlotCoverage';

const BLOCKING_STATUSES = new Set(['confirmed', 'tentative', 'proposed']);

/**
 * Returns a Map<dateString, Map<TimeSlot, SlotCoverage>> derived from the
 * user's plans. Lets UI distinguish fully-blocked slots from partially-
 * overlapping ones (and surface the remaining free sub-window).
 */
export function useSlotCoverageByDate(): Map<string, Map<TimeSlot, SlotCoverage>> {
  const plans = usePlannerStore((s) => s.plans);
  return useMemo(() => {
    const byDate: Record<string, Plan[]> = {};
    for (const p of plans) {
      if (p.status && !BLOCKING_STATUSES.has(p.status)) continue;
      if (p.blocksAvailability === false) continue;
      const k = format(p.date, 'yyyy-MM-dd');
      (byDate[k] ||= []).push(p);
    }
    const out = new Map<string, Map<TimeSlot, SlotCoverage>>();
    for (const [k, dayPlans] of Object.entries(byDate)) {
      const coverages = dayPlans.map((p) =>
        getPlanSlotCoverage({
          timeSlot: p.timeSlot,
          startTime: p.startTime || null,
          endTime: p.endTime || null,
        }),
      );
      out.set(k, mergeCoverages(coverages));
    }
    return out;
  }, [plans]);
}

export function getSlotCoverage(
  byDate: Map<string, Map<TimeSlot, SlotCoverage>>,
  date: Date,
  slot: TimeSlot,
): SlotCoverage | undefined {
  return byDate.get(format(date, 'yyyy-MM-dd'))?.get(slot);
}
