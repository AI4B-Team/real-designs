import { supabase } from "@/integrations/supabase/client";

export type WorkspacePrefs = {
  notifs: Record<string, boolean>;
  brand: { company: string; color: string; watermark: string };
  defaults: { market: string; grade: string; band: string; disclosure: string };
  start: { page: "smart" | "dashboard" | "studio" | "last" };
};

export const DEFAULT_PREFS: WorkspacePrefs = {
  notifs: {},
  brand: { company: "", color: "#CC0000", watermark: "REAL DESIGNS" },
  defaults: {
    market: "Tampa, FL",
    grade: "Retail Grade",
    band: "Makeover, Under $15K",
    disclosure: "Florida, Stellar MLS",
  },
  start: { page: "smart" },
};

const LS = "rd.prefs";

function readLocal(): WorkspacePrefs {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      notifs: { ...DEFAULT_PREFS.notifs, ...(parsed?.notifs || {}) },
      brand: { ...DEFAULT_PREFS.brand, ...(parsed?.brand || {}) },
      defaults: { ...DEFAULT_PREFS.defaults, ...(parsed?.defaults || {}) },
      start: { ...DEFAULT_PREFS.start, ...(parsed?.start || {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Reads saved workspace preferences, falling back to the local cache when signed out. */
export async function getPrefs(): Promise<WorkspacePrefs> {
  const local = readLocal();
  try {
    const { data } = await supabase.auth.getUser();
    const saved = (data?.user?.user_metadata as Record<string, unknown> | undefined)?.[
      "rd_prefs"
    ] as Partial<WorkspacePrefs> | undefined;
    if (!saved) return local;
    const merged: WorkspacePrefs = {
      notifs: { ...local.notifs, ...(saved.notifs || {}) },
      brand: { ...local.brand, ...(saved.brand || {}) },
      defaults: { ...local.defaults, ...(saved.defaults || {}) },
      start: { ...local.start, ...(saved.start || {}) },
    };
    try {
      localStorage.setItem(LS, JSON.stringify(merged));
    } catch {
      /* storage blocked */
    }
    return merged;
  } catch {
    return local;
  }
}

/** Persists a partial preference update to the signed-in account. */
export async function savePrefs(patch: Partial<WorkspacePrefs>): Promise<WorkspacePrefs> {
  const current = await getPrefs();
  const next: WorkspacePrefs = {
    notifs: { ...current.notifs, ...(patch.notifs || {}) },
    brand: { ...current.brand, ...(patch.brand || {}) },
    defaults: { ...current.defaults, ...(patch.defaults || {}) },
    start: { ...current.start, ...(patch.start || {}) },
  };
  try {
    localStorage.setItem(LS, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  const { error } = await supabase.auth.updateUser({ data: { rd_prefs: next } });
  if (error) throw new Error(error.message);
  return next;
}
