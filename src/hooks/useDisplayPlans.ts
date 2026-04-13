import { useMemo } from 'react';
import { Plan, TimeSlot } from '@/types/planner';
import { usePlanChangeRequests, PlanChangeRequest } from '@/hooks/usePlanChangeRequests';

/**
 * Takes plans and overlays any pending change requests onto them,
 * moving plans to the proposed date/time and marking them with pendingChange.
 */
export function applyPendingChanges(plans: Plan[], changeRequests: PlanChangeRequest[]): Plan[] {
  if (changeRequests.length === 0) return plans;

  const crByPlanId = new Map<string, PlanChangeRequest>();
  for (const cr of changeRequests) {
    if (cr.status === 'pending') {
      crByPlanId.set(cr.planId, cr);
    }
  }

  return plans.map(plan => {
    const cr = crByPlanId.get(plan.id);
    if (!cr) return plan;

    return {
      ...plan,
      // Move plan to proposed date/time visually
      date: cr.proposedDate ?? plan.date,
      timeSlot: (cr.proposedTimeSlot as TimeSlot) ?? plan.timeSlot,
      duration: cr.proposedDuration ?? plan.duration,
      pendingChange: {
        changeRequestId: cr.id,
        proposedDate: cr.proposedDate ?? undefined,
        proposedTimeSlot: (cr.proposedTimeSlot as TimeSlot) ?? undefined,
        proposedDuration: cr.proposedDuration ?? undefined,
        proposedBy: cr.proposedBy,
      },
    };
  });
}

/**
 * Hook that returns plans with pending change requests overlaid.
 */
export function useDisplayPlans(plans: Plan[]): {
  displayPlans: Plan[];
  changeRequests: PlanChangeRequest[];
  isLoading: boolean;
} {
  const { changeRequests, isLoading } = usePlanChangeRequests();

  const displayPlans = useMemo(
    () => applyPendingChanges(plans, changeRequests),
    [plans, changeRequests]
  );

  return { displayPlans, changeRequests, isLoading };
}
