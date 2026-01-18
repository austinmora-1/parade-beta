import { Link } from 'react-router-dom';
import { Settings, Bell } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import paradeLogo from '@/assets/parade-logo.png';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';

export function MobileHeader() {
  const { totalNotifications } = useNotifications();
  const { profile } = useCurrentUserProfile();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-lg md:hidden">
      <Link to="/" className="flex items-center gap-2">
        <img src={paradeLogo} alt="Parade" className="h-8 w-8 rounded-lg" />
        <ParadeWordmark size="sm" />
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
        <Link
          to="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
            <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
              {getInitials(profile?.display_name)}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
