import { useState, useEffect, useCallback } from 'react';

const ARCADE_KEY = 'parade-arcade-mode';

export function useArcadeMode() {
  const [isArcade, setIsArcade] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ARCADE_KEY) === 'true';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isArcade) {
      root.classList.add('arcade');
    } else {
      root.classList.remove('arcade');
    }
    localStorage.setItem(ARCADE_KEY, String(isArcade));
  }, [isArcade]);

  const toggleArcade = useCallback(() => {
    setIsArcade(prev => !prev);
  }, []);

  return { isArcade, toggleArcade, setIsArcade };
}
