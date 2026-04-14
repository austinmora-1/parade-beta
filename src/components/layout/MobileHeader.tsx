import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useFeedback } from '@/components/feedback/FeedbackContext';
import { useConversations } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { cn } from '@/lib/utils';

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
      {/* Left: avatar → profile */}
      <button
        onClick={() => navigate('/profile')}
        className="flex h-8 w-8 items-center justify-center"
        aria-label="My profile"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
          <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
            {getInitials(profile?.display_name)}
          </AvatarFallback>
        </Avatar>
      </button>

      {/* Center: wordmark */}
      <div className="flex-1 flex items-center justify-center">
        <Link to="/" className="flex items-center justify-center leading-none">
          <ParadeWordmark size="md" className="leading-none" />
        </Link>
      </div>

      {/* Right: feedback + inbox bell */}
      <div className="flex items-center gap-1">
        <button
          onClick={openFeedback}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
          aria-label="Send feedback"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1a6 6 0 0 1-6 6H9l-4 3v-3a6 6 0 0 1-1-3v-4Z" />
            <path d="M14 7h1a6 6 0 0 1 6 6v1a6 6 0 0 1-1 3v3l-4-3h-1" />
          </svg>
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
