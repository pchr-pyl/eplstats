'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from './ThemeProvider';
import { useClubOptional } from './ClubProvider';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
              {club ? (
                <img
                  aria-hidden
                  src={`${BASE_PATH}/logos/${club.slug}.png`}
                  width={20}
                  height={20}
                  alt=""
                  className="inline-block h-5 w-5 shrink-0 object-contain"
                />
              ) : (
                <img
                  aria-hidden
                  src={`${BASE_PATH}/epl-logo.svg`}
                  width={26}
                  height={11}
                  alt=""
                  className="epl-logo inline-block shrink-0 object-contain"
                />
              )}
              <h1 className="truncate font-display text-lg font-bold leading-none tracking-tight text-primary sm:text-2xl">
                {title}
              </h1>
            </div>
            <p className="hidden min-[400px]:block truncate text-xs text-muted sm:text-sm">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {club && clubs.length > 1 && (
              <ClubSwitcher
                club={club}
                clubs={clubs}
                subpath={subpath}
                label={t('app.clubSwitcher')}
                lang={lang}
              />
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
              <img
                aria-hidden
                src={`${BASE_PATH}/epl-logo.svg`}
                width={18}
                height={8}
                alt=""
                className="epl-logo inline-block object-contain"
              />
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

function ClubSwitcher({
  club,
  clubs,
  subpath,
  label,
  lang,
}: {
  club: { slug: string; name: string; nameTh?: string | null };
  clubs: { slug: string; name: string; nameTh?: string | null }[];
  subpath: string;
  label: string;
  lang: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = (c: { name: string; nameTh?: string | null }) =>
    lang === 'th' && c.nameTh ? c.nameTh : c.name;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg-secondary px-3 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <img
          aria-hidden
          src={`${BASE_PATH}/logos/${club.slug}.png`}
          width={16}
          height={16}
          alt=""
          className="inline-block h-4 w-4 object-contain"
        />
        <span className="hidden max-w-[120px] truncate sm:inline">{name(club)}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {clubs.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                role="option"
                aria-selected={c.slug === club.slug}
                onClick={() => {
                  setOpen(false);
                  router.push(
                    `/${c.slug}/${subpath}`.replace(/\/$/, '') || `/${c.slug}/`
                  );
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-secondary ${
                  c.slug === club.slug ? 'font-semibold text-brand' : 'text-primary'
                }`}
              >
                <img
                  aria-hidden
                  src={`${BASE_PATH}/logos/${c.slug}.png`}
                  width={16}
                  height={16}
                  alt=""
                  className="inline-block h-4 w-4 object-contain"
                />
                <span className="truncate">{name(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
