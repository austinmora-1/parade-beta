import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ColorScheme = 'coral' | 'green';

const STORAGE_KEY = 'parade-color-scheme';

interface ColorSchemeContextValue {
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(undefined);

function applySchemeToDocument(scheme: ColorScheme) {
  const root = document.documentElement;
  if (scheme === 'green') {
    root.classList.add('theme-green');
  } else {
    root.classList.remove('theme-green');
  }
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(() => {
    if (typeof window === 'undefined') return 'coral';
    const stored = window.localStorage.getItem(STORAGE_KEY) as ColorScheme | null;
    return stored === 'green' || stored === 'coral' ? stored : 'coral';
  });

  useEffect(() => {
    applySchemeToDocument(scheme);
  }, [scheme]);

  const setScheme = (next: ColorScheme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setSchemeState(next);
  };

  return (
    <ColorSchemeContext.Provider value={{ scheme, setScheme }}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) throw new Error('useColorScheme must be used within ColorSchemeProvider');
  return ctx;
}
