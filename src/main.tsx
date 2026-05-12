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

// Auto-recover from stale lazy-chunk references after a redeploy.
// When the bundle hash changes, old <App /> references chunks that 404 →
// "Importing a module script failed". Reload once to pick up the new index.
const CHUNK_RELOAD_KEY = 'parade-chunk-reload-at';
function isChunkLoadError(msg: unknown): boolean {
  const s = String(msg ?? '');
  return /Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(s);
}
function maybeReloadForStaleChunk(reason: unknown) {
  if (!isChunkLoadError(reason)) return;
  try {
    const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10);
    if (Date.now() - last < 10_000) return; // avoid reload loops
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch { /* no-op */ }
  window.location.reload();
}
window.addEventListener('error', (e) => maybeReloadForStaleChunk(e?.message));
window.addEventListener('unhandledrejection', (e) => maybeReloadForStaleChunk((e as PromiseRejectionEvent)?.reason?.message));

createRoot(document.getElementById("root")!).render(<App />);

setTimeout(() => {
  posthog.init("phc_nqp6cbPNVp6WBuxy0iLcqzMxfWEq3sBMjYNUWnQT3sf", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
  });
  initWebVitals();
}, 0);
