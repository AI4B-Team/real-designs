/**
 * REAL DESIGNS — Privacy Blur.
 *
 * “Automatically find or manually select sensitive information and permanently
 * blur it in a new non-destructive photo version.”
 *
 * Everything here is deterministic and local: detection may come from a model,
 * but the pixels are baked in the browser from the same geometry the user saw,
 * so an exported file can never be an original wearing a CSS blur. Selection,
 * brushing, undo and redo belong to the canonical mask engine — this module
 * adds no second brush.
 */

import {
  MAX_MASK_EDGE,
  paintFromState,
  paintMaskLayer,
  type DetectedRegion,
  type MaskPaint,
  type MaskState,
} from "@/lib/mask-engine";

/* ------------------------------------------------------------ vocabulary */

export type BlurType = "gaussian" | "pixelate" | "redact";

export type PrivacyCategory =
  | "face"
  | "plate"
  | "document"
  | "screen"
  | "tv"
  | "reflection"
  | "text"
  | "other";

export type PrivacyDetection = DetectedRegion & {
  category: PrivacyCategory;
};

export const PRIVACY_CATEGORIES: Array<{
  id: PrivacyCategory;
  label: string;
  group: string;
  icon: string;
  hint: string;
}> = [
  { id: "face", label: "Faces", group: "faces", icon: "user-round", hint: "a person's face" },
  { id: "plate", label: "License Plates", group: "plates", icon: "car", hint: "a vehicle number plate" },
  { id: "document", label: "Documents", group: "documents", icon: "file-text", hint: "paperwork, mail, certificates" },
  { id: "screen", label: "Computer Screens", group: "screens", icon: "monitor", hint: "a monitor or laptop screen" },
  { id: "tv", label: "Television Screens", group: "screens", icon: "tv", hint: "a television screen" },
  { id: "reflection", label: "Reflections", group: "faces", icon: "sparkle", hint: "a person reflected in glass or a mirror" },
  { id: "text", label: "Sensitive Text", group: "documents", icon: "type", hint: "names, addresses, phone numbers, photos of people" },
  { id: "other", label: "Other", group: "documents", icon: "shield", hint: "any other identifying detail" },
];

export const BLUR_TYPES: Array<{ id: BlurType; label: string; icon: string; note: string }> = [
  { id: "gaussian", label: "Gaussian Blur", icon: "droplet", note: "Softens the selected pixels beyond recognition." },
  { id: "pixelate", label: "Pixelate", icon: "grid-3x3", note: "Replaces the selection with large blocks." },
  {
    id: "redact",
    label: "Solid Redaction",
    icon: "square",
    note: "Permanently blocks the selection with solid colour in every saved and exported file.",
  },
];

export function categoryLabel(id: string): string {
  return PRIVACY_CATEGORIES.find((c) => c.id === id)?.label || "Other";
}

export function categoryGroup(id: string): string {
  return PRIVACY_CATEGORIES.find((c) => c.id === id)?.group || "documents";
}

/** Solid Redaction is the only irreversible-sounding option; say so plainly. */
export function blurTypeNote(type: BlurType): string {
  return BLUR_TYPES.find((b) => b.id === type)?.note || "";
}

/* -------------------------------------------------------------- settings */

export type PrivacySettings = {
  type: BlurType;
  /** 1..100 */
  strength: number;
  /** 0..100 */
  feather: number;
  /** Brush diameter in source pixels, 4..200. */
  brush: number;
};

export const BRUSH_MIN = 4;
export const BRUSH_MAX = 200;

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  type: "gaussian",
  strength: 60,
  feather: 25,
  brush: 48,
};

const clampNum = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

export function clampPrivacySettings(input: Partial<PrivacySettings> | null | undefined): PrivacySettings {
  const type = (input?.type && BLUR_TYPES.some((b) => b.id === input.type) ? input.type : "gaussian") as BlurType;
  return {
    type,
    strength: Math.round(clampNum(input?.strength, 1, 100, DEFAULT_PRIVACY_SETTINGS.strength)),
    feather: Math.round(clampNum(input?.feather, 0, 100, DEFAULT_PRIVACY_SETTINGS.feather)),
    brush: Math.round(clampNum(input?.brush, BRUSH_MIN, BRUSH_MAX, DEFAULT_PRIVACY_SETTINGS.brush)),
  };
}

/** Gaussian radius in pixels at the given render width. */
export function blurRadiusPx(strength: number, edge: number): number {
  const s = clampNum(strength, 1, 100, 60) / 100;
  return Math.max(2, Math.round(edge * 0.006 + edge * 0.055 * s));
}

/** Pixelate block size in pixels at the given render width. */
export function pixelBlockPx(strength: number, edge: number): number {
  const s = clampNum(strength, 1, 100, 60) / 100;
  return Math.max(3, Math.round(edge * 0.004 + edge * 0.05 * s));
}

/** Feather radius in pixels at the given render width. */
export function featherPx(feather: number, edge: number): number {
  const f = clampNum(feather, 0, 100, 0) / 100;
  return Math.round(edge * 0.03 * f);
}

/** Brush diameter (source px) expressed as the engine's short-edge fraction. */
export function brushFraction(brushPx: number, shortEdge: number): number {
  const px = clampNum(brushPx, BRUSH_MIN, BRUSH_MAX, 48);
  const edge = Math.max(1, shortEdge || 1000);
  return Math.min(0.4, Math.max(0.005, px / edge));
}

/* ------------------------------------------------------------ selection */

/** Ids of every detection in one category group ("faces", "plates", …). */
export function idsInGroup(detections: PrivacyDetection[], group: string): string[] {
  return detections.filter((d) => categoryGroup(d.category) === group).map((d) => d.id);
}

/** Selects every detection in a group without disturbing other selections. */
export function selectGroup(state: MaskState, detections: PrivacyDetection[], group: string): MaskState {
  const add = idsInGroup(detections, group);
  const next = new Set(state.selectedRegions);
  add.forEach((id) => next.add(id));
  return { ...state, selectedRegions: Array.from(next) };
}

export function selectAll(state: MaskState, detections: PrivacyDetection[]): MaskState {
  return { ...state, selectedRegions: detections.map((d) => d.id) };
}

export function deselectAll(state: MaskState): MaskState {
  return { ...state, selectedRegions: [] };
}

/** Detections the model found that the user has not chosen to obscure. */
export function unselectedSensitive(state: MaskState, detections: PrivacyDetection[]): PrivacyDetection[] {
  const on = new Set(state.selectedRegions);
  return detections.filter((d) => !on.has(d.id));
}

/** The warning shown before export or sharing; null when nothing is left. */
export function exportWarning(state: MaskState, detections: PrivacyDetection[]): string | null {
  const left = unselectedSensitive(state, detections);
  if (!left.length) return null;
  const counts = new Map<string, number>();
  left.forEach((d) => counts.set(categoryLabel(d.category), (counts.get(categoryLabel(d.category)) || 0) + 1));
  const parts = Array.from(counts.entries()).map(([label, n]) => `${n} ${label}`);
  return `${left.length} Detected Sensitive Area${left.length === 1 ? "" : "s"} Remain Unblurred: ${parts.join(", ")}.`;
}

/** True when there is something to bake. */
export function hasPrivacySelection(state: MaskState, detections: PrivacyDetection[]): boolean {
  const known = new Set(detections.map((d) => d.id));
  return state.strokes.some((s) => s.mode === "add") || state.selectedRegions.some((id) => known.has(id));
}

/* ------------------------------------------------------------- metadata */

/** Every Privacy Blur result is a truthful photo with pixels removed. */
export const PRIVACY_CLASSIFICATION = "Digitally Altered";

export type PrivacyMetadata = {
  op: "privacy_blur";
  source_version: string | null;
  categories: PrivacyCategory[];
  detections: number;
  manual_strokes: number;
  blur_type: BlurType;
  strength: number;
  feather: number;
  result_path: string | null;
  modification_class: string;
  credits: 0;
};

/**
 * What we persist. Deliberately free of anything the model read: no OCR text,
 * no labels the detector wrote, no crops of the sensitive area — only the
 * category, the geometry count and the settings used.
 */
export function privacyMetadata(input: {
  state: MaskState;
  detections: PrivacyDetection[];
  settings: PrivacySettings;
  sourceVersion?: string | null;
  resultPath?: string | null;
}): PrivacyMetadata {
  const on = new Set(input.state.selectedRegions);
  const used = input.detections.filter((d) => on.has(d.id));
  const categories = Array.from(new Set(used.map((d) => d.category))) as PrivacyCategory[];
  const s = clampPrivacySettings(input.settings);
  return {
    op: "privacy_blur",
    source_version: input.sourceVersion ?? null,
    categories,
    detections: used.length,
    manual_strokes: input.state.strokes.filter((k) => k.mode === "add").length,
    blur_type: s.type,
    strength: s.strength,
    feather: s.feather,
    result_path: input.resultPath ?? null,
    modification_class: PRIVACY_CLASSIFICATION,
    credits: 0,
  };
}

/** Detections stripped of anything a detector may have transcribed. */
export function safeDetections(raw: PrivacyDetection[]): PrivacyDetection[] {
  return raw.map((d) => ({
    id: d.id,
    label: categoryLabel(d.category),
    confidence: d.confidence,
    ...(d.box ? { box: d.box } : {}),
    category: d.category,
  }));
}

/* ---------------------------------------------------------------- batch */

export type BatchItem = {
  key: string;
  label: string;
  detections: PrivacyDetection[];
  reviewed: boolean;
  approved: boolean;
};

/** A property is never blurred wholesale: only reviewed AND approved photos run. */
export function batchRunnable(items: BatchItem[]): BatchItem[] {
  return items.filter((i) => i.reviewed && i.approved && i.detections.length > 0);
}

export function batchBlocked(items: BatchItem[]): number {
  return items.filter((i) => i.detections.length > 0 && !(i.reviewed && i.approved)).length;
}

/* ---------------------------------------------------------------- bake */

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    } catch (_) {
      resolve(null);
    }
  });
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** The obscured version of the whole frame; the mask decides what survives. */
function effectLayer(
  img: CanvasImageSource,
  W: number,
  H: number,
  settings: PrivacySettings,
): HTMLCanvasElement {
  const out = canvasOf(W, H);
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  if (settings.type === "redact") {
    ctx.fillStyle = "#0b0b0c";
    ctx.fillRect(0, 0, W, H);
    return out;
  }
  if (settings.type === "pixelate") {
    const block = pixelBlockPx(settings.strength, Math.max(W, H));
    const sw = Math.max(1, Math.round(W / block));
    const sh = Math.max(1, Math.round(H / block));
    const small = canvasOf(sw, sh);
    const sctx = small.getContext("2d");
    if (sctx) sctx.drawImage(img, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, sw, sh, 0, 0, W, H);
    return out;
  }
  const r = blurRadiusPx(settings.strength, Math.max(W, H));
  /* Two passes: the filter alone leaves recoverable structure at low radius. */
  (ctx as any).filter = `blur(${r}px)`;
  ctx.drawImage(img, 0, 0, W, H);
  (ctx as any).filter = `blur(${Math.max(2, Math.round(r * 0.5))}px)`;
  ctx.drawImage(out, 0, 0, W, H);
  (ctx as any).filter = "none";
  return out;
}

/** Binary mask → an alpha channel, softened by the feather setting. */
function alphaLayer(paint: MaskPaint, W: number, H: number, feather: number): HTMLCanvasElement {
  const bin = canvasOf(W, H);
  const bctx = bin.getContext("2d", { willReadFrequently: true });
  const out = canvasOf(W, H);
  const octx = out.getContext("2d");
  if (!bctx || !octx) return out;
  paintMaskLayer(bctx as any, W, H, { ...paint, opacity: 1 }, "binary");
  const id = bctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i] as number;
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = a;
  }
  bctx.putImageData(id, 0, 0);
  const soft = featherPx(feather, Math.max(W, H));
  if (soft > 0) (octx as any).filter = `blur(${soft}px)`;
  octx.drawImage(bin, 0, 0);
  (octx as any).filter = "none";
  return out;
}

export type BakeOptions = { maxEdge?: number; quality?: number };

/**
 * Bakes the blur into real pixels. The same function feeds the live preview
 * and the saved file, so what the user approved is what ships.
 */
export async function bakePrivacyBlur(
  src: string,
  paint: MaskPaint,
  settings: PrivacySettings,
  opts: BakeOptions = {},
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const img = await loadImage(src);
  if (!img) return null;
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  if (!natW || !natH) return null;
  const cap = Math.min(1, (opts.maxEdge || MAX_MASK_EDGE) / Math.max(natW, natH));
  const W = Math.max(16, Math.round(natW * cap));
  const H = Math.max(16, Math.round(natH * cap));
  const s = clampPrivacySettings(settings);

  const base = canvasOf(W, H);
  const ctx = base.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);

  const effect = effectLayer(img, W, H, s);
  const ectx = effect.getContext("2d");
  if (!ectx) return null;
  ectx.globalCompositeOperation = "destination-in";
  ectx.drawImage(alphaLayer(paint, W, H, s.feather), 0, 0);
  ectx.globalCompositeOperation = "source-over";

  ctx.drawImage(effect, 0, 0);
  return base.toDataURL("image/jpeg", opts.quality ?? 0.94);
}

/** Convenience: bake straight from canonical mask state and detections. */
export function bakeFromState(
  src: string,
  state: MaskState,
  detections: PrivacyDetection[],
  settings: PrivacySettings,
  opts: BakeOptions = {},
): Promise<string | null> {
  return bakePrivacyBlur(src, paintFromState(state, detections), settings, opts);
}
