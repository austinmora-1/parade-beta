import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { OnboardingData } from '../OnboardingWizard';
import { Calendar, Check, ExternalLink } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

interface CalendarStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function CalendarStep({ data, updateData }: CalendarStepProps) {
  const { isConnected, isLoading, connect } = useGoogleCalendar();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
      updateData({ calendarConnected: true });
    } catch (error) {
      console.error('Error connecting calendar:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          Connect Your Calendar
        </h1>
        <p className="text-muted-foreground">
          Automatically sync your busy times from Google Calendar.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {isConnected || data.calendarConnected ? (
          <div className="text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-medium mb-1">Calendar Connected!</h3>
            <p className="text-sm text-muted-foreground">
              Your Google Calendar is synced with Parade.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <img 
                src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" 
                alt="Google" 
                className="h-12 w-12"
              />
            </div>
            <h3 className="font-medium mb-2">Google Calendar</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We'll read your calendar to know when you're busy. We never modify your events.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                'Connecting...'
              ) : (
                <>
                  Connect Calendar
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
          <span className="text-lg">🔒</span>
          <p className="text-sm text-muted-foreground">
            Your calendar data is encrypted and never shared with other users.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
          <span className="text-lg">⏰</span>
          <p className="text-sm text-muted-foreground">
            Friends only see that you're busy, not what you're doing.
          </p>
        </div>
      </div>
    </div>
  );
}
