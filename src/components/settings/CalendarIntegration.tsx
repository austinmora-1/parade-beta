import { Calendar, Check, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAuth } from '@/hooks/useAuth';

export function CalendarIntegration() {
  const { session } = useAuth();
  const { isConnected, isLoading, connect, disconnect } = useGoogleCalendar();

  if (!session) {
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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Calendar Integration</h2>
      </div>

      <div className="space-y-4">
        {/* Google Calendar */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-6 w-6">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <p className="font-medium">Google Calendar</p>
              <p className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Sync your events and availability'}
              </p>
            </div>
          </div>
          
          {isLoading ? (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : isConnected ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Connected
              </span>
              <Button variant="outline" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button onClick={connect} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Connect
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Connecting your calendar allows Parade to sync your events and help coordinate plans with friends.
        </p>
      </div>
    </div>
  );
}
