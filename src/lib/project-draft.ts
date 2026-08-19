/**
 * Client-side draft autosave.
 *
 * The database is the draft. This module debounces meaningful changes, keeps
 * exactly one in-flight save, retries failures with backoff, and reports a
 * Saved / Saving / Couldn't Save state to the UI.
 *
 * localStorage is only a recovery cache: it holds the last payload that has
 * not been confirmed by the server, and it is cleared the moment the server
 * confirms. It is never read as the source of truth when the server answers.
 */

export type DraftSaveState = "idle" | "saving" | "saved" | "error";

export type DraftPayload = Record<string, any> & { id: string; project_type: string };

export type AutosaveOptions = {
  /** Server call. Must resolve when the row is durably persisted. */
  save: (payload: DraftPayload) => Promise<unknown>;
  /** Debounce for meaningful changes. */
  debounceMs?: number;
  /** Retry backoff steps, in ms. */
  retryMs?: number[];
  onState?: (state: DraftSaveState, detail?: { error?: string; attempt?: number }) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (handle: any) => void;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
};

const CACHE_PREFIX = "rd.draft.cache.";

export function cacheKey(id: string) {
  return CACHE_PREFIX + id;
}

function safeStorage(opt: AutosaveOptions) {
  if (opt.storage !== undefined) return opt.storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function newDraftId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    /* Deterministic-enough fallback; the id only has to be unique per draft. */
    const hex = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i++)
      s += i === 8 || i === 13 || i === 18 || i === 23 ? "-" : hex[Math.floor(Math.random() * 16)];
    return s;
  }
}

export class DraftAutosaver {
  readonly id: string;
  private opt: AutosaveOptions;
  private timer: any = null;
  private pending: DraftPayload | null = null;
  private inflight = false;
  private attempt = 0;
  private lastSerialized = "";
  private destroyed = false;
  state: DraftSaveState = "idle";

  constructor(id: string, opt: AutosaveOptions) {
    this.id = id;
    this.opt = opt;
  }

  private emit(state: DraftSaveState, detail?: { error?: string; attempt?: number }) {
    this.state = state;
    try {
      this.opt.onState?.(state, detail);
    } catch {
      /* a UI callback must never break persistence */
    }
  }

  private timers() {
    return {
      set: this.opt.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms)),
      clear: this.opt.clearTimer ?? ((h: any) => clearTimeout(h)),
    };
  }

  private cache(payload: DraftPayload | null) {
    const store = safeStorage(this.opt);
    if (!store) return;
    try {
      if (payload) store.setItem(cacheKey(this.id), JSON.stringify({ at: Date.now(), payload }));
      else store.removeItem(cacheKey(this.id));
    } catch {
      /* a full quota must not break the save loop */
    }
  }

  /** Queue a change. Identical payloads are ignored, so rerenders are free. */
  queue(payload: DraftPayload) {
    if (this.destroyed) return;
    const body = { ...payload, id: this.id };
    const serialized = JSON.stringify(body);
    if (serialized === this.lastSerialized && this.state !== "error") return;
    this.pending = body;
    this.cache(body);
    const { set, clear } = this.timers();
    if (this.timer) clear(this.timer);
    this.timer = set(() => {
      this.timer = null;
      void this.flush();
    }, this.opt.debounceMs ?? 800);
  }

  /** Persist immediately. Resolves once nothing is left to write. */
  async flush(): Promise<void> {
    if (this.destroyed) return;
    const { clear } = this.timers();
    if (this.timer) {
      clear(this.timer);
      this.timer = null;
    }
    if (this.inflight || !this.pending) return;
    const body = this.pending;
    this.pending = null;
    this.inflight = true;
    this.emit("saving");
    try {
      await this.opt.save(body);
      this.inflight = false;
      this.attempt = 0;
      this.lastSerialized = JSON.stringify(body);
      this.cache(null);
      this.emit("saved");
      if (this.pending) await this.flush();
    } catch (e: any) {
      this.inflight = false;
      /* Keep the newest payload; a change made mid-flight wins. */
      this.pending = this.pending ?? body;
      this.attempt += 1;
      const steps = this.opt.retryMs ?? [1000, 3000, 8000];
      this.emit("error", { error: (e && e.message) || "Couldn't save", attempt: this.attempt });
      if (this.attempt <= steps.length) {
        const wait = steps[Math.min(this.attempt - 1, steps.length - 1)] ?? 3000;
        const { set } = this.timers();
        this.timer = set(() => {
          this.timer = null;
          void this.flush();
        }, wait);
      }
    }
  }

  /** Manual "Try Again" from the UI. */
  retryNow() {
    this.attempt = 0;
    return this.flush();
  }

  destroy() {
    const { clear } = this.timers();
    if (this.timer) clear(this.timer);
    this.timer = null;
    this.destroyed = true;
  }
}

/* ------------------------------------------------ one-time local migration */

export const LEGACY_STAGING_KEY = "rd.staging.draft";

export type MigrationDeps = {
  save: (payload: DraftPayload) => Promise<unknown>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  newId?: () => string;
};

/**
 * Move a legacy browser-only staging draft onto the server exactly once. The
 * local copy is deleted only after the server confirms the write.
 */
export async function migrateLegacyStagingDraft(
  deps: MigrationDeps,
): Promise<{ migrated: boolean; id?: string }> {
  const store =
    deps.storage !== undefined
      ? deps.storage
      : typeof localStorage === "undefined"
        ? null
        : localStorage;
  if (!store) return { migrated: false };
  let raw: string | null = null;
  try {
    raw = store.getItem(LEGACY_STAGING_KEY);
  } catch {
    return { migrated: false };
  }
  if (!raw) return { migrated: false };
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      store.removeItem(LEGACY_STAGING_KEY);
    } catch {}
    return { migrated: false };
  }
  const items: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
  const usable = items.filter(
    (i) => i && typeof i.path === "string" && i.path && !/^blob:/.test(i.path),
  );
  if (!usable.length) {
    try {
      store.removeItem(LEGACY_STAGING_KEY);
    } catch {}
    return { migrated: false };
  }
  const id = (deps.newId ?? newDraftId)();
  const payload: DraftPayload = {
    id,
    project_type: "photo_staging",
    status: "draft",
    builder_step: "review",
    property_address: parsed?.address || null,
    assets: usable.map((i, n) => ({
      key: i.key || "p" + n,
      path: i.path,
      name: i.name || null,
      room: i.room || null,
      room_source:
        i.roomSource === "manual" || i.roomSource === "library"
          ? i.roomSource
          : i.room
            ? "ai"
            : "none",
      confidence: Number(i.confidence || 0),
      selected: i.selected !== false,
      done: !!i.done,
      status: "ready",
    })),
    item_order: usable.map((i, n) => i.key || "p" + n),
  };
  await deps.save(payload);
  try {
    store.removeItem(LEGACY_STAGING_KEY);
  } catch {}
  return { migrated: true, id };
}

/** Read an unconfirmed recovery payload, if the last session died mid-save. */
export function readRecoveryCache(
  id: string,
  storage?: Pick<Storage, "getItem"> | null,
): DraftPayload | null {
  const store =
    storage !== undefined ? storage : typeof localStorage === "undefined" ? null : localStorage;
  if (!store) return null;
  try {
    const raw = store.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
}
