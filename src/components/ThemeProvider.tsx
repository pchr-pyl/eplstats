'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type Theme = 'light' | 'dark';

type ThemeValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

const THEME_KEY = 'mu-theme';

function apply(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const mountedRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      queueMicrotask(() => setThemeState(saved));
    }
  }, []);

  useEffect(() => {
    apply(theme);
    if (!mountedRef.current) {
      mountedRef.current = true;
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);

  const toggle = () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggle,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
