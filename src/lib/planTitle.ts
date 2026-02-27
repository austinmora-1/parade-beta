import { Plan } from '@/types/planner';

/**
 * Returns a dynamic display title for a plan.
 * For 1:1 hangs, shows "Hang with [other person's name]" instead of the static DB title.
 */
export function getPlanDisplayTitle(plan: Pick<Plan, 'title' | 'participants'>): string {
  const nonSubscribers = plan.participants.filter(p => p.role !== 'subscriber');
  if (plan.title.startsWith('Hang with') && nonSubscribers.length === 1) {
    return `Hang with ${nonSubscribers[0].name}`;
  }
  return plan.title;
}
