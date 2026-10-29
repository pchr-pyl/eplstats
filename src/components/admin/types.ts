export interface Stats {
  totals: {
    views: number;
    views30d: number;
    views7d: number;
    viewsPrev7d: number;
    viewsToday: number;
    visitorsToday: number;
    visitorDays7d: number;
    bots30d: number;
    trackedSince: string | null;
    feedback: number;
  } | null;
  byDay: { day: string; n: number; visitors: number }[];
  heatmap: { dow: number; hour: number; n: number }[];
  sections: { section: string; n: number }[];
  referrers: { direct: number; internal: number; external: { host: string; n: number }[] };
  audience: {
    device: { k: string; n: number; v: number }[];
    country: { k: string; n: number; v: number }[];
    lang: { k: string; n: number; v: number }[];
    theme: { k: string; n: number; v: number }[];
  };
  recent: {
    created_at: string;
    path: string;
    club: string | null;
    device: string | null;
    country: string | null;
    lang: string | null;
  }[];
  topPaths: { path: string; n: number }[];
  topClubs: { club: string; n: number }[];
  feedbackByType: { type: string; n: number }[];
}
