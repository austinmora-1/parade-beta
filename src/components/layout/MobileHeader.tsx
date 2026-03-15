import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, MessageSquareMore } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useFeedback } from '@/components/feedback/FeedbackContext';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { cn } from '@/lib/utils';

export function MobileHeader() {
  const { totalNotifications } = useNotifications();
  const { openFeedback } = useFeedback();
  const { profile } = useCurrentUserProfile();
  const location = useLocation();
  const isProfileActive = location.pathname === '/profile';

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 flex h-[60px] items-center border-b border-sidebar-border bg-sidebar px-4 md:hidden">
      <div className="flex-1 flex items-center justify-start gap-0">
        <button
          onClick={openFeedback}
          className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
          aria-label="Send feedback"
        >
          <MessageSquareMore className="h-[18px] w-[18px]" />
        </button>
        <Link
          to="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Link>
      </div>
      <Link to="/" className="flex items-center justify-center leading-none">
        <ParadeWordmark size="md" className="leading-none" />
      </Link>
      <div className="flex-1 flex items-center justify-end gap-0">
        <Link
          to="/notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {totalNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {totalNotifications}
            </span>
          )}
        </Link>
        <Link
          to="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-md"
        >
          <Avatar
            className={cn(
              'h-6 w-6 transition-all duration-200',
              isProfileActive && 'ring-2 ring-sidebar-primary ring-offset-1 ring-offset-sidebar'
            )}
          >
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
            <AvatarFallback className="bg-primary/15 text-[8px] font-semibold text-primary">
              {getInitials(profile?.display_name)}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
