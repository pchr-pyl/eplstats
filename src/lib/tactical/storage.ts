import type { ProjectSummary, TacticalProject } from './types';

const DB_NAME = 'epl-tactical-studio-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const LS_FALLBACK_KEY = 'epl-tactical-projects-v1';
const LAST_PROJECT_KEY = 'epl-tactical-last-project-id';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function lsReadAll(): Record<string, TacticalProject> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TacticalProject>) : {};
  } catch {
    return {};
  }
}

function lsWriteAll(map: Record<string, TacticalProject>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(map));
  } catch {
    // quota exceeded
  }
}

export function toProjectSummary(p: TacticalProject): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    homeClub: p.home.clubName,
    awayClub: p.away.clubName,
    homeLogo: p.home.logo,
    awayLogo: p.away.logo,
    sceneCount: p.scenes.length,
    updatedAt: p.updatedAt,
  };
}

export async function listStoredProjects(): Promise<ProjectSummary[]> {
  const db = await openDb();
  if (!db) {
    return Object.values(lsReadAll())
      .map(toProjectSummary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const rows = (req.result as TacticalProject[]) ?? [];
      resolve(
        rows
          .map(toProjectSummary)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    };
    req.onerror = () => resolve([]);
  });
}

export async function loadStoredProject(
  id: string,
): Promise<TacticalProject | null> {
  const db = await openDb();
  if (!db) {
    return lsReadAll()[id] ?? null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as TacticalProject) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function saveStoredProject(
  project: TacticalProject,
): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_PROJECT_KEY, project.id);
    } catch {
      // ignore
    }
  }
  const db = await openDb();
  if (!db) {
    const all = lsReadAll();
    all[project.id] = project;
    lsWriteAll(all);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteStoredProject(id: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    const all = lsReadAll();
    delete all[id];
    lsWriteAll(all);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getLastOpenedProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function parseImportedProjectJson(rawText: string): TacticalProject {
  const parsed = JSON.parse(rawText) as Partial<TacticalProject>;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.scenes) ||
    parsed.scenes.length === 0 ||
    !parsed.home ||
    !parsed.away ||
    !parsed.pitch
  ) {
    throw new Error('Invalid Tactical Board project JSON structure');
  }
  const now = new Date().toISOString();
  const activeId =
    parsed.activeSceneId &&
    parsed.scenes.some((s) => s.id === parsed.activeSceneId)
      ? parsed.activeSceneId
      : parsed.scenes[0].id;

  return {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    schemaVersion: 1,
    name: typeof parsed.name === 'string' && parsed.name.trim()
      ? parsed.name.trim()
      : 'Imported Tactical Plan',
    createdAt: parsed.createdAt ?? now,
    updatedAt: now,
    pitch: parsed.pitch,
    home: parsed.home,
    away: parsed.away,
    scenes: parsed.scenes,
    activeSceneId: activeId,
  };
}
