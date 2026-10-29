'use client';

import type { SiteStats } from '@/lib/siteStats';
import { pct } from '@/lib/format';
import { Card, thaiTime } from './UsageTab';

const daysSince = (date: string, builtAt: string) =>
  Math.round(
    (new Date(builtAt).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000,
  );

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-primary">{value}</div>
    </div>
  );
}

export function DataTab({ site }: { site: SiteStats | null }) {
  if (!site) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="text-secondary">โหลด site-data.json ไม่ได้</p>
      </section>
    );
  }
  const stale = site.pastUnplayed.count > 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="สโมสร" value={site.clubCount} />
        <Kpi label="ฤดูกาล" value={`${site.seasonFirst.slice(0, 4)}–${site.seasonLast.slice(-4)}`} />
        <Kpi label="club-seasons" value={site.clubSeasons} />
        <Kpi label="นัดที่เล่นแล้ว / ยังไม่เล่น" value={`${site.playedRows} / ${site.upcomingRows}`} />
        <Kpi label="นักเตะฤดูกาลนี้" value={site.playersCurrent} />
        <Kpi label="ผู้จัดการ (ปัจจุบัน)" value={`${site.managers.clubsWithStints} / ${site.managers.current}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="ความสดของข้อมูล">
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <span className="text-muted">ผลล่าสุด: </span>
              <span className="text-primary">{site.latestResult?.date ?? '—'}</span>
              {site.latestResult && (
                <span className="text-muted">
                  {' '}
                  · ห่างจากวันที่ build {daysSince(site.latestResult.date, site.builtAt)} วัน
                </span>
              )}
            </div>
            {site.latestResult && (
              <div className="text-xs text-muted">
                {site.latestResult.clubs.join(', ')}
              </div>
            )}
            <div>
              <span className="text-muted">นัดถัดไป: </span>
              <span className="text-primary">{site.nextFixture?.date ?? '—'}</span>
            </div>
            {site.nextFixture && (
              <div className="text-xs text-muted">{site.nextFixture.clubs.join(', ')}</div>
            )}
            <div>
              <span className="text-muted">xG coverage (all / {site.seasonLast.slice(0, 4)}/{site.seasonLast.slice(-2)}): </span>
              <span className="text-primary">
                {pct(site.xgCoverage.all, 2)} / {pct(site.xgCoverage.current, 2)}
              </span>
            </div>
            <div className="text-xs text-muted">
              build: {thaiTime(site.builtAt.replace('T', ' ').slice(0, 19))}
            </div>
          </div>
        </Card>

        <Card title="นัดผ่านแล้วแต่ไม่มีผล (ต้องรีเฟรชข้อมูล)">
          <div className={stale ? 'text-warning' : 'text-success'}>
            <span className="font-display text-2xl font-semibold">{site.pastUnplayed.count}</span>
            <span className="ml-2 text-sm">นัด</span>
          </div>
          {site.pastUnplayed.rows.length > 0 && (
            <div className="mt-3 max-h-64 overflow-y-auto">
              <table className="w-full">
                <tbody>
                  {site.pastUnplayed.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border-light last:border-0">
                      <td className="py-1 pr-2 text-sm tabular-nums text-muted whitespace-nowrap">{r.date}</td>
                      <td className="py-1 pr-2 text-sm text-secondary">{r.club}</td>
                      <td className="py-1 pr-2 text-sm text-muted whitespace-nowrap">{r.competition}</td>
                      <td className="py-1 text-sm text-muted">{r.opponent ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="สโมสรที่ข้อมูลค้าง">
          {site.staleClubs.length === 0 ? (
            <p className="text-sm text-success">ทุกสโมสรทันกำหนดการ (±7 วัน)</p>
          ) : (
            <table className="w-full">
              <tbody>
                {site.staleClubs.map((c) => (
                  <tr key={c.slug} className="border-b border-border-light last:border-0">
                    <td className="py-1.5 pr-3 text-sm text-secondary">{c.name}</td>
                    <td className="py-1.5 text-right text-sm tabular-nums text-warning">{c.latest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted">
            สโมสรที่มีฤดูกาลล่าสุด แต่ผลล่าสุดเก่ากว่าผลล่าสุดรวมเกิน 7 วัน
          </p>
        </Card>
      </div>
    </>
  );
}
