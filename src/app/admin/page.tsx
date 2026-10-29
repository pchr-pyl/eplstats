'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Stats } from '@/components/admin/types';
import type { SiteStats } from '@/lib/siteStats';
import { UsageTab } from '@/components/admin/UsageTab';
import { AudienceTab } from '@/components/admin/AudienceTab';
import { DataTab } from '@/components/admin/DataTab';

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
  image: string | null;
  status: string;
}

const TYPE_STYLE: Record<string, string> = {
  bug: 'bg-danger/15 text-danger',
  idea: 'bg-success/15 text-success',
  other: 'bg-bg-secondary text-muted',
};

const STATUSES = ['new', 'in-progress', 'done', 'wontfix'] as const;
const STATUS_STYLE: Record<string, string> = {
  new: 'bg-danger/15 text-danger',
  'in-progress': 'bg-brand-soft text-brand',
  done: 'bg-success/15 text-success',
  wontfix: 'bg-bg-secondary text-muted',
};

function exportMarkdown(rows: FeedbackRow[], filter: string) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Feedback export — ${date}`,
    `Filter: ${filter} · Items: ${rows.length}`,
    '',
  ];
  for (const f of rows) {
    lines.push(`## #${f.id} [${f.type}] — ${f.status} — ${f.created_at}`);
    if (f.page) lines.push(`Page: ${f.page}`);
    if (f.contact) lines.push(`Contact: ${f.contact}`);
    if (f.image) lines.push(`Image: ${f.image}`);
    lines.push('', f.message, '', '---', '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `feedback-export-${date}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function authFetch(token: string, path: string) {
  return fetch(`${BASE_PATH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function FeedbackImage({ token, imgKey }: { token: string; imgKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let obj: string | null = null;
    let live = true;
    authFetch(token, `/api/img/${imgKey}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b && live) {
          obj = URL.createObjectURL(b);
          setUrl(obj);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [token, imgKey]);

  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="attachment"
        className="max-h-40 rounded-lg border border-border"
      />
    </a>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState(false);
  const [tab, setTab] = useState<'usage' | 'audience' | 'data' | 'feedback'>('usage');
  const [stats, setStats] = useState<Stats | null>(null);
  const [site, setSite] = useState<SiteStats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadErr, setLoadErr] = useState(false);

  const setStatus = async (id: number, status: string) => {
    if (!token) return;
    const prev = feedback;
    setFeedback(
      prev?.map((f) => (f.id === id ? { ...f, status } : f)) ?? null,
    );
    const r = await fetch(`${BASE_PATH}/api/admin/feedback`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, status }),
    });
    if (!r.ok) setFeedback(prev ?? null);
  };

  const filtered =
    statusFilter === 'all'
      ? feedback
      : (feedback ?? []).filter((f) => f.status === statusFilter);

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
      // site data is public + optional — a failure must not break other tabs
      fetch(`${BASE_PATH}/admin/site-data.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setSite(d))
        .catch(() => {});
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
          <p className="mb-4 text-sm text-muted">eplstats — หลังบ้าน</p>
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

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-primary">
          หลังบ้าน — feedback &amp; การใช้งาน
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
        {(['usage', 'audience', 'data', 'feedback'] as const).map((k) => (
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
            {k === 'usage'
              ? 'การใช้งาน'
              : k === 'audience'
                ? 'ผู้เข้าชม'
                : k === 'data'
                  ? 'ข้อมูลเว็บ'
                  : `Feedback (${feedback?.length ?? 0})`}
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

      {tab === 'usage' && stats && <UsageTab stats={stats} site={site} />}

      {tab === 'audience' && stats && <AudienceTab stats={stats} />}

      {tab === 'data' && <DataTab site={site} />}

      {tab === 'feedback' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {['all', ...STATUSES].map((s) => {
              const n =
                s === 'all'
                  ? (feedback?.length ?? 0)
                  : (feedback ?? []).filter((f) => f.status === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={statusFilter === s}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-brand-soft text-brand'
                      : 'border border-border bg-surface text-secondary hover:text-primary'
                  }`}
                >
                  {s} ({n})
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => filtered && exportMarkdown(filtered, statusFilter)}
              disabled={!filtered?.length}
              className="ml-auto rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export .md
            </button>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            {feedback == null ? (
              <p className="px-4 py-6 text-sm text-muted">Loading…</p>
            ) : !filtered?.length ? (
              <p className="px-4 py-6 text-sm text-muted">No feedback</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((f) => (
                  <li key={f.id} className="px-4 py-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold ${
                          TYPE_STYLE[f.type] ?? TYPE_STYLE.other
                        }`}
                      >
                        {f.type}
                      </span>
                      <select
                        value={f.status}
                        onChange={(e) => setStatus(f.id, e.target.value)}
                        aria-label="status"
                        className={`rounded px-1.5 py-0.5 font-semibold focus:outline-none ${
                          STATUS_STYLE[f.status] ?? STATUS_STYLE.new
                        }`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className="tabular-nums">{f.created_at}</span>
                      {f.page && <span className="truncate">{f.page}</span>}
                      {f.contact && <span className="text-brand">{f.contact}</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-primary">{f.message}</p>
                    {f.image && <FeedbackImage token={token} imgKey={f.image} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
