import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import posthog from 'posthog-js';

function reportWebVital(metric: { name: string; value: number; rating: string; delta: number; navigationType: string }) {
  try {
    posthog.capture('web_vital', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
    });
  } catch {
    // Silently fail — observability should never break the app
  }
}

export function initWebVitals() {
  onCLS(reportWebVital);
  onINP(reportWebVital);
  onLCP(reportWebVital);
  onFCP(reportWebVital);
  onTTFB(reportWebVital);
}
