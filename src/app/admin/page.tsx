'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const TOKEN_KEY = 'eplstats_admin_token';

interface FeedbackRow {
  id: number;
  created_at: string;
  type: string;
  message: string;
  contact: string | null;
  page: string | null;
  ua: string | null;
}

interface Stats {
  totals: {
    views: number;
    views30d: number;
    views7d: number;
    viewsToday: number;
    feedback: number;
  } | null;
  byDay: { day: string; n: number }[];
  topPaths: { path: string; n: number }[];
  topClubs: { club: string; n: number }[];
  feedbackByType: { type: string; n: number }[];
}

const TYPE_STYLE: Record<string, string> = {
  bug: 'bg-danger/15 text-danger',
  idea: 'bg-success/15 text-success',
  other: 'bg-bg-secondary text-muted',
};

function authFetch(token: string, path: string) {
  return fetch(`${BASE_PATH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState(false);
  const [tab, setTab] = useState<'stats' | 'feedback'>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  const load = useCallback(async (tok: string) => {
    try {
      const [s, f] = await Promise.all([
        authFetch(tok, '/api/admin/stats'),
        authFetch(tok, '/api/admin/feedback'),
      ]);
      if (s.status === 401 || f.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        return;
      }
      if (!s.ok || !f.ok) throw new Error('load failed');
      setStats(await s.json());
      setFeedback((await f.json()).feedback);
    } catch {
      setLoadErr(true);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    queueMicrotask(() => {
      setToken(saved);
      load(saved);
    });
  }, [load]);

  const login = async () => {
    setLoginErr(false);
    try {
      const r = await fetch(`${BASE_PATH}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!r.ok) {
        setLoginErr(true);
        return;
      }
      const { token: tok } = await r.json();
      sessionStorage.setItem(TOKEN_KEY, tok);
      setToken(tok);
      load(tok);
    } catch {
      setLoginErr(true);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setStats(null);
    setFeedback(null);
  };

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-1 font-display text-xl font-semibold text-primary">Admin</h1>
          <p className="mb-4 text-sm text-muted">eplstats feedback & usage</p>
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="username"
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-primary focus:border-brand focus:outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder="Password"
              autoComplete="current-password"
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-primary focus:border-brand focus:outline-none"
            />
            {loginErr && <p className="text-xs text-danger">Invalid credentials</p>}
            <button
              type="button"
              onClick={login}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Sign in
            </button>
          </div>
        </div>
        <Link href="/" className="mt-4 text-center text-xs text-muted hover:text-primary">
          ← Back to site
        </Link>
      </main>
    );
  }

  const maxDay = Math.max(1, ...(stats?.byDay.map((d) => d.n) ?? [1]));

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-primary">
          Admin — feedback & usage
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-muted hover:text-primary">
            ← Site
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-secondary hover:text-primary"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['stats', 'feedback'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === k
                ? 'bg-brand-soft text-brand'
                : 'border border-border bg-surface text-secondary hover:text-primary'
            }`}
          >
            {k === 'stats' ? 'Usage' : `Feedback (${feedback?.length ?? 0})`}
          </button>
        ))}
      </div>

      {loadErr && (
        <p className="text-sm text-danger">
          Failed to load —{' '}
          <button type="button" className="underline" onClick={() => load(token)}>
            retry
          </button>
        </p>
      )}

      {tab === 'stats' && stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Today', stats.totals?.viewsToday],
              ['7 days', stats.totals?.views7d],
              ['30 days', stats.totals?.views30d],
              ['All time', stats.totals?.views],
              ['Feedback', stats.totals?.feedback],
            ].map(([label, v]) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
                <div className="mt-1 font-display text-2xl font-semibold text-primary">
                  {v ?? 0}
                </div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-3 font-display text-lg font-semibold text-primary">
              Pageviews — last 30 days
            </h2>
            {stats.byDay.length === 0 ? (
              <p className="text-sm text-muted">No data yet</p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {stats.byDay.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${d.n}`}
                    className="min-w-0 flex-1 rounded-t bg-brand/70"
                    style={{ height: `${Math.max(4, (d.n / maxDay) * 100)}%` }}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="mb-2 font-display text-lg font-semibold text-primary">
                Top pages
              </h2>
              <table className="w-full">
                <tbody>
                  {stats.topPaths.map((p) => (
                    <tr key={p.path} className="border-b border-border-light last:border-0">
                      <td className="py-1.5 pr-3 text-sm text-secondary">{p.path}</td>
                      <td className="py-1.5 text-right text-sm tabular-nums text-primary">
                        {p.n}
                      </td>
                    </tr>
                  ))}
                  {stats.topPaths.length === 0 && (
                    <tr>
                      <td className="py-3 text-sm text-muted">No data yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="mb-2 font-display text-lg font-semibold text-primary">
                Top clubs
              </h2>
              <table className="w-full">
                <tbody>
                  {stats.topClubs.map((c) => (
                    <tr key={c.club} className="border-b border-border-light last:border-0">
                      <td className="py-1.5 pr-3 text-sm text-secondary">{c.club}</td>
                      <td className="py-1.5 text-right text-sm tabular-nums text-primary">
                        {c.n}
                      </td>
                    </tr>
                  ))}
                  {stats.topClubs.length === 0 && (
                    <tr>
                      <td className="py-3 text-sm text-muted">No data yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}

      {tab === 'feedback' && (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {feedback == null ? (
            <p className="px-4 py-6 text-sm text-muted">Loading…</p>
          ) : feedback.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No feedback yet</p>
          ) : (
            <ul className="divide-y divide-border">
              {feedback.map((f) => (
                <li key={f.id} className="px-4 py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        TYPE_STYLE[f.type] ?? TYPE_STYLE.other
                      }`}
                    >
                      {f.type}
                    </span>
                    <span className="tabular-nums">{f.created_at}</span>
                    {f.page && <span className="truncate">{f.page}</span>}
                    {f.contact && <span className="text-brand">{f.contact}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-primary">{f.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
