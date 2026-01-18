import { Link } from 'react-router-dom';
import { Settings, Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';

export function MobileHeader() {
  const { totalNotifications } = useNotifications();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur-lg md:hidden">
      <div className="flex-1" />
      <Link to="/" className="flex items-center justify-center">
        <ParadeWordmark size="sm" />
      </Link>
      <div className="flex-1 flex justify-end gap-1">
        <Link
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {totalNotifications}
            </span>
          )}
        </Link>
        <Link
          to="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
