import { AvailabilityGrid } from '@/components/availability/AvailabilityGrid';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { Button } from '@/components/ui/button';
import { Share2, RefreshCw, Loader2 } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';

export default function Availability() {
  const { isConnected, isSyncing, syncCalendar } = useGoogleCalendar();
  const loadAllData = usePlannerStore((s) => s.loadAllData);

  const handleSync = async () => {
    const result = await syncCalendar();
    if (result.synced) {
      toast.success(result.message || 'Calendar synced successfully');
      await loadAllData();
    } else {
      toast.error(result.message || 'Failed to sync calendar');
    }
  };

  return (
    <div className="animate-fade-in space-y-4 md:space-y-8">
      {/* Header - condensed on mobile */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold md:text-2xl">Availability</h1>
          <p className="hidden text-muted-foreground md:block">
            Set when you're free and share with friends
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-2"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Calendar'}</span>
            </Button>
          )}
          <ShareDialog
            trigger={
              <Button size="sm" className="shrink-0 gap-2">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Availability Grid */}
      <AvailabilityGrid />
    </div>
  );
}
