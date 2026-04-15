import { Link, useNavigate } from 'react-router-dom';
import { Bell, MessagesSquare } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useFeedback } from '@/components/feedback/FeedbackContext';
import { useConversations } from '@/hooks/useChat';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getTimezoneAbbreviation } from '@/lib/timezone';

export function MobileHeader() {
  const { openFeedback } = useFeedback();
  const { totalNotifications } = useNotifications();
  const { conversations } = useConversations();
  const { profile } = useCurrentUserProfile();
  const navigate = useNavigate();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const unreadChats = conversations.filter(c => c.unread_count > 0).length;
  // Inbox badge = notifications + unread chat messages
  const inboxCount = totalNotifications + unreadChats;

  return (
    <header className="sticky top-0 z-40 flex h-[64px] items-center border-b border-sidebar-border bg-sidebar px-4 md:hidden">
      {/* Left: avatar + status */}
      <div className="flex items-center gap-2 min-w-0" style={{ width: 'auto' }}>
        <button
          onClick={() => navigate('/profile')}
          className="flex h-8 w-8 items-center justify-center shrink-0"
          aria-label="My profile"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
            <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
              {getInitials(profile?.display_name)}
            </AvatarFallback>
          </Avatar>
        </button>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[11px] font-medium text-sidebar-foreground capitalize truncate">
            📍 {profile?.location_status === 'away' ? 'Away' : 'Home'}
          </span>
          <span className="text-[10px] text-sidebar-foreground/60 truncate">
            {getTimezoneAbbreviation(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)}
          </span>
        </div>
      </div>

      {/* Center: wordmark */}
      <div className="flex-1 flex items-center justify-center">
        <Link to="/" className="flex items-center justify-center leading-none">
          <ParadeWordmark size="md" className="leading-none" />
        </Link>
      </div>

      {/* Right: feedback + inbox bell */}
      <div className="w-[72px] flex items-center justify-end gap-1">
        <button
          onClick={openFeedback}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
          aria-label="Send feedback"
        >
          <MessagesSquare className="h-[18px] w-[18px]" />
        </button>
        <Link
          to="/notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
          aria-label="Inbox"
        >
          <Bell className="h-[18px] w-[18px]" />
          {inboxCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {inboxCount > 9 ? '9+' : inboxCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
