import { Link } from 'react-router-dom';
import { Bell, MessageSquarePlus } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { useFeedback } from '@/components/feedback/FeedbackContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function MobileHeader() {
  const { totalNotifications } = useNotifications();
  const { openFeedback } = useFeedback();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-primary/20 bg-[hsl(150_22%_18%)] px-4 md:hidden">
      <div className="flex-1 flex justify-start">
        <button
          onClick={openFeedback}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:text-primary-foreground"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
      </div>
      <Link to="/" className="flex items-center justify-center leading-none">
        <ParadeWordmark size="md" className="leading-none" />
      </Link>
      <div className="flex-1 flex justify-end gap-1">
        <div className="[&_button]:text-primary-foreground/80 [&_button:hover]:text-primary-foreground [&_button:hover]:bg-white/10">
          <ThemeToggle />
        </div>
        <Link
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:text-primary-foreground"
        >
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {totalNotifications}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
