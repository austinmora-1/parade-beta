import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/webVitals";

createRoot(document.getElementById("root")!).render(<App />);

setTimeout(() => {
  posthog.init("phc_nqp6cbPNVp6WBuxy0iLcqzMxfWEq3sBMjYNUWnQT3sf", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
  });
  initWebVitals();
}, 0);
