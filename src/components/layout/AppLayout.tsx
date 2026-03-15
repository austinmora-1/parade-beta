import { useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { MobileHeader } from './MobileHeader';
import { PullToRefresh } from './PullToRefresh';
import { FeedbackProvider } from '@/components/feedback/FeedbackContext';
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel';
import { FloatingFeedbackButton } from '@/components/feedback/FloatingFeedbackButton';
import { useFriendRequestNotifications } from '@/hooks/useFriendRequestNotifications';
import { usePlannerStore } from '@/stores/plannerStore';

export function AppLayout() {
  // Listen for real-time friend request notifications
  useFriendRequestNotifications();
  const queryClient = useQueryClient();
  const loadAllData = usePlannerStore((s) => s.loadAllData);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(),
      loadAllData(),
    ]);
  }, [queryClient, loadAllData]);
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
        <FeedbackPanel />
      </div>
    </FeedbackProvider>
  );
}
