import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Home, Plane } from 'lucide-react';

export function LocationToggle() {
  const { locationStatus, setLocationStatus } = usePlannerStore();
  const isHome = locationStatus === 'home';

  const toggle = () => setLocationStatus(isHome ? 'away' : 'home');

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border",
        isHome
          ? "border-availability-available/40 bg-availability-available/10 text-availability-available"
          : "border-primary/40 bg-primary/10 text-primary"
      )}
    >
      {isHome ? (
        <Home className="h-3.5 w-3.5" />
      ) : (
        <Plane className="h-3.5 w-3.5" />
      )}
      <span>{isHome ? 'Home' : 'Away'}</span>
    </button>
  );
}
