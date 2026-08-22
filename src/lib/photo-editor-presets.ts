/**
 * REAL DESIGNS — Photo Editor crop presets, export presets, adjustment
 * clipboard, disclosure overlays and the automatic quality review.
 *
 * Pure decisions only, so every rule below is unit-tested without a browser.
 */

import type { PhotoStats } from "@/lib/photo-auto-enhance";

/* ------------------------------------------------------------------- crop */

export type CropPreset = {
  id: string;
  label: string;
  /** width / height, or null for Free / Original. */
  v: number | null;
  group: "basic" | "mls";
  note?: string;
};

export const CROP_PRESETS: CropPreset[] = [
  { id: "original", label: "Original", v: null, group: "basic" },
  { id: "free", label: "Free", v: null, group: "basic" },
  { id: "1:1", label: "1:1", v: 1, group: "basic" },
  { id: "4:3", label: "4:3", v: 4 / 3, group: "basic" },
  { id: "3:2", label: "3:2", v: 3 / 2, group: "basic" },
  { id: "16:9", label: "16:9", v: 16 / 9, group: "basic" },
  { id: "9:16", label: "9:16", v: 9 / 16, group: "basic" },
  { id: "mls-4:3", label: "MLS Standard", v: 4 / 3, group: "mls", note: "1024 × 768" },
  { id: "mls-3:2", label: "MLS Wide", v: 3 / 2, group: "mls", note: "1500 × 1000" },
  { id: "mls-16:9", label: "MLS Hero", v: 16 / 9, group: "mls", note: "1920 × 1080" },
];

export function cropPreset(id: string): CropPreset | undefined {
  return CROP_PRESETS.find((r) => r.id === id);
}

/* ----------------------------------------------------------------- export */

export type ExportPreset = {
  id: string;
  label: string;
  /** Longest edge in pixels; 0 keeps the rendered size. */
  maxEdge: number;
  quality: number;
  note: string;
};

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: "mls", label: "MLS Standard", maxEdge: 1024, quality: 0.85, note: "1024 px · JPEG 85" },
  { id: "mls-hd", label: "MLS High Resolution", maxEdge: 2048, quality: 0.9, note: "2048 px · JPEG 90" },
  { id: "web", label: "Web & Social", maxEdge: 1600, quality: 0.82, note: "1600 px · JPEG 82" },
  { id: "full", label: "Full Resolution", maxEdge: 0, quality: 0.95, note: "Original size · JPEG 95" },
];

export function exportPreset(id: string): ExportPreset {
  return EXPORT_PRESETS.find((p) => p.id === id) || (EXPORT_PRESETS[3] as ExportPreset);
}

/** Target pixel size for an export, preserving aspect ratio. */
export function exportSize(w: number, h: number, maxEdge: number): { w: number; h: number } {
  if (!maxEdge || Math.max(w, h) <= maxEdge) return { w, h };
  const k = maxEdge / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export function exportFileName(name: string, presetId: string, version?: number | null): string {
  const base = (name || "photo").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
  const v = version || version === 0 ? `-v${version}` : "";
  return `${base || "photo"}${v}-${presetId}.jpg`;
}

/* ------------------------------------------------------------- disclosure */

export type { Classification } from "@/lib/disclosure";
import { classifyVersion, captionFor, DEFAULT_DISCLOSURE_SETTINGS, recommendDisclosure, type Classification } from "@/lib/disclosure";

/**
 * Classification and disclosure wording both come from the canonical
 * Disclosure & Watermark system, so the editor, batch exports, shares and
 * videos can never disagree about what a version is.
 */
export function classifyEdits(input: { aiOps: string[]; hasAdjustments: boolean }): Classification {
  return classifyVersion({
    operations: [...(input.aiOps || []), ...(input.hasAdjustments ? ["adjust"] : [])],
    hasAdjustments: !!input.hasAdjustments,
  });
}

/** Caption a given classification would carry in an export. */
export function disclosureText(c: Classification): string | null {
  const rec = recommendDisclosure({ classification: c });
  if (rec.id === "none") return null;
  return captionFor({ ...DEFAULT_DISCLOSURE_SETTINGS, id: rec.id, style: "translucent" });
}

/* -------------------------------------------------------- quality review */

export type QualityIssue = { level: "warn" | "info"; message: string };

/**
 * The automatic review that runs before an export. It reports, it never
 * silently changes anything.
 */
export function qualityReview(input: {
  stats: PhotoStats | null;
  adj: Record<string, number>;
  cropArea?: number | null;
  exportWidth?: number;
}): QualityIssue[] {
  const out: QualityIssue[] = [];
  const a = (k: string) => Number(input.adj?.[k] ?? 0) || 0;
  if (input.stats) {
    if (input.stats.clippedHighlights > 0.02)
      out.push({ level: "warn", message: "Highlights Are Clipping — Windows May Print Pure White" });
    if (input.stats.clippedShadows > 0.02)
      out.push({ level: "warn", message: "Shadows Are Clipping — Detail Is Being Lost" });
  }
  if (Math.abs(a("saturation")) + Math.abs(a("vibrance")) > 90)
    out.push({ level: "warn", message: "Colour Is Pushed Very Hard For A Listing Photo" });
  if (Math.abs(a("exposure")) > 60)
    out.push({ level: "warn", message: "Exposure Is Pushed Beyond A Truthful Correction" });
  if (a("sharpen") > 75) out.push({ level: "info", message: "Heavy Sharpening Can Show Haloes On Edges" });
  if (input.cropArea != null && input.cropArea < 0.25)
    out.push({ level: "warn", message: "This Crop Keeps Less Than A Quarter Of The Photograph" });
  if (input.exportWidth != null && input.exportWidth < 1024)
    out.push({ level: "info", message: "Most MLS Systems Expect At Least 1024 Px On The Long Edge" });
  return out;
}

/* --------------------------------------------------- adjustment clipboard */

export type AdjustmentBundle = {
  adj: Record<string, number>;
  straighten: number;
  vertical: number;
  horizontal: number;
  flipH: boolean;
  flipV: boolean;
  rotation: number;
  /** Crop is intentionally optional: composition rarely transfers. */
  crop?: { x: number; y: number; w: number; h: number; ratio: string } | null;
};

export type PasteOptions = { includeGeometry?: boolean; includeCrop?: boolean };

/** Merge a copied bundle into a target state shape. Pure. */
export function mergeBundle<T extends Record<string, any>>(
  target: T,
  bundle: AdjustmentBundle,
  opts: PasteOptions = {},
): T {
  const out: any = { ...target, adj: { ...(bundle.adj || {}) } };
  if (opts.includeGeometry) {
    out.straighten = bundle.straighten || 0;
    out.vertical = bundle.vertical || 0;
    out.horizontal = bundle.horizontal || 0;
    out.flipH = !!bundle.flipH;
    out.flipV = !!bundle.flipV;
    out.rotation = bundle.rotation || 0;
  }
  if (opts.includeCrop) out.crop = bundle.crop ?? null;
  return out as T;
}

/* ------------------------------------------------------------- presets */

export type SavedPreset = { id: string; name: string; bundle: AdjustmentBundle; createdAt: number };

const KEY = "rd.photo.presets.v1";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function listPresets(): SavedPreset[] {
  try {
    const raw = storage()?.getItem(KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function savePreset(name: string, bundle: AdjustmentBundle): SavedPreset[] {
  const clean = (name || "").trim().slice(0, 40) || "Preset";
  const rows = listPresets().filter((p) => p.name.toLowerCase() !== clean.toLowerCase());
  rows.unshift({ id: `${Date.now()}`, name: clean, bundle, createdAt: Date.now() });
  const kept = rows.slice(0, 24);
  try {
    storage()?.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* presets are a convenience, never a blocker */
  }
  return kept;
}

export function deletePreset(id: string): SavedPreset[] {
  const kept = listPresets().filter((p) => p.id !== id);
  try {
    storage()?.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* noop */
  }
  return kept;
}
