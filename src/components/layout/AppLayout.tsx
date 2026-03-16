import { useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { MobileHeader } from './MobileHeader';
import { PullToRefresh } from './PullToRefresh';
import { FeedbackProvider, useFeedback } from '@/components/feedback/FeedbackContext';
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel';
import { FloatingFeedbackButton } from '@/components/feedback/FloatingFeedbackButton';
import { useFriendRequestNotifications } from '@/hooks/useFriendRequestNotifications';
import { usePlannerStore } from '@/stores/plannerStore';

function FeedbackTrigger() {
  const { openFeedback } = useFeedback();
  return (
    <button
      onClick={openFeedback}
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex md:hidden h-10 w-10 items-center justify-center rounded-full bg-card border border-border shadow-soft transition-transform active:scale-90"
      aria-label="Send feedback"
    >
      <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function AppLayout() {
  // Listen for real-time friend request notifications
  useFriendRequestNotifications();
  const queryClient = useQueryClient();
  const forceRefresh = usePlannerStore((s) => s.forceRefresh);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(),
      forceRefresh(),
    ]);
  }, [queryClient, forceRefresh]);
  return (
    <FeedbackProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileHeader />
        <main className="min-h-screen md:ml-56">
          <PullToRefresh onRefresh={handleRefresh}>
            <div className="p-4 pb-24 md:p-8 md:pb-8">
              <Outlet />
            </div>
          </PullToRefresh>
        </main>
        <MobileNav />
        <FloatingFeedbackButton />
        <FeedbackTrigger />
        <FeedbackPanel />
      </div>
    </FeedbackProvider>
  );
}
