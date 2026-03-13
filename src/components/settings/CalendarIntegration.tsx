import { useState } from 'react';
import { Calendar, Check, Loader2, ExternalLink, RefreshCw, Apple, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAppleCalendar } from '@/hooks/useAppleCalendar';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';

interface CalendarIntegrationProps {
  isEmbedded?: boolean;
}

export function CalendarIntegration({ isEmbedded = false }: CalendarIntegrationProps) {
  const { session } = useAuth();
  const { isConnected: googleConnected, isLoading: googleLoading, isSyncing: googleSyncing, lastSyncResult: googleLastSync, connect: googleConnect, disconnect: googleDisconnect, syncCalendar: googleSync } = useGoogleCalendar();
  const { isConnected: icalConnected, isLoading: icalLoading, isSyncing: icalSyncing, isConnecting: icalConnecting, lastSyncResult: icalLastSync, connect: icalConnect, disconnect: icalDisconnect, syncCalendar: icalSync, error: icalError } = useAppleCalendar();
  const loadPlans = usePlannerStore((s) => s.loadPlans);
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);

  const [icalUrl, setIcalUrl] = useState('');
  const [showIcalInput, setShowIcalInput] = useState(false);

  const handleGoogleSync = async () => {
    const result = await googleSync();
    if (result.synced) {
      toast.success(result.message || 'Calendar synced successfully');
      await Promise.all([loadPlans(), loadProfileAndAvailability()]);
    } else {
      toast.error(result.message || 'Failed to sync calendar');
    }
  };

  const handleIcalConnect = async () => {
    if (!icalUrl.trim()) {
      toast.error('Please enter an iCal URL');
      return;
    }
    const result = await icalConnect(icalUrl.trim());
    if (result?.success) {
      toast.success('Apple Calendar connected!');
      setIcalUrl('');
      setShowIcalInput(false);
      // Auto-sync after connecting
      const syncResult = await icalSync();
      if (syncResult.synced) {
        toast.success(syncResult.message || 'Calendar synced');
        await Promise.all([loadPlans(), loadProfileAndAvailability()]);
      }
    } else {
      toast.error(result?.error || 'Failed to connect');
    }
  };

  const handleIcalSync = async () => {
    const result = await icalSync();
    if (result.synced) {
      toast.success(result.message || 'Calendar synced successfully');
      await loadAllData();
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
              {googleConnected ? 'Connected' : 'Sync your events'}
            </p>
          </div>
        </div>
        
        {googleLoading ? (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="h-3 w-3 animate-spin" />
          </Button>
        ) : googleConnected ? (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <Check className="h-3 w-3" />
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the connection to your Google Calendar. Your synced busy times will no longer update automatically.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={googleDisconnect}>Disconnect</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button onClick={googleConnect} size="sm" className="h-7 text-xs gap-1.5">
            <ExternalLink className="h-3 w-3" />
            Connect
          </Button>
        )}
      </div>

      {/* Google Sync Button */}
      {googleConnected && (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Sync Google Calendar</p>
            <p className="text-[10px] text-muted-foreground">
              {googleLastSync?.synced 
                ? `Last sync: ${googleLastSync.eventsProcessed} events → ${googleLastSync.datesUpdated} days`
                : 'Import calendar events to mark busy times'
              }
            </p>
          </div>
          <Button 
            onClick={handleGoogleSync} 
            disabled={googleSyncing}
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
          >
            {googleSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {googleSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      )}

      {/* Apple Calendar (iCal) */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-red-500 to-red-600 shadow-sm">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium">Apple Calendar</p>
            <p className="text-[10px] text-muted-foreground">
              {icalConnected ? 'Connected via iCal URL' : 'Import via subscription URL'}
            </p>
          </div>
        </div>

        {icalLoading ? (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="h-3 w-3 animate-spin" />
          </Button>
        ) : icalConnected ? (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <Check className="h-3 w-3" />
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Apple Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the connection to your Apple Calendar. Your synced busy times will no longer update automatically.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={icalDisconnect}>Disconnect</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button onClick={() => setShowIcalInput(!showIcalInput)} size="sm" className="h-7 text-xs gap-1.5">
            <Link className="h-3 w-3" />
            Connect
          </Button>
        )}
      </div>

      {/* iCal URL Input */}
      {showIcalInput && !icalConnected && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Paste your iCal subscription URL from Apple Calendar. Find it in Calendar app → Settings → Accounts → your calendar → copy the subscription URL.
          </p>
          <div className="flex gap-2">
            <Input
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              placeholder="https://p##-caldav.icloud.com/..."
              className="h-8 text-xs flex-1"
            />
            <Button
              onClick={handleIcalConnect}
              disabled={icalConnecting || !icalUrl.trim()}
              size="sm"
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              {icalConnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
          {icalError && (
            <p className="text-[10px] text-destructive">{icalError}</p>
          )}
        </div>
      )}

      {/* iCal Sync Button */}
      {icalConnected && (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Sync Apple Calendar</p>
            <p className="text-[10px] text-muted-foreground">
              {icalLastSync?.synced
                ? `Last sync: ${icalLastSync.eventsProcessed} events → ${icalLastSync.datesUpdated} days`
                : 'Import iCal events to mark busy times'
              }
            </p>
          </div>
          <Button
            onClick={handleIcalSync}
            disabled={icalSyncing}
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
          >
            {icalSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {icalSyncing ? 'Syncing...' : 'Sync Now'}
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
