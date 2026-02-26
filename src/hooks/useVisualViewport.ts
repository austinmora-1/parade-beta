import { useState, useEffect } from 'react';

interface VisualViewportState {
  height: number;
  offsetTop: number;
}

/**
 * Tracks viewport size/offset to account for mobile keyboards.
 * Falls back to window.innerHeight when visualViewport is unavailable.
 */
export function useVisualViewport() {
  const [viewport, setViewport] = useState<VisualViewportState | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;

    const updateFromVisualViewport = () => {
      if (!vv) return;
      setViewport({
        height: vv.height,
        offsetTop: vv.offsetTop || 0,
      });
    };

    const updateFromWindow = () => {
      setViewport({
        height: window.innerHeight,
        offsetTop: 0,
      });
    };

    if (vv) {
      updateFromVisualViewport();
      vv.addEventListener('resize', updateFromVisualViewport);
      vv.addEventListener('scroll', updateFromVisualViewport);
      window.addEventListener('resize', updateFromVisualViewport);

      return () => {
        vv.removeEventListener('resize', updateFromVisualViewport);
        vv.removeEventListener('scroll', updateFromVisualViewport);
        window.removeEventListener('resize', updateFromVisualViewport);
      };
    }

    updateFromWindow();
    window.addEventListener('resize', updateFromWindow);
    return () => {
      window.removeEventListener('resize', updateFromWindow);
    };
  }, []);

  return viewport;
}

