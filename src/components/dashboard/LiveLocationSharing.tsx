import { useLiveLocation } from '@/hooks/useLiveLocation';
import { usePlannerStore } from '@/stores/plannerStore';
import { MapPin, Navigation, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export function LiveLocationSharing() {
  const { isSharing, isLoading, friendLocations, startSharing, stopSharing } = useLiveLocation();
  const { friends } = usePlannerStore();

  const handleToggle = async () => {
    if (isSharing) {
      await stopSharing();
      toast.success('Location sharing stopped');
    } else {
      const success = await startSharing();
      if (success) {
        toast.success('Sharing your location with friends for 8 hours');
      } else {
        toast.error('Could not access your location. Check browser permissions.');
      }
    }
  };

  const friendNameMap = Object.fromEntries(
    friends.filter(f => f.friendUserId).map(f => [f.friendUserId, f])
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Live Location</h3>
        </div>
        <Button
          variant={isSharing ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "gap-1.5 h-7 text-xs",
            isSharing && "bg-primary"
          )}
          onClick={handleToggle}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isSharing ? (
            <>
              <X className="h-3 w-3" /> Stop Sharing
            </>
          ) : (
            <>
              <MapPin className="h-3 w-3" /> Share Location
            </>
          )}
        </Button>
      </div>

      {isSharing && (
        <p className="text-xs text-muted-foreground">
          📍 Your location is visible to friends for 8 hours
        </p>
      )}

      {friendLocations.length > 0 && (
        <div className="space-y-1.5">
          {friendLocations.map((loc) => {
            const friend = friendNameMap[loc.user_id];
            const name = friend?.name || 'Friend';
            const avatar = friend?.avatar;
            const timeAgo = formatDistanceToNow(new Date(loc.updated_at), { addSuffix: true });

            return (
              <a
                key={loc.user_id}
                href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2",
                  "hover:bg-muted/80 transition-colors cursor-pointer"
                )}
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-[10px] text-muted-foreground">{loc.label || 'Sharing location'} · {timeAgo}</p>
                </div>
                <Navigation className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
