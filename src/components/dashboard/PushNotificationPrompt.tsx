import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const STORAGE_KEY = 'parade_push_prompted';

export function PushNotificationPrompt() {
  const [open, setOpen] = useState(false);
  const { isSupported, permission, isSubscribed, subscribe, isLoading } = usePushNotifications();

  useEffect(() => {
    // Don't show if: not supported, already subscribed, already prompted, or already denied
    if (!isSupported || isSubscribed || permission === 'denied') return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Small delay so the dashboard loads first
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission]);

  const handleEnable = async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    await subscribe();
    setOpen(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Bell className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Stay in the loop</DialogTitle>
          <DialogDescription className="text-center">
            Get notified about friend requests, plan invitations, hang requests, and new messages — even when the app is closed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleEnable} disabled={isLoading} className="w-full">
            {isLoading ? 'Enabling…' : 'Enable Notifications'}
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full text-muted-foreground">
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
