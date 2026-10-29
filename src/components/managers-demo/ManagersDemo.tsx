'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useClubData } from '@/components/ClubProvider';
import { compInGroup } from '@/lib/stats';
import { buildStints, clubPpg, played, rollingPpg } from './shared';
import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';

type Variant = 'a' | 'b' | 'c';
const VARIANTS: Variant[] = ['a', 'b', 'c'];

/** Restrained fade/translate entrance on mount (per variant switch). */
function Fade({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <div
      className={`mgrdemo-enter flex flex-col gap-6 motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out ${
        on ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-surface p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
            value === o.v
              ? 'bg-surface-elevated font-medium text-primary shadow-sm dark:shadow-none'
              : 'text-muted hover:text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ManagersDemo() {
  const { lang } = useI18n();
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const { matches, stints } = useClubData();
  const [variant, setVariant] = useState<Variant>('a');
  const [plOnly, setPlOnly] = useState(false);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (VARIANTS.includes(h as Variant)) setVariant(h as Variant);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const setV = (v: Variant) => {
    setVariant(v);
    window.history.replaceState(null, '', `#${v}`);
  };

  const games = useMemo(
    () =>
      played(
        matches.filter((m) => compInGroup(m.competition, plOnly ? 'premier-league' : 'all')),
      ),
    [matches, plOnly],
  );
  const data = useMemo(() => buildStints(stints, games), [stints, games]);
  const roll = useMemo(() => rollingPpg(games, stints), [games, stints]);
  const baseline = useMemo(() => clubPpg(games), [games]);

  const props = { data, roll, baseline, lang };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-brand px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand">
          DEMO
        </span>
        <Seg
          label={L('เลือกรูปแบบ', 'Choose variant')}
          value={variant}
          onChange={setV}
          options={[
            { v: 'a', label: L('A · ยุคสมัย', 'A · Eras') },
            { v: 'b', label: L('B · ตารางอันดับ', 'B · Leaderboard') },
            { v: 'c', label: L('C · ตัวต่อตัว', 'C · Head-to-head') },
          ]}
        />
        <Seg
          label={L('เลือกรายการแข่งขัน', 'Choose competition')}
          value={plOnly ? 'pl' : 'all'}
          onChange={(v) => setPlOnly(v === 'pl')}
          options={[
            { v: 'all', label: L('ทุกรายการ', 'All comps') },
            { v: 'pl', label: L('พรีเมียร์ลีก', 'Premier League') },
          ]}
        />
      </div>
      <Fade key={variant}>
        {variant === 'a' && <VariantA {...props} />}
        {variant === 'b' && <VariantB {...props} />}
        {variant === 'c' && <VariantC {...props} />}
      </Fade>
    </main>
  );
}
