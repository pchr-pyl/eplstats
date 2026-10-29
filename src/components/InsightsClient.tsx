'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClubCrest } from './LeagueHome';
import { ShareBtn } from './ShareBtn';
import { useI18n } from '@/i18n/I18nContext';
import type { ClubIndexEntry } from '@/lib/types';
import type { InsightsData, MwGame } from '@/lib/insights';
import { formatDate } from './matchlog-shared';
import { seasonShort } from '@/lib/stats';
import { fmt } from '@/lib/format';

const RES_STYLE: Record<string, string> = {
  W: 'bg-success/15 text-success',
  D: 'bg-bg-secondary text-muted',
  L: 'bg-danger/15 text-danger',
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
      <h3 className="mb-3 font-display text-lg font-semibold text-primary">{title}</h3>
      {children}
    </section>
  );
}

export function InsightsClient({
  data,
  clubs,
}: {
  data: InsightsData;
  clubs: ClubIndexEntry[];
}) {
  const { t, lang } = useI18n();
  const clubOf = new Map(clubs.map((c) => [c.slug, c]));
  const nameOf = (slug: string) => {
    const c = clubOf.get(slug);
    return lang === 'th' && c?.nameTh ? c.nameTh : (c?.shortName ?? c?.name ?? slug);
  };
  const colorOf = (slug: string) => clubOf.get(slug)?.color ?? 'var(--border)';

  const ClubLink = ({ slug }: { slug: string }) => (
    <Link
      href={`/${slug}/`}
      className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:text-brand"
    >
      <ClubCrest slug={slug} size={16} />
      <span className="truncate">{nameOf(slug)}</span>
    </Link>
  );

  const GameScore = ({ g }: { g: MwGame }) => (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
      title={formatDate(g.date)}
    >
      <ClubCrest slug={g.home} size={14} />
      <span className="truncate">{nameOf(g.home)}</span>
      <span className="font-semibold tabular-nums text-primary">
        {g.hg}–{g.ag}
      </span>
      <span className="truncate">{nameOf(g.away)}</span>
      <ClubCrest slug={g.away} size={14} />
    </span>
  );

  const RankRow = ({
    slug,
    value,
    accent,
  }: {
    slug: string;
    value: ReactNode;
    accent?: boolean;
  }) => (
    <div className="flex items-center justify-between gap-2 border-b border-border-light py-1.5 last:border-0">
      <ClubLink slug={slug} />
      <span
        className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
          accent ? 'text-success' : 'text-primary'
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-6 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">
            {t('insights.title')}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t('insights.subtitle')} · {seasonShort(data.season)}
          </p>
        </div>
        <ShareBtn />
      </div>

      {data.games.length > 0 && (
        <Card title={`${t('insights.latestRound')} · ${data.round}`}>
          <div className="flex flex-wrap gap-2">
            {data.games.map((g) => (
              <GameScore key={`${g.home}-${g.away}`} g={g} />
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {data.topScoring && (
              <li>
                {t('insights.topScoring')}: {nameOf(data.topScoring.home)} {data.topScoring.hg}–
                {data.topScoring.ag} {nameOf(data.topScoring.away)} ({goals(data.topScoring)}{' '}
                {t('insights.goals')})
              </li>
            )}
            {data.biggestWin && (
              <li>
                {t('insights.biggestWin')}: {nameOf(data.biggestWin.home)} {data.biggestWin.hg}–
                {data.biggestWin.ag} {nameOf(data.biggestWin.away)}
              </li>
            )}
            {data.xgFest && (
              <li>
                {t('insights.xgFest')}: {nameOf(data.xgFest.home)} vs {nameOf(data.xgFest.away)} (
                {fmt((data.xgFest.homeXg ?? 0) + (data.xgFest.awayXg ?? 0))} xG)
              </li>
            )}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t('insights.formTitle')}>
          <p className="mb-2 text-xs text-muted">{t('insights.formNote')}</p>
          <ul>
            {data.form.slice(0, 6).map((f) => (
              <li
                key={f.slug}
                className="flex items-center justify-between gap-2 border-b border-border-light py-1.5"
              >
                <ClubLink slug={f.slug} />
                <span className="flex shrink-0 items-center gap-1">
                  {f.record.split('').map((r, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold ${RES_STYLE[r] ?? ''}`}
                    >
                      {r}
                    </span>
                  ))}
                  <span className="ml-1 font-display text-sm font-semibold tabular-nums text-primary">
                    {f.pts}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {data.form.length > 9 && (
            <>
              <p className="mb-1 mt-3 text-xs font-medium text-muted">{t('insights.formWorst')}</p>
              <ul>
                {data.form.slice(-3).map((f) => (
                  <li
                    key={f.slug}
                    className="flex items-center justify-between gap-2 border-b border-border-light py-1.5 last:border-0"
                  >
                    <ClubLink slug={f.slug} />
                    <span className="font-display text-sm font-semibold tabular-nums text-danger">
                      {f.pts}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title={t('insights.xgTitle')}>
          <p className="mb-2 text-xs text-muted">{t('insights.xgNote')}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-success">{t('insights.over')}</p>
              {data.over.map((x) => (
                <RankRow key={x.slug} slug={x.slug} value={`+${fmt(x.diff)}`} accent />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-danger">{t('insights.under')}</p>
              {data.under.map((x) => (
                <RankRow key={x.slug} slug={x.slug} value={`−${fmt(x.diff)}`} />
              ))}
            </div>
          </div>
          <p className="mb-1 mt-4 text-xs font-medium text-muted">{t('insights.gfTop')}</p>
          {data.gfTop.map((x) => (
            <RankRow key={x.slug} slug={x.slug} value={x.n} />
          ))}
        </Card>

        <Card title={t('insights.defenseTitle')}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t('insights.csTop')}</p>
              {data.csTop.map((x) => (
                <RankRow key={x.slug} slug={x.slug} value={x.n} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-success">{t('insights.defOut')}</p>
              {data.defOut.map((x) => (
                <RankRow key={x.slug} slug={x.slug} value={`+${fmt(x.diff)}`} accent />
              ))}
            </div>
          </div>
        </Card>

        <Card title={t('insights.streakTitle')}>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['unbeaten', data.unbeaten, 'text-success'],
                ['winRun', data.winRun, 'text-brand'],
                ['winless', data.winless, 'text-danger'],
              ] as const
            ).map(([k, list, cls]) => (
              <div key={k}>
                <p className={`mb-1 text-xs font-medium ${cls}`}>
                  {t(`insights.${k}`)}
                </p>
                {list.length === 0 && <p className="text-xs text-muted">—</p>}
                {list.map((x) => (
                  <RankRow key={x.slug} slug={x.slug} value={x.n} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {data.nextBig && (
        <Card title={t('insights.nextTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: colorOf(data.nextBig.home) }}
            />
            <ClubLink slug={data.nextBig.home} />
            <span className="font-display font-bold text-primary">{t('insights.vs')}</span>
            <ClubLink slug={data.nextBig.away} />
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: colorOf(data.nextBig.away) }}
            />
            <span className="text-sm text-muted">{formatDate(data.nextBig.date)}</span>
          </div>
        </Card>
      )}
    </main>
  );
}

function goals(g: MwGame) {
  return g.hg + g.ag;
}
