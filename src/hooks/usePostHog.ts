import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import posthog from "posthog-js";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tracks page views on route changes and identifies authenticated users.
 * Place once inside the Router context (e.g. in App or AppRoutes).
 */
export function usePostHogPageView() {
  const location = useLocation();
  const { user } = useAuth();

  // Identify / reset on auth change
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, { email: user.email });
    } else {
      posthog.reset();
    }
  }, [user]);

  // Capture page views on route change
  useEffect(() => {
    posthog.capture("$pageview", {
      $current_url: window.location.href,
    });
  }, [location.pathname]);
}
