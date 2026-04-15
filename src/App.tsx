import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { usePlannerStore } from "@/stores/plannerStore";
const Dashboard = lazy(() => import("./pages/Dashboard"));

import Availability from "./pages/Availability";
import Friends from "./pages/Friends";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import FriendProfile from "./pages/FriendProfile";
import PlanInvite from "./pages/PlanInvite";
import NotFound from "./pages/NotFound";
import Invite from "./pages/Invite";
import Share from "./pages/Share";
import ResetPassword from "./pages/ResetPassword";
import { usePostHogPageView } from "@/hooks/usePostHog";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const PlanDetail = lazy(() => import("./pages/PlanDetail"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const Trips = lazy(() => import("./pages/Trips"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));

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
    return <Navigate to="/login" replace />;
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

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const AppRoutes = () => {
  usePostHogPageView();
  return (
  <Suspense fallback={<LazyFallback />}>
  <Routes>
    <Route path="/share/:shareCode" element={<Share />} />
    <Route path="/invite" element={<Invite />} />
    <Route path="/plan-invite/:token" element={<PlanInvite />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/google-callback" element={<GoogleCallback />} />
    <Route
      path="/login"
      element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      }
    />
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
      <Route path="/" element={<ErrorBoundary scope="Dashboard"><Dashboard /></ErrorBoundary>} />
      
      <Route path="/availability" element={<ErrorBoundary scope="Availability"><Availability /></ErrorBoundary>} />
      <Route path="/friends" element={<ErrorBoundary scope="Friends"><Friends /></ErrorBoundary>} />
      <Route path="/chat" element={<ErrorBoundary scope="Chat"><Chat /></ErrorBoundary>} />
      <Route path="/notifications" element={<ErrorBoundary scope="Notifications"><Notifications /></ErrorBoundary>} />
      <Route path="/profile" element={<ErrorBoundary scope="Profile"><Profile /></ErrorBoundary>} />
      <Route path="/friend/:userId" element={<ErrorBoundary scope="FriendProfile"><FriendProfile /></ErrorBoundary>} />
      <Route path="/plan/:planId" element={<ErrorBoundary scope="PlanDetail"><PlanDetail /></ErrorBoundary>} />
      <Route path="/trips" element={<ErrorBoundary scope="Trips"><Trips /></ErrorBoundary>} />
      <Route path="/trip/:tripId" element={<ErrorBoundary scope="TripDetail"><TripDetail /></ErrorBoundary>} />
      <Route path="/settings" element={<ErrorBoundary scope="Settings"><Settings /></ErrorBoundary>} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
  </Suspense>
  );
};

const App = () => (
  <ErrorBoundary scope="Root">
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={['light', 'dark']}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
