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

/**
 * Returns a compact single-line title for narrow plan cards.
 * Prefer trimming trailing location detail after separators like " - ", then fall back to a max length.
 */
export function getCompactPlanTitle(
  plan: Pick<Plan, 'title' | 'participants'>,
  maxLength = 28,
): string {
  const fullTitle = getPlanDisplayTitle(plan).trim();

  const separatorIndex = fullTitle.lastIndexOf(' - ');
  if (separatorIndex > 0) {
    return `${fullTitle.slice(0, separatorIndex).trim()}…`;
  }

  if (fullTitle.length <= maxLength) {
    return fullTitle;
  }

  return `${fullTitle.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
