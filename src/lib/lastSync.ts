// Persisted "last calendar sync" timestamp (per provider, per user).
// Stored in localStorage so the indicator survives reloads.

const KEY = (provider: string, userId?: string) =>
  `parade.lastCalendarSync.${provider}.${userId ?? 'anon'}`;

export function getStoredLastSync(provider: string, userId?: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY(provider, userId));
  } catch {
    return null;
  }
}

export function setStoredLastSync(provider: string, userId?: string, iso: string = new Date().toISOString()): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY(provider, userId), iso);
  } catch {
    // ignore (private mode / quota)
  }
}

export function clearStoredLastSync(provider: string, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY(provider, userId));
  } catch {
    // ignore
  }
}

/**
 * Compact human-friendly relative formatter — "just now", "5m ago", "2h ago", "3d ago".
 */
export function formatRelativeShort(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const diffMs = now.getTime() - then;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}
