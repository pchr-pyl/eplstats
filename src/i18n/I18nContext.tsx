'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import thDict from './th.json';
import enDict from './en.json';

export type Lang = 'th' | 'en';

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

const LANG_KEY = 'mu-lang';

function getValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'th';
  const saved = localStorage.getItem(LANG_KEY) as Lang | null;
  return saved === 'th' || saved === 'en' ? saved : 'th';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    if (!hydratedRef.current) {
      hydratedRef.current = true;
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANG_KEY, lang);
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: string) => {
      const active = lang === 'th' ? thDict : enDict;
      const fallback = lang === 'th' ? enDict : thDict;
      let value = getValue(active, key);
      if (typeof value !== 'string') {
        value = getValue(fallback, key);
      }
      return typeof value === 'string' ? value : key;
    },
    [lang],
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
    }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
