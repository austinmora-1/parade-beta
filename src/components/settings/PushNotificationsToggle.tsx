import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationsToggle() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">Push Notifications</p>
          <p className="text-[10px] text-muted-foreground">Not supported on this browser</p>
        </div>
        <Switch disabled checked={false} />
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">Push Notifications</p>
          <p className="text-[10px] text-muted-foreground">Blocked — enable in browser settings</p>
        </div>
        <Switch disabled checked={false} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium">Push Notifications</p>
        <p className="text-[10px] text-muted-foreground">
          {isSubscribed ? 'Lock Screen, banner & Notification Center' : 'Enable for real-time alerts'}
        </p>
      </div>
      <Switch
        checked={isSubscribed}
        disabled={isLoading}
        onCheckedChange={(checked) => {
          if (checked) subscribe();
          else unsubscribe();
        }}
      />
    </div>
  );
}
