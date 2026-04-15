import { Link, useNavigate } from 'react-router-dom';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { getTimezoneAbbreviation, getTimezoneForCity } from '@/lib/timezone';
import { useMemo } from 'react';
import { format } from 'date-fns';

export function MobileHeader() {
  const { profile } = useCurrentUserProfile();
  const navigate = useNavigate();
  const { availabilityMap, userTimezone } = usePlannerStore();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Derive current city from today's availability (trip location when away, home address when home)
  const { currentCity, currentTimezone } = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const todayAvail = availabilityMap[todayKey];
    if (todayAvail?.locationStatus === 'away' && todayAvail?.tripLocation) {
      return {
        currentCity: todayAvail.tripLocation.split(',')[0],
        currentTimezone: getTimezoneForCity(todayAvail.tripLocation),
      };
    }
    const homeAddress = profile?.home_address;
    return {
      currentCity: homeAddress?.split(',')[0] || 'Set location',
      currentTimezone: homeAddress ? getTimezoneForCity(homeAddress) : userTimezone,
    };
  }, [availabilityMap, profile?.home_address, userTimezone]);

  return (
    <header className="sticky top-0 z-40 flex h-[64px] items-center border-b border-sidebar-border bg-sidebar px-4 md:hidden">
      {/* Left: avatar + status */}
      <div className="flex items-center gap-2 min-w-0" style={{ width: 'auto' }}>
        <button
          onClick={() => navigate('/profile')}
          className="flex h-8 w-8 items-center justify-center shrink-0"
          aria-label="My profile"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
            <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
              {getInitials(profile?.display_name)}
            </AvatarFallback>
          </Avatar>
        </button>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[11px] font-medium text-sidebar-foreground truncate">
            {currentCity}
          </span>
          <span className="text-[10px] text-sidebar-foreground/60 truncate">
            {getTimezoneAbbreviation(currentTimezone)}
          </span>
        </div>
      </div>

      {/* Center: wordmark */}
      <div className="flex-1 flex items-center justify-center">
        <Link to="/" className="flex items-center justify-center leading-none">
          <ParadeWordmark size="md" className="leading-none" />
        </Link>
      </div>

      {/* Right: spacer to balance layout */}
      <div className="w-8" />
    </header>
  );
}