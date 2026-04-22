import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { OnboardingData } from '../OnboardingWizard';
import { Calendar, Check, ExternalLink, Apple } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useNylasCalendar } from '@/hooks/useNylasCalendar';

interface CalendarSyncStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function CalendarSyncStep({ data, updateData }: CalendarSyncStepProps) {
  const { isConnected: googleConnected, connect: connectGoogle } = useGoogleCalendar();
  const { connect: connectNylas, isConnected: appleConnected } = useNylasCalendar();
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isConnectingApple, setIsConnectingApple] = useState(false);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      await connectGoogle();
      updateData({ calendarConnected: true });
    } catch (error) {
      console.error('Error connecting Google Calendar:', error);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleConnectApple = async () => {
    setIsConnectingApple(true);
    try {
      await connectNylas('icloud');
      updateData({ calendarConnected: true });
      // Browser will redirect to Apple/Nylas OAuth
    } catch (error) {
      console.error('Error connecting Apple Calendar:', error);
      setIsConnectingApple(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Calendar className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Sync Your Calendar</h1>
        <p className="text-muted-foreground">
          Automatically sync your busy times so friends know when you're free.
        </p>
      </div>

      <div className="space-y-4">
        {/* Google Calendar */}
        <div className="rounded-xl border border-border bg-card p-5">
          {googleConnected || data.calendarConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Google Calendar Connected</h3>
                <p className="text-xs text-muted-foreground">Syncing your events</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
                  alt="Google"
                  className="h-8 w-8"
                />
                <div>
                  <h3 className="font-medium text-sm">Google Calendar</h3>
                  <p className="text-xs text-muted-foreground">One-click sync with Google</p>
                </div>
              </div>
              <Button
                onClick={handleConnectGoogle}
                disabled={isConnectingGoogle}
                variant="outline"
                className="w-full gap-2"
                size="sm"
              >
                {isConnectingGoogle ? 'Connecting...' : 'Connect Google Calendar'}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Apple Calendar */}
        <div className="rounded-xl border border-border bg-card p-5">
          {appleConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Apple Calendar Connected</h3>
                <p className="text-xs text-muted-foreground">Syncing your events</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
                  <Apple className="h-5 w-5 text-background" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Apple Calendar</h3>
                  <p className="text-xs text-muted-foreground">One-click sync with iCloud</p>
                </div>
              </div>
              <Button
                onClick={handleConnectApple}
                disabled={isConnectingApple}
                variant="outline"
                className="w-full gap-2"
                size="sm"
              >
                {isConnectingApple ? 'Opening Apple…' : 'Connect Apple Calendar'}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <span className="text-sm">🔒</span>
          <p className="text-xs text-muted-foreground">
            Friends only see that you're busy, never your event details.
          </p>
        </div>
      </div>
    </div>
  );
}
