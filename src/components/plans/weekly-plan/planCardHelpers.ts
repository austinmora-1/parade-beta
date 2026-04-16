import { Plan, DayAvailability } from '@/types/planner';
import { normalizeCity } from '@/lib/locationMatch';

export function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export function getRsvpStyle(status?: string, role?: string) {
  if (role === 'subscriber') return { color: 'bg-muted', icon: 'Eye' as const, label: 'Watching' };
  switch (status) {
    case 'accepted': return { color: 'bg-emerald-500', icon: 'Check' as const, label: 'Going' };
    case 'declined': return { color: 'bg-destructive', icon: 'X' as const, label: "Can't go" };
    case 'maybe': return { color: 'bg-amber-500', icon: 'Clock' as const, label: 'Maybe' };
    default: return { color: 'bg-muted-foreground/50', icon: 'Clock' as const, label: 'Pending' };
  }
}

export function formatCity(s: string): string {
  return s.length <= 4 ? s : s.replace(/\b\w/g, c => c.toUpperCase());
}

/** Look up the previous day's last known location from availability data */
export function getPreviousDayLocation(dateKey: string, availabilityMap: Record<string, DayAvailability>, homeCity: string | null): string | null {
  const d = new Date(dateKey + 'T12:00:00Z');
  d.setDate(d.getDate() - 1);
  const prevKey = d.toISOString().split('T')[0];
  const prevAvail = availabilityMap[prevKey];
  if (!prevAvail) return homeCity || null;

  if (prevAvail.slotLocations) {
    const slotKeys = ['late-night', 'evening', 'late-afternoon', 'early-afternoon', 'late-morning', 'early-morning'];
    for (const key of slotKeys) {
      const val = (prevAvail.slotLocations as Record<string, string | null>)[key];
      if (val) return val;
    }
  }

  if (prevAvail.tripLocation) return prevAvail.tripLocation;
  return homeCity || null;
}

/** Look up the next day's first known location from availability data */
export function getNextDayLocation(dateKey: string, availabilityMap: Record<string, DayAvailability>, homeCity: string | null): string | null {
  const d = new Date(dateKey + 'T12:00:00Z');
  d.setDate(d.getDate() + 1);
  const nextKey = d.toISOString().split('T')[0];
  const nextAvail = availabilityMap[nextKey];
  if (!nextAvail) return homeCity || null;

  if (nextAvail.slotLocations) {
    const slotKeys = ['early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
    for (const key of slotKeys) {
      const val = (nextAvail.slotLocations as Record<string, string | null>)[key];
      if (val) return val;
    }
  }

  if (nextAvail.tripLocation) return nextAvail.tripLocation;
  if (nextAvail.locationStatus === 'home') return homeCity || null;
  return homeCity || null;
}

export function getLocationLabel(dateKey: string, availabilityMap: Record<string, DayAvailability>, homeAddress: string | null): { label: string; isSplit: boolean; isAway: boolean } | null {
  const avail = availabilityMap[dateKey];
  const isAway = avail?.locationStatus === 'away';
  const homeCity = homeAddress?.split(',')[0]?.trim() || null;

  if (avail?.slotLocations) {
    const locs = Object.values(avail.slotLocations).filter((v): v is string => !!v);
    const normalizedLocs = locs.map(l => normalizeCity(l));
    const unique = [...new Set(normalizedLocs)].filter(Boolean);
    const hasTransit = Object.values(avail.slotLocations).some(v => v === null && v !== undefined);
    if (unique.length > 1 || (unique.length >= 1 && hasTransit)) {
      const displayNames: string[] = [];
      const seen = new Set<string>();
      for (const loc of locs) {
        const norm = normalizeCity(loc);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          displayNames.push(loc.length <= 4 ? loc : loc.replace(/\b\w/g, c => c.toUpperCase()));
        }
      }

      if (displayNames.length === 1 && hasTransit) {
        const prevDayDeparture = getPreviousDayLocation(dateKey, availabilityMap, homeCity);
        if (prevDayDeparture) {
          const prevNorm = normalizeCity(prevDayDeparture);
          const currentNorm = normalizeCity(displayNames[0]);
          if (prevNorm && currentNorm && prevNorm !== currentNorm) {
            const prevDisplay = prevDayDeparture.length <= 4 ? prevDayDeparture : prevDayDeparture.replace(/\b\w/g, c => c.toUpperCase());
            return { label: `${prevDisplay} → ${displayNames[0]}`, isSplit: true, isAway };
          }
        }
      }

      if (displayNames.length > 1) {
        return { label: displayNames.join(' → '), isSplit: true, isAway };
      }
    }
  }

  if (avail?.tripLocation || isAway) {
    const currentLoc = avail?.tripLocation || null;
    const currentNorm = currentLoc ? normalizeCity(currentLoc) : (homeCity ? normalizeCity(homeCity) : '');

    const prevLoc = getPreviousDayLocation(dateKey, availabilityMap, homeCity);
    const prevNorm = prevLoc ? normalizeCity(prevLoc) : '';

    const nextLoc = getNextDayLocation(dateKey, availabilityMap, homeCity);
    const nextNorm = nextLoc ? normalizeCity(nextLoc) : '';

    const arrivedToday = prevNorm && currentNorm && prevNorm !== currentNorm;
    const leavingToday = nextNorm && currentNorm && nextNorm !== currentNorm;

    if (currentLoc && arrivedToday && leavingToday) {
      const prevDisplay = formatCity(prevLoc || '');
      const currentDisplay = formatCity(currentLoc);
      const nextDisplay = formatCity(nextLoc || '');
      return { label: `${prevDisplay} → ${currentDisplay} → ${nextDisplay}`, isSplit: true, isAway };
    }

    if (currentLoc && arrivedToday && !leavingToday) {
      const prevDisplay = formatCity(prevLoc || '');
      const currentDisplay = formatCity(currentLoc);
      return { label: `${prevDisplay} → ${currentDisplay}`, isSplit: true, isAway };
    }
  }

  if (!isAway && !avail?.tripLocation) {
    // No transition to show
  }

  if (isAway && avail?.tripLocation) {
    return { label: avail.tripLocation, isSplit: false, isAway: true };
  }
  if (homeCity) {
    return { label: homeCity, isSplit: false, isAway: false };
  }
  return null;
}

// Map time slots to approximate hour ranges
export const TIME_SLOT_HOURS: Record<string, { start: number; end: number }> = {
  'early-morning': { start: 6, end: 9 },
  'late-morning': { start: 9, end: 12 },
  'early-afternoon': { start: 12, end: 15 },
  'late-afternoon': { start: 15, end: 18 },
  'evening': { start: 18, end: 22 },
  'late-night': { start: 22, end: 26 },
};

export function getPlanTimeStatus(plan: Plan): 'past' | 'live' | 'upcoming' {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const planDate = new Date(plan.date);
  const planDay = new Date(planDate.getFullYear(), planDate.getMonth(), planDate.getDate());

  if (planDay > today) return 'upcoming';
  if (planDay < today) return 'past';

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const slot = TIME_SLOT_HOURS[plan.timeSlot];
  if (!slot) return 'upcoming';

  if (plan.startTime) {
    const [sh, sm] = plan.startTime.split(':').map(Number);
    const startH = sh + sm / 60;
    const endH = plan.endTime
      ? (() => { const [eh, em] = plan.endTime!.split(':').map(Number); return eh + em / 60; })()
      : startH + plan.duration / 60;
    if (currentHour < startH) return 'upcoming';
    if (currentHour >= startH && currentHour < endH) return 'live';
    return 'past';
  }

  if (currentHour < slot.start) return 'upcoming';
  if (currentHour >= slot.start && currentHour < slot.end) return 'live';
  return 'past';
}

export function computeInitialOrder(plans: Plan[]): number[] {
  const statuses = plans.map((p, i) => ({ i, status: getPlanTimeStatus(p) }));
  const live = statuses.filter(s => s.status === 'live').map(s => s.i);
  const upcoming = statuses.filter(s => s.status === 'upcoming').map(s => s.i);
  const past = statuses.filter(s => s.status === 'past').map(s => s.i);
  return [...live, ...upcoming, ...past];
}
