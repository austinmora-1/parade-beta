import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/webVitals";

// Phase 1.2 — track sessions for trigger-based prompts (e.g. dark-mode prompt
// only fires after the 3rd distinct session). One increment per calendar day.
try {
  const SESSION_COUNT_KEY = 'parade-session-count';
  const LAST_SESSION_DATE_KEY = 'parade-last-session-date';
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem(LAST_SESSION_DATE_KEY);
  if (lastDate !== today) {
    const current = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10) || 0;
    localStorage.setItem(SESSION_COUNT_KEY, String(current + 1));
    localStorage.setItem(LAST_SESSION_DATE_KEY, today);
  }
} catch {
  /* no-op — localStorage may be unavailable */
}

createRoot(document.getElementById("root")!).render(<App />);

setTimeout(() => {
  posthog.init("phc_nqp6cbPNVp6WBuxy0iLcqzMxfWEq3sBMjYNUWnQT3sf", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
  });
  initWebVitals();
}, 0);
