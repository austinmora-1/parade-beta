import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { MobileHeader } from './MobileHeader';
import { useFriendRequestNotifications } from '@/hooks/useFriendRequestNotifications';

export function AppLayout() {
  // Listen for real-time friend request notifications
  useFriendRequestNotifications();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileHeader />
      <main className="min-h-screen md:ml-64">
        <div className="p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
