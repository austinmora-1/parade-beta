import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ArcadeContextValue {
  isArcade: boolean;
  toggleArcade: () => void;
}

const ArcadeContext = createContext<ArcadeContextValue>({
  isArcade: false,
  toggleArcade: () => {},
});

const ARCADE_KEY = 'parade-arcade-mode';

export function ArcadeProvider({ children }: { children: ReactNode }) {
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

  return (
    <ArcadeContext.Provider value={{ isArcade, toggleArcade }}>
      {children}
    </ArcadeContext.Provider>
  );
}

export function useArcadeMode() {
  return useContext(ArcadeContext);
}
