import { Bell, BellRing, Check, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationsStep() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe } = usePushNotifications();

  const handleEnable = async () => {
    await subscribe();
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <BellRing className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          Stay in the Loop
        </h1>
        <p className="text-muted-foreground">
          Get notified when friends send requests, invite you to plans, or message you.
        </p>
      </div>

      <div className="space-y-4">
        {/* Benefits */}
        <div className="space-y-3">
          {[
            { icon: '🤝', text: 'Friend requests & hangout invites' },
            { icon: '📅', text: 'Plan invitations & updates' },
            { icon: '💬', text: 'New messages from friends' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <span className="text-xl">{item.icon}</span>
              <p className="text-sm font-medium">{item.text}</p>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="pt-2">
          {!isSupported ? (
            <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
              <Smartphone className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Push notifications aren't supported on this browser. Try installing Parade as an app from your home screen!
              </p>
            </div>
          ) : isSubscribed || permission === 'granted' ? (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
              <Check className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-primary">
                Push notifications enabled! 🎉
              </p>
            </div>
          ) : permission === 'denied' ? (
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-center">
              <Bell className="h-5 w-5 mx-auto mb-2 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Notifications are blocked. You can enable them in your browser/device settings.
              </p>
            </div>
          ) : (
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              className="w-full gap-2"
              size="lg"
            >
              <Bell className="h-4 w-4" />
              {isLoading ? 'Enabling...' : 'Enable Push Notifications'}
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          You can change this anytime in Settings.
        </p>
      </div>
    </div>
  );
}
