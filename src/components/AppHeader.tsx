'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from './ThemeProvider';

const NAV = [
  { href: '/', key: 'overview' },
  { href: '/matches', key: 'matches' },
  { href: '/shooting', key: 'shooting' },
  { href: '/keepers', key: 'keepers' },
  { href: '/misc', key: 'misc' },
  { href: '/attack', key: 'attack' },
  { href: '/squad', key: 'squad' },
  { href: '/managers', key: 'managers' },
  { href: '/compare', key: 'compare' },
] as const;

export function AppHeader({ seasonRange }: { seasonRange?: string }) {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  const isActive = (href: string) => {
    const norm = (pathname ?? '').replace(/\/$/, '') || '/';
    const target = href.replace(/\/$/, '') || '/';
    return norm === target;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3 py-4 sm:gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate font-display text-lg font-bold leading-none tracking-tight text-primary sm:text-2xl">
              {t('app.title')}
            </h1>
            <p className="truncate text-xs text-muted sm:text-sm">
              {t('app.subtitle')}{seasonRange ? ` · ${seasonRange}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full bg-bg-secondary p-1">
              <button
                type="button"
                onClick={() => setLang('th')}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  lang === 'th'
                    ? 'bg-surface-elevated text-brand shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
                aria-pressed={lang === 'th'}
              >
                {t('lang.th')}
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  lang === 'en'
                    ? 'bg-surface-elevated text-brand shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
                aria-pressed={lang === 'en'}
              >
                {t('lang.en')}
              </button>
            </div>

            <button
              type="button"
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-primary transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto pb-4">
          {NAV.map(({ href, key }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  active
                    ? 'bg-brand-soft text-brand'
                    : 'border border-border bg-surface text-secondary hover:text-primary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {t(`nav.${key}`)}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
