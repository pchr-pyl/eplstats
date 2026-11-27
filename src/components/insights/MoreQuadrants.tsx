'use client';

import { useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { ClubCrest } from '@/components/LeagueHome';
import { fmt } from '@/lib/format';
import type { ClubIndexEntry } from '@/lib/types';
import type { QuadrantClub } from '@/lib/quadrants';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
type Point = { row: QuadrantClub; x: number; y: number };

export function MoreQuadrants({ data, clubs, th }: { data: Record<string, QuadrantClub[]>; clubs: Map<string, ClubIndexEntry>; th: boolean }) {
  const seasons = Object.keys(data).sort().reverse();
  const [season, setSeason] = useState(seasons[0] ?? '');
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState('');
  const tx = (en: string, thai: string) => th ? thai : en;
  const configs = [
    { name: tx('Chance creation & finishing', 'สร้างโอกาส & จบสกอร์'), x: 'xG / match', y: tx('Goals − xG / match', 'ประตู − xG / นัด'), zero: true },
    { name: tx('Chance quality & points', 'คุณภาพโอกาส & แต้ม'), x: tx('xG difference / match', 'ผลต่าง xG / นัด'), y: tx('Points / match', 'แต้ม / นัด') },
    { name: tx('Home & away', 'เหย้า & เยือน'), x: tx('Home points / match', 'แต้มเหย้า / นัด'), y: tx('Away points / match', 'แต้มเยือน / นัด') },
    { name: tx('Shots & accuracy', 'ยิง & ความแม่นยำ'), x: tx('Shots / match', 'ยิง / นัด'), y: tx('Shots on target %', 'ยิงตรงกรอบ %') },
    { name: tx('Chances conceded & clean sheets', 'โอกาสที่เสีย & คลีนชีต'), x: tx('xGA / match (lower is better)', 'xGA / นัด (น้อยดีกว่า)'), y: tx('Clean sheets %', 'คลีนชีต %'), reverse: true },
  ];
  const config = configs[tab];
  const points = useMemo(() => (data[season] ?? []).flatMap(row => {
    let x: number | null = null, y: number | null = null;
    if (tab === 0) { x = row.xg; y = row.xg == null || row.xgGf == null ? null : row.xgGf - row.xg; }
    if (tab === 1) { x = row.xg == null || row.xga == null ? null : row.xg - row.xga; y = row.xgPpg; }
    if (tab === 2) { x = row.home; y = row.away; }
    if (tab === 3) { x = row.shots; y = row.accuracy; }
    if (tab === 4) { x = row.xga; y = row.xgClean; }
    return x == null || y == null ? [] : [{ row, x, y }];
  }), [data, season, tab]);
  const active = points.find(p => p.row.slug === selected);
  const name = (slug: string) => { const c = clubs.get(slug); return th && c?.nameTh ? c.nameTh : c?.shortName ?? c?.name ?? slug; };
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const ax = points.length ? mean(points.map(p => p.x)) : 0;
  const ay = config.zero ? 0 : points.length ? mean(points.map(p => p.y)) : 0;
  const extent = (values: number[], reference: number) => {
    const lo = Math.min(...values, reference), hi = Math.max(...values, reference), margin = Math.max((hi - lo) * 0.18, 0.1);
    return [lo - margin, hi + margin];
  };
  const [minX, maxX] = extent(points.map(p => p.x), ax), [minY, maxY] = extent(points.map(p => p.y), ay);
  const W = 760, H = 400, left = 60, right = 22, top = 24, bottom = 55, iw = W-left-right, ih = H-top-bottom;
  const sx = (x: number) => left + (config.reverse ? 1-(x-minX)/(maxX-minX) : (x-minX)/(maxX-minX))*iw;
  const sy = (y: number) => top + (1-(y-minY)/(maxY-minY))*ih;
  const selectPoint = (point: Point) => setSelected(point.row.slug);
  return <section id="more-quadrants" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted"><Compass size={13}/>{tx('Explore the league', 'สำรวจพรีเมียร์ลีก')}</p><h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">{tx('Five more ways to compare clubs', 'เปรียบเทียบสโมสรอีก 5 มิติ')}</h2></div>
      <label className="text-xs font-bold text-muted">{tx('Season', 'ฤดูกาล')} <select value={season} onChange={e => { setSeason(e.target.value); setSelected(''); }} className="ml-2 rounded-lg border border-border bg-bg-secondary px-2 py-1.5 text-primary">{seasons.map(s => <option key={s}>{s}</option>)}</select></label>
    </div>
    <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label={tx('Comparison dimensions', 'มิติการเปรียบเทียบ')}>{configs.map((c, i) => <button key={c.name} type="button" role="tab" aria-selected={tab === i} onClick={() => { setTab(i); setSelected(''); }} className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${tab === i ? 'bg-brand text-white' : 'bg-bg-secondary text-muted hover:text-primary'}`}>{c.name}</button>)}</div>
    <h3 className="mt-5 text-base font-bold text-primary">{config.name}</h3>
    {points.length ? <>
      <div className="mt-2 overflow-x-auto"><svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[580px]" role="img" aria-label={`${config.x}, ${config.y}`}>
        <rect x={sx(ax)} y={top} width={W-right-sx(ax)} height={sy(ay)-top} className="fill-success" fillOpacity="0.05" />
        {[0, .25, .5, .75, 1].map(t => {const x=minX+t*(maxX-minX), y=minY+t*(maxY-minY);return <g key={t}><line x1={sx(x)} x2={sx(x)} y1={top} y2={H-bottom} className="stroke-border"/><line x1={left} x2={W-right} y1={sy(y)} y2={sy(y)} className="stroke-border"/><text x={sx(x)} y={H-bottom+17} textAnchor="middle" className="fill-muted text-[10px]">{fmt(x,2)}</text><text x={left-8} y={sy(y)+3} textAnchor="end" className="fill-muted text-[10px]">{fmt(y,2)}</text></g>})}
        <line x1={sx(ax)} x2={sx(ax)} y1={top} y2={H-bottom} className="stroke-muted" strokeDasharray="4 4"/><line x1={left} x2={W-right} y1={sy(ay)} y2={sy(ay)} className="stroke-muted" strokeDasharray="4 4"/>
        {points.map(p => <g key={p.row.slug} onMouseEnter={() => selectPoint(p)} onClick={() => selectPoint(p)} className="cursor-pointer"><circle cx={sx(p.x)} cy={sy(p.y)} r="15" className={selected === p.row.slug ? 'fill-surface stroke-primary' : 'fill-surface stroke-border'}/><image href={`${BASE}/logos/${p.row.slug}.png`} x={sx(p.x)-12} y={sy(p.y)-12} width="24" height="24" /></g>)}
        <text x={left+iw/2} y={H-9} textAnchor="middle" className="fill-muted text-[11px] font-bold">{config.x} →</text><text transform={`translate(15 ${top+ih/2}) rotate(-90)`} textAnchor="middle" className="fill-muted text-[11px] font-bold">{config.y} ↑</text>
      </svg></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2 text-xs"><label className="flex items-center gap-2 text-muted">{tx('Select club', 'เลือกสโมสร')}<select value={active?.row.slug ?? ''} onChange={e => setSelected(e.target.value)} className="max-w-48 rounded border border-border bg-surface p-1 text-primary"><option value="">{tx('Choose…', 'เลือก…')}</option>{points.map(p => <option key={p.row.slug} value={p.row.slug}>{name(p.row.slug)}</option>)}</select></label>{active ? <span className="flex flex-wrap items-center gap-2 tabular-nums"><ClubCrest slug={active.row.slug} size={18}/><strong>{name(active.row.slug)}</strong> · {config.x}: {fmt(active.x,2)} · {config.y}: {fmt(active.y,2)} · {[0, 1, 4].includes(tab) ? `${active.row.xgMp}/${active.row.mp}` : active.row.mp} {tx('matches', 'นัด')}{tab===2 && ` (${active.row.homeMp} / ${active.row.awayMp})`}</span> : <span className="text-muted">{tx('Dashed lines: team averages', 'เส้นประ: ค่าเฉลี่ยของทีม')}{config.zero && tx(' · finishing line: 0.00', ' · เส้นจบสกอร์: 0.00')}</span>}</div>
      <p className="mt-2 text-xs text-muted">{points.length}/{(data[season] ?? []).length} {tx('clubs shown', 'ทีมที่แสดง')}{[0, 1, 4].includes(tab) && tx(' · Both axes use matches with xG and xGA data; select a club to see coverage.', ' · ทั้งสองแกนใช้เฉพาะนัดที่มีข้อมูล xG และ xGA เลือกทีมเพื่อดูจำนวนนัด')}{tab === 4 && tx(' · Clean sheets reflect the whole team, not just the goalkeeper.', ' · คลีนชีตเป็นผลงานของทั้งทีม ไม่ใช่ผู้รักษาประตูเพียงคนเดียว')}</p>
    </> : <p className="py-12 text-center text-sm text-muted">{tx('No match data is available for this chart in this season.', 'ฤดูกาลนี้ยังไม่มีข้อมูลรายนัดสำหรับกราฟนี้')}</p>}
  </section>;
}
