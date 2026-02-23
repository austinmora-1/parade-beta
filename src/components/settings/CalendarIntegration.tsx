import { Calendar, Check, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CalendarIntegrationProps {
  isEmbedded?: boolean;
}

export function CalendarIntegration({ isEmbedded = false }: CalendarIntegrationProps) {
  const { session } = useAuth();
  const { isConnected, isLoading, isSyncing, lastSyncResult, connect, disconnect, syncCalendar } = useGoogleCalendar();

  const handleSync = async () => {
    const result = await syncCalendar();
    if (result.synced) {
      toast.success(result.message || 'Calendar synced successfully');
    } else {
      toast.error(result.message || 'Failed to sync calendar');
    }
  };

  if (!session) {
    if (isEmbedded) {
      return (
        <p className="text-sm text-muted-foreground">
          Sign in to connect your calendar
        </p>
      );
    }
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Calendar Integration</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign in to connect your calendar
        </p>
      </div>
    );
  }

  const content = (
    <div className="space-y-3">
      {/* Google Calendar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">Google Calendar</p>
            <p className="text-[10px] text-muted-foreground">
              {isConnected ? 'Connected' : 'Sync your events'}
            </p>
          </div>
        </div>
        
        {isLoading ? (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="h-3 w-3 animate-spin" />
          </Button>
        ) : isConnected ? (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <Check className="h-3 w-3" />
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={connect} size="sm" className="h-7 text-xs gap-1.5">
            <ExternalLink className="h-3 w-3" />
            Connect
          </Button>
        )}
      </div>

      {/* Sync Button - only show when connected */}
      {isConnected && (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Sync to Parade</p>
            <p className="text-[10px] text-muted-foreground">
              {lastSyncResult?.synced 
                ? `Last sync: ${lastSyncResult.eventsProcessed} events → ${lastSyncResult.datesUpdated} days`
                : 'Import calendar events to mark busy times'
              }
            </p>
          </div>
          <Button 
            onClick={handleSync} 
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
          >
            {isSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Syncing imports your calendar events and marks those times as busy in Parade.
      </p>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Calendar Integration</h2>
      </div>
      {content}
    </div>
  );
}
