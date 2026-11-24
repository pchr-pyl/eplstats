'use client';

import { useRef, useState } from 'react';
import {
  Copy,
  Database,
  Download,
  FolderOpen,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { exportProjectJson } from '@/lib/tactical/export';
import { useTacticalStore } from '@/lib/tactical/store';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function ProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const project = useTacticalStore((s) => s.project);
  const savedProjects = useTacticalStore((s) => s.savedProjects);
  const provider = useTacticalStore((s) => s.provider);

  const newProject = useTacticalStore((s) => s.newProject);
  const openProject = useTacticalStore((s) => s.openProject);
  const duplicateCurrentProject = useTacticalStore(
    (s) => s.duplicateCurrentProject,
  );
  const deleteProjectById = useTacticalStore((s) => s.deleteProjectById);
  const resetBoard = useTacticalStore((s) => s.resetBoard);
  const importProjectJson = useTacticalStore((s) => s.importProjectJson);
  const showToast = useTacticalStore((s) => s.showToast);

  const [newName, setNewName] = useState('');
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open || !project) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await newProject(newName.trim() || undefined);
    setNewName('');
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErr(null);
    try {
      const text = await file.text();
      await importProjectJson(text);
      onClose();
    } catch (err) {
      setImportErr(
        err instanceof Error ? err.message : 'Failed to parse project JSON',
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-tb-border bg-tb-panel text-tb-text shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tb-border bg-tb-bar px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-emerald-500" />
            <h2 className="text-base font-bold">Projects &amp; Data Manager</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-tb-muted hover:bg-tb-hover hover:text-tb-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Create New Project + Quick Actions */}
          <form onSubmit={handleCreate} className="mb-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New tactical project name..."
              className="h-9 min-w-[200px] flex-1 rounded-lg border border-tb-border bg-tb-input px-3 text-sm text-tb-text placeholder:text-tb-muted focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Plus size={14} />
              <span>New Project</span>
            </button>
          </form>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void duplicateCurrentProject()}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-tb-border bg-tb-card px-3 text-xs font-medium text-tb-text-2 hover:bg-tb-hover"
            >
              <Copy size={13} />
              <span>Duplicate Current</span>
            </button>
            <button
              type="button"
              onClick={() => {
                exportProjectJson(project);
                showToast('Exported Project JSON');
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-tb-border bg-tb-card px-3 text-xs font-medium text-tb-text-2 hover:bg-tb-hover"
            >
              <Download size={13} />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/15 px-3 text-xs font-medium text-sky-500 hover:bg-sky-500/25"
            >
              <Upload size={13} />
              <span>Import JSON</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                resetBoard();
                onClose();
              }}
              className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-medium text-rose-500 hover:bg-rose-500/20"
            >
              <RotateCcw size={13} />
              <span>Reset Board</span>
            </button>
          </div>

          {importErr && (
            <div className="mb-4 rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-xs text-rose-500">
              {importErr}
            </div>
          )}

          {/* Saved Projects List (IndexedDB) */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold tracking-wider text-tb-muted uppercase">
              <span>Saved Projects (IndexedDB · {savedProjects.length})</span>
            </div>
            <div className="flex flex-col gap-2">
              {savedProjects.map((p) => {
                const isCurrent = p.id === project.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                      isCurrent
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-tb-border bg-tb-card hover:bg-tb-hover/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-tb-text">
                          {p.name}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-tb-muted">
                        <span className="flex items-center gap-1">
                          {p.homeLogo && (
                            <img
                              src={`${BASE_PATH}${p.homeLogo}`}
                              alt=""
                              width={14}
                              height={14}
                              className="h-3.5 w-3.5 object-contain"
                            />
                          )}
                          {p.homeClub}
                        </span>
                        <span>vs</span>
                        <span className="flex items-center gap-1">
                          {p.awayLogo && (
                            <img
                              src={`${BASE_PATH}${p.awayLogo}`}
                              alt=""
                              width={14}
                              height={14}
                              className="h-3.5 w-3.5 object-contain"
                            />
                          )}
                          {p.awayClub}
                        </span>
                        <span>· {p.sceneCount} scenes</span>
                        <span>· {new Date(p.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={async () => {
                            await openProject(p.id);
                            onClose();
                          }}
                          className="rounded-lg bg-tb-input px-3 py-1.5 text-xs font-semibold text-tb-text hover:bg-emerald-600 hover:text-white"
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteProjectById(p.id)}
                        title="Delete Project"
                        className="rounded-lg p-1.5 text-tb-muted hover:bg-rose-500/20 hover:text-rose-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Layer Transparency Panel */}
          <div className="rounded-xl border border-tb-border bg-tb-card p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-tb-text">
              <Database size={14} className="text-sky-500" />
              <span>Active Player Data Source</span>
            </div>
            <p className="mt-1 text-xs text-tb-muted">
              {provider?.label}: {provider?.description}. User-added custom
              players are always explicitly tagged as{' '}
              <span className="rounded bg-sky-500/20 px-1 text-sky-500">
                Custom
              </span>
              . Architecture uses the pluggable{' '}
              <code className="text-tb-text-2">TeamDataProvider</code> interface
              for future REST API integration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
