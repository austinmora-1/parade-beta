import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Home, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LocationToggle() {
  const { locationStatus, setLocationStatus } = usePlannerStore();
  const isHome = locationStatus === 'home';

  const toggle = () => setLocationStatus(isHome ? 'away' : 'home');

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className={cn(
        "gap-1.5 transition-colors font-semibold",
        isHome
          ? "border-availability-available bg-availability-available/15 text-availability-available hover:bg-availability-available/25"
          : "border-muted-foreground/40 text-muted-foreground hover:bg-muted"
      )}
    >
      {isHome ? (
        <Home className="h-4 w-4" />
      ) : (
        <Plane className="h-4 w-4" />
      )}
      {isHome ? 'Home' : 'Away'}
    </Button>
  );
}
