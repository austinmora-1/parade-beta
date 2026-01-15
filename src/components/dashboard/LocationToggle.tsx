import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Home, Plane } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Switch } from '@/components/ui/switch';

export function LocationToggle() {
  const { locationStatus, setLocationStatus } = usePlannerStore();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {locationStatus === 'home' ? (
              <Home className="h-4 w-4 text-availability-available" />
            ) : (
              <Plane className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium">
              {locationStatus === 'home' ? 'Home' : 'Away'}
            </span>
          </div>
          <Switch
            checked={locationStatus === 'home'}
            onCheckedChange={(checked) => setLocationStatus(checked ? 'home' : 'away')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="mb-4 font-display text-lg font-semibold">Location Status</h3>
      
      <div className="flex gap-3">
        <button
          onClick={() => setLocationStatus('home')}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl p-4 transition-all duration-200",
            locationStatus === 'home'
              ? "bg-availability-available text-primary-foreground shadow-soft"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Home className="h-5 w-5" />
          <span className="font-medium">Home</span>
        </button>
        
        <button
          onClick={() => setLocationStatus('away')}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl p-4 transition-all duration-200",
            locationStatus === 'away'
              ? "bg-primary text-primary-foreground shadow-soft"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Plane className="h-5 w-5" />
          <span className="font-medium">Away</span>
        </button>
      </div>
    </div>
  );
}
