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
  // Base tokens are Parade Green by default. The warm Ember-led preset is
  // applied via .theme-coral. We retain the storage key 'green'/'coral' for
  // backward compatibility.
  if (scheme === 'coral') {
    root.classList.add('theme-coral');
    root.classList.remove('theme-green');
  } else {
    root.classList.remove('theme-coral');
    root.classList.remove('theme-green');
  }
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(() => {
    if (typeof window === 'undefined') return 'green';
    const stored = window.localStorage.getItem(STORAGE_KEY) as ColorScheme | null;
    return stored === 'green' || stored === 'coral' ? stored : 'green';
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
