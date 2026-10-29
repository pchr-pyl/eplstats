'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useClubData } from '@/components/ClubProvider';
import { CompetitionTabs } from '@/components/CompetitionTabs';
import { ManagersClient } from '@/components/ManagersClient';
import { compInGroup } from '@/lib/stats';
import type { CompGroup } from '@/lib/types';
import { buildStints, clubPpg, minSample, played, rollingPpg } from './shared';
import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';

type Tab = 'eras' | 'leaderboard' | 'h2h' | 'classic';
const TABS: Tab[] = ['eras', 'leaderboard', 'h2h', 'classic'];

/** Restrained fade/translate entrance on mount (per tab switch). */
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

export function ManagersPage() {
  const { lang } = useI18n();
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const { matches, stints } = useClubData();
  const [tab, setTab] = useState<Tab>('eras');
  const [group, setGroup] = useState<CompGroup>('all');

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      setTab(TABS.includes(h as Tab) ? (h as Tab) : 'eras');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const setT = (v: Tab) => {
    setTab(v);
    window.history.replaceState(null, '', `#${v}`);
  };

  const games = useMemo(
    () => played(matches.filter((m) => compInGroup(m.competition, group))),
    [matches, group],
  );
  const data = useMemo(() => buildStints(stints, games), [stints, games]);
  const roll = useMemo(() => rollingPpg(games, stints), [games, stints]);
  const baseline = useMemo(() => clubPpg(games), [games]);
  const hasXg = useMemo(() => data.some((s) => s.xgN > 0), [data]);
  const minN = minSample(group);

  const props = { data, roll, baseline, lang, hasXg, minN };
  const tabLabel: Record<Tab, string> = {
    eras: L('ยุคสมัย', 'Eras'),
    leaderboard: L('ตารางอันดับ', 'Leaderboard'),
    h2h: L('ตัวต่อตัว', 'Head-to-head'),
    classic: L('ตารางเดิม', 'Classic'),
  };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label={L('เลือกมุมมอง', 'Choose view')}
          className="inline-flex self-start rounded-lg border border-border bg-surface p-0.5"
        >
          {TABS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={tab === v}
              onClick={() => setT(v)}
              className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
                tab === v
                  ? 'bg-surface-elevated font-medium text-primary shadow-sm dark:shadow-none'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              {tabLabel[v]}
            </button>
          ))}
        </div>
        <CompetitionTabs group={group} onChange={setGroup} />
      </div>
      <Fade key={tab}>
        {tab === 'eras' && <VariantA {...props} />}
        {tab === 'leaderboard' && <VariantB {...props} />}
        {tab === 'h2h' && <VariantC {...props} />}
        {tab === 'classic' && <ManagersClient group={group} />}
      </Fade>
    </main>
  );
}
