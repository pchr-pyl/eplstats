'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sun, Moon, ArrowLeftRight, House } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from './ThemeProvider';
import { useClubOptional } from './ClubProvider';

const SUBNAV = [
  { sub: '', key: 'overview' },
  { sub: 'matches', key: 'matches' },
  { sub: 'shooting', key: 'shooting' },
  { sub: 'keepers', key: 'keepers' },
  { sub: 'misc', key: 'misc' },
  { sub: 'attack', key: 'attack' },
  { sub: 'squad', key: 'squad' },
  { sub: 'managers', key: 'managers' },
  { sub: 'compare', key: 'compare' },
] as const;

export function AppHeader({ seasonRange }: { seasonRange?: string }) {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const ctx = useClubOptional();
  const club = ctx?.club ?? null;
  const clubs = ctx?.clubs ?? [];
  const hasManagers = ctx?.hasManagers ?? false;

  const title = club
    ? lang === 'th' && club.nameTh
      ? club.nameTh
      : club.name
    : t('app.title');
  const subtitle = club
    ? `${t('app.subtitle')}${seasonRange ? ` · ${seasonRange}` : ''}`
    : `${t('app.subtitle')}${seasonRange ? ` · ${seasonRange}` : ''}`;

  const norm = (pathname ?? '').replace(/\/$/, '') || '/';
  const base = club ? `/${club.slug}` : '';
  const subpath = club && norm.startsWith(base)
    ? norm.slice(base.length).replace(/^\//, '')
    : '';

  const isActive = (sub: string) => {
    const target = `${base}/${sub}`.replace(/\/$/, '') || '/';
    return norm === target;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3 py-4 sm:gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {club && (
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 shrink-0 rounded-full"
                  style={{ background: club.color }}
                />
              )}
              <h1 className="truncate font-display text-lg font-bold leading-none tracking-tight text-primary sm:text-2xl">
                {title}
              </h1>
            </div>
            <p className="truncate text-xs text-muted sm:text-sm">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {club && clubs.length > 1 && (
              <select
                aria-label={t('app.clubSwitcher')}
                value={club.slug}
                onChange={(e) =>
                  router.push(`/${e.target.value}/${subpath}`.replace(/\/$/, '') || `/${e.target.value}/`)
                }
                className="h-9 max-w-[150px] rounded-full border border-border bg-bg-secondary px-3 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {clubs.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {lang === 'th' && c.nameTh ? c.nameTh : c.name}
                  </option>
                ))}
              </select>
            )}

            <Link
              href="/clubs-compare/"
              aria-label={t('app.compareClubs')}
              title={t('app.compareClubs')}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-primary transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <ArrowLeftRight size={17} />
            </Link>

            <Link
              href="/"
              aria-label={t('app.home')}
              title={t('app.home')}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-primary transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <House size={17} />
            </Link>

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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-primary transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {club && (
          <nav className="flex items-center gap-2 overflow-x-auto pb-4">
            {SUBNAV.filter(({ key }) => key !== 'managers' || hasManagers).map(
              ({ sub, key }) => {
                const href = `${base}/${sub}/`;
                const active = isActive(sub);
                return (
                  <Link
                    key={key}
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
              },
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
