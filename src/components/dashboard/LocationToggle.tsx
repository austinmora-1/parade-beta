import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Home, Plane } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function LocationToggle() {
  const { locationStatus, setLocationStatus } = usePlannerStore();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Location</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setLocationStatus('home')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all",
                locationStatus === 'home'
                  ? "bg-availability-available text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground"
              )}
            >
              <Home className="h-3.5 w-3.5" />
              Home
            </button>
            <button
              onClick={() => setLocationStatus('away')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all",
                locationStatus === 'away'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground"
              )}
            >
              <Plane className="h-3.5 w-3.5" />
              Away
            </button>
          </div>
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
