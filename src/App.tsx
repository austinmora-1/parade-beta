import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePlannerStore } from "@/stores/plannerStore";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";
import Availability from "./pages/Availability";
import Friends from "./pages/Friends";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import FriendProfile from "./pages/FriendProfile";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Invite from "./pages/Invite";
import Share from "./pages/Share";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { setUserId, loadAllData, userId } = usePlannerStore();

  useEffect(() => {
    if (user && user.id !== userId) {
      setUserId(user.id);
      loadAllData();
    } else if (!user && userId) {
      setUserId(null);
    }
  }, [user, userId, setUserId, loadAllData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/share/:shareCode" element={<Share />} />
    <Route path="/invite" element={<Invite />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route
      path="/landing"
      element={
        <PublicRoute>
          <Landing />
        </PublicRoute>
      }
    />
    <Route
      path="/onboarding"
      element={
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      }
    />
    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/" element={<Dashboard />} />
      <Route path="/plans" element={<Plans />} />
      <Route path="/availability" element={<Availability />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/friend/:userId" element={<FriendProfile />} />
      <Route path="/settings" element={<Settings />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={['light', 'dark', 'arcade']}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
