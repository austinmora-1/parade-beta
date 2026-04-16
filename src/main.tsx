import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/webVitals";

const RECOVERY_STORAGE_KEY = "parade:asset-recovery";
const RECOVERY_WINDOW_MS = 15_000;

function getErrorMessage(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof Error) return input.message;
  if (typeof input === "object" && input && "message" in input) {
    const message = (input as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function isRecoverableAssetError(input: unknown): boolean {
  const message = getErrorMessage(input).toLowerCase();

  return [
    "failed to fetch dynamically imported module",
    "importing a module script failed",
    "failed to load module script",
    "chunkloaderror",
    "loading chunk",
    "vite:preloaderror",
  ].some((token) => message.includes(token));
}

function recentlyRecovered(): boolean {
  try {
    const raw = window.sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { path?: string; at?: number };
    const samePath = parsed.path === window.location.pathname;
    const fresh = typeof parsed.at === "number" && Date.now() - parsed.at < RECOVERY_WINDOW_MS;

    if (samePath && fresh) return true;

    window.sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
}

function recoverFromAssetError() {
  if (recentlyRecovered()) return;

  try {
    window.sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({ path: window.location.pathname, at: Date.now() }),
    );

    const url = new URL(window.location.href);
    url.searchParams.set("__reload", Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

const url = new URL(window.location.href);
if (url.searchParams.has("__reload")) {
  url.searchParams.delete("__reload");
  window.history.replaceState({}, "", url.toString());
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromAssetError();
});

window.addEventListener("error", (event) => {
  if (isRecoverableAssetError(event.error ?? event.message)) {
    recoverFromAssetError();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (isRecoverableAssetError(event.reason)) {
    event.preventDefault();
    recoverFromAssetError();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

setTimeout(() => {
  try {
    posthog.init("phc_nqp6cbPNVp6WBuxy0iLcqzMxfWEq3sBMjYNUWnQT3sf", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
    });
    initWebVitals();
  } catch (error) {
    console.error("[startup] analytics init failed", error);
  }
}, 0);
