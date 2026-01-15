import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="min-h-screen md:ml-64">
        <div className="p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
