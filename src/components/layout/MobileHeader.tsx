import { Link } from 'react-router-dom';
import { Settings, Bell } from 'lucide-react';
import paradeLogo from '@/assets/parade-logo.png';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export function MobileHeader() {
  const { totalNotifications } = useNotifications();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-lg md:hidden">
      <Link to="/" className="flex items-center gap-2">
        <img src={paradeLogo} alt="Parade" className="h-8 w-8 rounded-lg" />
        <span className="font-display text-lg font-bold">Parade</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
