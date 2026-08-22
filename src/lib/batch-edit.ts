/**
 * REAL DESIGNS — Batch Editing and Copy/Paste Adjustments.
 *
 * One pure engine shared by the Photo Editor, the batch workspace and the
 * tests. It decides WHAT transfers between photographs and never touches the
 * DOM, the network or a canvas.
 *
 * Two rules govern everything here:
 *
 *  1. Ordinary adjustments (light, colour, detail, look) transfer freely,
 *     because they describe an intent that survives a change of subject.
 *  2. Anything tied to a specific frame — crop position, rotation,
 *     perspective, privacy masks, object masks, AI results — never transfers
 *     unless the user explicitly asks for it, one category at a time.
 *
 * Generative operations (Stage, Redesign, Declutter, Materials, Object
 * Removal, Day To Dusk…) are excluded from ordinary batch editing by
 * construction: they cost credits, change the scene and need per-photo review.
 */

import { autoEnhanceAdjustments, type PhotoStats, type Strength } from "@/lib/photo-auto-enhance";

/* --------------------------------------------------------------- adjustments */

export type Adj = Record<string, number>;

export const LIGHT_KEYS = ["exposure", "contrast", "highlights", "shadows", "whites", "blacks"];
export const COLOR_KEYS = ["temperature", "tint", "vibrance", "saturation"];
export const DETAIL_KEYS = ["sharpen", "denoise", "clarity", "dehaze", "lens"];

/** Bounds used when adjustments are added together. */
export const ADJ_RANGE: Record<string, [number, number]> = {
  exposure: [-100, 100],
  contrast: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  whites: [-100, 100],
  blacks: [-100, 100],
  temperature: [-100, 100],
  tint: [-100, 100],
  vibrance: [-100, 100],
  saturation: [-100, 100],
  sharpen: [0, 100],
  denoise: [0, 100],
  clarity: [-100, 100],
  dehaze: [-100, 100],
  lens: [-100, 100],
};

export function clampAdjValue(key: string, v: number): number {
  const [lo, hi] = ADJ_RANGE[key] || [-100, 100];
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
}

export const ADJ_KEYS = [...LIGHT_KEYS, ...COLOR_KEYS, ...DETAIL_KEYS];

/* ---------------------------------------------------------------- categories */

export type PasteCategory =
  | "light"
  | "color"
  | "detail"
  | "look"
  | "cropRatio"
  | "rotation"
  | "geometry";

export const PASTE_CATEGORIES: {
  id: PasteCategory;
  label: string;
  hint: string;
  /** Ticked when the selective paste sheet opens. */
  default: boolean;
}[] = [
  { id: "light", label: "Light", hint: "Exposure, Contrast, Highlights, Shadows, Whites, Blacks", default: true },
  { id: "color", label: "Color", hint: "Temperature, Tint, Vibrance, Saturation", default: true },
  { id: "detail", label: "Detail", hint: "Sharpen, Denoise, Clarity, Dehaze", default: true },
  { id: "look", label: "Look", hint: "The Selected Preset Or Look", default: false },
  { id: "cropRatio", label: "Crop Ratio", hint: "Ratio Only — Never The Crop Position", default: false },
  { id: "rotation", label: "Rotation", hint: "Quarter Turns And Flips", default: false },
  { id: "geometry", label: "Geometry", hint: "Straighten And Perspective Correction", default: false },
];

export function defaultPasteCategories(): PasteCategory[] {
  return PASTE_CATEGORIES.filter((c) => c.default).map((c) => c.id);
}

function keysFor(cat: PasteCategory): string[] {
  if (cat === "light") return LIGHT_KEYS;
  if (cat === "color") return COLOR_KEYS;
  if (cat === "detail") return DETAIL_KEYS;
  return [];
}

/* ------------------------------------------------------------ copy clipboard */

export type CopiedAdjustments = {
  adj: Adj;
  look: string | null;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  geometry: { straighten: number; vertical: number; horizontal: number };
  /** Ratio identifier only. A crop rectangle belongs to one photograph. */
  cropRatio: string | null;
  sourceKey: string;
  sourceLabel: string;
  copiedAt: number;
};

export type CopySource = {
  key?: string;
  label?: string;
  adj?: Adj;
  look?: string | null;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  straighten?: number;
  vertical?: number;
  horizontal?: number;
  crop?: { ratio?: string } | null;
  /** Present on the state, deliberately dropped by the copy. */
  privacyMask?: unknown;
  objectMask?: unknown;
  aiOps?: string[];
};

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * Copy the ordinary adjustments. Masks and AI results are dropped here, at the
 * source, so nothing downstream can leak them into another photograph.
 */
export function copyAdjustments(src: CopySource): CopiedAdjustments {
  const adj: Adj = {};
  for (const k of ADJ_KEYS) {
    const v = num(src.adj?.[k], 0);
    if (v !== 0) adj[k] = v;
  }
  return {
    adj,
    look: src.look ?? null,
    rotation: num(src.rotation, 0),
    flipH: !!src.flipH,
    flipV: !!src.flipV,
    geometry: {
      straighten: num(src.straighten, 0),
      vertical: num(src.vertical, 0),
      horizontal: num(src.horizontal, 0),
    },
    cropRatio: src.crop?.ratio || null,
    sourceKey: String(src.key || ""),
    sourceLabel: String(src.label || src.key || "Photo"),
    copiedAt: Date.now(),
  };
}

/* --------------------------------------------------------------- apply modes */

export type ApplyMode = "replace" | "add" | "reset";

export const APPLY_MODES: { id: ApplyMode; label: string; hint: string }[] = [
  { id: "replace", label: "Replace Existing Adjustments", hint: "Pasted Values Overwrite The Same Sliders" },
  { id: "add", label: "Add To Existing Adjustments", hint: "Values Are Summed And Kept Within Range" },
  { id: "reset", label: "Reset Then Apply", hint: "Clears Every Adjustment First" },
];

export type PasteTarget = {
  adj?: Adj;
  look?: string | null;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  straighten?: number;
  vertical?: number;
  horizontal?: number;
  crop?: { x: number; y: number; w: number; h: number; ratio: string } | null;
};

export type PasteResult = {
  adj: Adj;
  look: string | null;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  straighten: number;
  vertical: number;
  horizontal: number;
  cropRatio: string | null;
  /** Keys that hit their bound while adding, so the sheet can warn. */
  clipped: string[];
};

/**
 * Apply the selected categories of a copied bundle onto one target. Pure:
 * callers merge the result into their own state.
 */
export function applyCopied(
  target: PasteTarget,
  copied: CopiedAdjustments,
  categories: PasteCategory[],
  mode: ApplyMode = "replace",
): PasteResult {
  const want = new Set(categories);
  const base: Adj = mode === "reset" ? {} : { ...(target.adj || {}) };
  const clipped: string[] = [];

  for (const cat of ["light", "color", "detail"] as const) {
    if (!want.has(cat)) continue;
    for (const k of keysFor(cat)) {
      const incoming = num(copied.adj[k], 0);
      if (mode === "add") {
        const sum = num(base[k], 0) + incoming;
        const next = clampAdjValue(k, sum);
        if (Math.abs(sum - next) > 0.001) clipped.push(k);
        base[k] = Math.round(next * 10) / 10;
      } else {
        base[k] = clampAdjValue(k, incoming);
      }
      if (base[k] === 0) delete base[k];
    }
  }

  return {
    adj: base,
    look: want.has("look") ? copied.look : (target.look ?? null),
    rotation: want.has("rotation") ? copied.rotation : num(target.rotation, 0),
    flipH: want.has("rotation") ? copied.flipH : !!target.flipH,
    flipV: want.has("rotation") ? copied.flipV : !!target.flipV,
    straighten: want.has("geometry") ? copied.geometry.straighten : num(target.straighten, 0),
    vertical: want.has("geometry") ? copied.geometry.vertical : num(target.vertical, 0),
    horizontal: want.has("geometry") ? copied.geometry.horizontal : num(target.horizontal, 0),
    cropRatio: want.has("cropRatio") ? copied.cropRatio : (target.crop?.ratio ?? null),
    clipped: Array.from(new Set(clipped)),
  };
}

/** Human warning shown before an "Add To Existing Adjustments" batch run. */
export function clippingNotice(clipped: string[]): string | null {
  if (!clipped.length) return null;
  return `Adding These Values Pushes ${clipped.length} Setting${
    clipped.length === 1 ? "" : "s"
  } To The Edge Of Its Range. The Result Is Clamped, So Some Photos May Look Identical.`;
}

/* ------------------------------------------------------------- mixed values */

export type MixedValue = { value: number; mixed: boolean };

/**
 * What a batch panel shows for each slider across the selected photographs:
 * the shared value, or a mixed indicator when they disagree.
 */
export function mixedValues(list: Adj[]): Record<string, MixedValue> {
  const out: Record<string, MixedValue> = {};
  for (const k of ADJ_KEYS) {
    const vals = list.map((a) => num(a?.[k], 0));
    const first = vals.length ? (vals[0] as number) : 0;
    const mixed = vals.some((v) => Math.abs(v - first) > 0.001);
    out[k] = { value: mixed ? 0 : first, mixed };
  }
  return out;
}

/** Only the sliders worth showing: anything set on at least one photo. */
export function activeMixedKeys(values: Record<string, MixedValue>): string[] {
  return ADJ_KEYS.filter((k) => values[k] && (values[k]!.mixed || values[k]!.value !== 0));
}

/* --------------------------------------------------------- batch auto enhance */

export type AutoRecommendation = {
  key: string;
  label: string;
  /** Scene-aware values for THIS photograph only. */
  adj: Adj;
  approved: boolean;
  /** Empty when the photograph is already well exposed. */
  summary: string;
};

/**
 * Analyse each photograph on its own terms. There is deliberately no shared
 * exposure value: the same stats always produce the same recommendation, and
 * a photo that needs nothing receives nothing.
 */
export function batchAutoEnhance(
  rows: { key: string; label?: string; stats: PhotoStats | null }[],
  strength: Strength = "balanced",
): AutoRecommendation[] {
  return rows.map((r) => {
    const adj = r.stats ? autoEnhanceAdjustments(r.stats, strength) : {};
    const touched = Object.entries(adj).filter(([, v]) => Math.abs(num(v, 0)) >= 0.5);
    return {
      key: r.key,
      label: r.label || r.key,
      adj: Object.fromEntries(touched),
      approved: touched.length > 0,
      summary: touched.length
        ? touched
            .slice(0, 3)
            .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${Math.round(v as number)}`)
            .join(", ")
        : "Already Well Balanced",
    };
  });
}

/**
 * Auto Enhance is layered on a stored base, never on itself, so running it
 * twice produces the same photograph.
 */
export function autoEnhanceIdempotent(base: Adj, recommendation: Adj): Adj {
  const out: Adj = { ...base };
  for (const [k, v] of Object.entries(recommendation)) {
    const next = clampAdjValue(k, num(base[k], 0) + num(v, 0));
    out[k] = Math.round(next * 10) / 10;
    if (out[k] === 0) delete out[k];
  }
  return out;
}

/* ------------------------------------------------------ generative operations */

export const GENERATIVE_OPS = [
  "redesign",
  "stage",
  "virtual-stage",
  "declutter",
  "materials",
  "material-swap",
  "object-edit",
  "object-removal",
  "day-to-dusk",
  "sketch",
  "angles",
  "animate",
  "floorplan",
] as const;

export type GenerativeOp = (typeof GENERATIVE_OPS)[number];

export function isGenerativeOp(op: string): boolean {
  return (GENERATIVE_OPS as readonly string[]).includes(String(op || "").toLowerCase());
}

/** Ordinary Batch Edit accepts pixel operations only. */
export function filterOrdinaryOps(ops: string[]): string[] {
  return ops.filter((o) => !isGenerativeOp(o));
}

/** Credits per photograph, mirrored from the one credit currency. */
export const GENERATIVE_COST: Record<string, number> = {
  redesign: 1,
  stage: 1,
  "virtual-stage": 1,
  declutter: 1,
  materials: 1,
  "material-swap": 1,
  "object-edit": 1,
  "object-removal": 1,
  "day-to-dusk": 1,
  sketch: 1,
  angles: 1,
  floorplan: 6,
  animate: 40,
};

export function batchCreditCost(op: string, photoCount: number): number {
  const per = GENERATIVE_COST[String(op || "").toLowerCase()] ?? 1;
  return per * Math.max(0, Math.floor(photoCount));
}

/* ------------------------------------------------------------ batch records */

export type BatchPhotoStatus = "pending" | "running" | "done" | "failed" | "undone";

export type BatchPhoto = {
  key: string;
  label: string;
  status: BatchPhotoStatus;
  /** Durable version produced for this photograph, when it succeeded. */
  versionId: string | null;
  error: string | null;
  /** Snapshot taken before the batch touched the photo, for undo. */
  before: PasteResult | null;
};

export type BatchRecord = {
  id: string;
  kind: "adjustments" | "auto-enhance" | "generative" | "privacy" | "disclosure";
  createdAt: number;
  userId: string | null;
  /** What was applied — categories, mode, op, strength. */
  settings: Record<string, any>;
  sourceKey: string | null;
  photos: BatchPhoto[];
};

export function newBatch(input: {
  kind: BatchRecord["kind"];
  settings: Record<string, any>;
  sourceKey?: string | null;
  userId?: string | null;
  photos: { key: string; label?: string; before?: PasteResult | null }[];
}): BatchRecord {
  return {
    id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    createdAt: Date.now(),
    userId: input.userId ?? null,
    settings: input.settings || {},
    sourceKey: input.sourceKey ?? null,
    photos: input.photos.map((p) => ({
      key: p.key,
      label: p.label || p.key,
      status: "pending" as BatchPhotoStatus,
      versionId: null,
      error: null,
      before: p.before ?? null,
    })),
  };
}

export function markPhoto(
  batch: BatchRecord,
  key: string,
  patch: Partial<Pick<BatchPhoto, "status" | "versionId" | "error">>,
): BatchRecord {
  return {
    ...batch,
    photos: batch.photos.map((p) => (p.key === key ? { ...p, ...patch } : p)),
  };
}

export function batchProgress(batch: BatchRecord): {
  total: number;
  done: number;
  failed: number;
  pending: number;
  complete: boolean;
} {
  const total = batch.photos.length;
  const done = batch.photos.filter((p) => p.status === "done").length;
  const failed = batch.photos.filter((p) => p.status === "failed").length;
  const pending = batch.photos.filter((p) => p.status === "pending" || p.status === "running").length;
  return { total, done, failed, pending, complete: pending === 0 };
}

/** Retry touches failures only: a successful photograph is never rerun. */
export function retryTargets(batch: BatchRecord): BatchPhoto[] {
  return batch.photos.filter((p) => p.status === "failed");
}

/** Photos an undo would restore — successes only, and only once. */
export function undoTargets(batch: BatchRecord): BatchPhoto[] {
  return batch.photos.filter((p) => p.status === "done");
}

export function markUndone(batch: BatchRecord, keys: string[]): BatchRecord {
  const set = new Set(keys);
  return {
    ...batch,
    photos: batch.photos.map((p) =>
      set.has(p.key) && p.status === "done" ? { ...p, status: "undone" as BatchPhotoStatus } : p,
    ),
  };
}

export function changedPhotos(batch: BatchRecord): BatchPhoto[] {
  return batch.photos.filter((p) => p.status === "done" || p.status === "undone");
}

/* -------------------------------------------------------------- persistence */

const KEY = "rd.batch.progress.v1";

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Local mirror so a refresh mid-batch restores the progress immediately. */
export function saveBatchLocal(batch: BatchRecord): void {
  try {
    const rows = listBatchesLocal().filter((b) => b.id !== batch.id);
    rows.unshift(batch);
    store()?.setItem(KEY, JSON.stringify(rows.slice(0, 10)));
  } catch {
    /* progress mirroring is a convenience, never a blocker */
  }
}

export function listBatchesLocal(): BatchRecord[] {
  try {
    const raw = store()?.getItem(KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? (rows as BatchRecord[]) : [];
  } catch {
    return [];
  }
}

export function latestUnfinishedBatch(): BatchRecord | null {
  return listBatchesLocal().find((b) => !batchProgress(b).complete) || null;
}

export function clearBatchLocal(id: string): void {
  try {
    store()?.setItem(KEY, JSON.stringify(listBatchesLocal().filter((b) => b.id !== id)));
  } catch {
    /* noop */
  }
}
