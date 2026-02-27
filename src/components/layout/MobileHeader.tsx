import { Link } from 'react-router-dom';
import { Bell, MessageSquareMore } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { useFeedback } from '@/components/feedback/FeedbackContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function MobileHeader() {
  const { totalNotifications } = useNotifications();
  const { openFeedback } = useFeedback();

  return (
    <header className="sticky top-0 z-40 flex h-[60px] items-center border-b border-sidebar-border bg-sidebar px-4 md:hidden">
      <div className="flex-1 flex justify-start">
        <button
          onClick={openFeedback}
           className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
         >
           <MessageSquareMore className="h-[18px] w-[18px]" />
        </button>
      </div>
      <Link to="/" className="flex items-center justify-center leading-none">
        <ParadeWordmark size="md" className="leading-none" />
      </Link>
      <div className="flex-1 flex justify-end gap-1">
        <div className="[&_button]:text-sidebar-foreground/80 [&_button:hover]:text-sidebar-foreground [&_button:hover]:bg-sidebar-accent">
          <ThemeToggle />
        </div>
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
      </div>
    </header>
  );
}
