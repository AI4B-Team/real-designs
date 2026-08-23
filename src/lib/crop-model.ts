/**
 * The one canonical crop model.
 *
 * Everything a crop means is stored in normalized image space: a focal point
 * expressed as a fraction of the source photograph, a zoom factor where 1 is
 * "just covers the frame", and the orientation flags. Nothing here is measured
 * in rendered pixels, so a crop survives a window resize, a browser zoom level
 * of 80% or 125%, a phone rotation and a page refresh unchanged.
 *
 * Three models used to compete: a pixel-space frame/offset model in the photo
 * editor, a focal/scale model in the Photos step, and an ad-hoc object stored
 * on the draft. This module is the single source of truth; the others are
 * adapters over it.
 *
 * Geometry, once, so preview and generated pixels can never disagree:
 *
 *   frame aspect  f = width / height of the chosen Image Format
 *   source aspect a = width / height of the photograph (after quarter turns)
 *   visible slice at zoom z:
 *       vw = (a > f ? f / a : 1) / z      (fraction of source width)
 *       vh = (a > f ? 1 : a / f) / z      (fraction of source height)
 *   the focal point may travel ±(1 - vw)/2 and ±(1 - vh)/2, which is exactly
 *   the range where the frame stays completely covered.
 */

export type CropModel = {
  /** Image Format id: "original" or "w:h". */
  ratio: string;
  /** Point of the source under the centre of the frame, 0..1. */
  focalX: number;
  focalY: number;
  /** 1 = the smallest size that still covers the frame. */
  zoom: number;
  /** Quarter turns, degrees: 0 | 90 | 180 | 270. */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  /** Fine rotation in degrees, -15..15. */
  straighten: number;
  /** Keystone correction, -100..100. */
  perspectiveV: number;
  perspectiveH: number;
  /** Natural pixel size of the source, 0 when not measured yet. */
  sourceW: number;
  sourceH: number;
  /** Bumped on every committed change so callers can detect staleness. */
  rev: number;
};

export const MIN_CROP_ZOOM = 1;
export const MAX_CROP_ZOOM = 4;
/** One keyboard nudge, as a fraction of the frame. */
export const KEY_PAN_STEP = 0.02;
/** One press of the zoom + / − control. */
export const KEY_ZOOM_STEP = 0.1;

export const DEFAULT_CROP_MODEL: CropModel = {
  ratio: "original",
  focalX: 0.5,
  focalY: 0.5,
  zoom: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  straighten: 0,
  perspectiveV: 0,
  perspectiveH: 0,
  sourceW: 0,
  sourceH: 0,
  rev: 0,
};

const num = (v: unknown, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Aspect (w/h) of a ratio id. `null` for Original, which never crops. */
export function ratioAspect(id: unknown): number | null {
  const s = String(id ?? "").trim();
  if (!s || s === "original") return null;
  const [w, h] = s.split(":").map(Number);
  if (!w || !h || w <= 0 || h <= 0) return null;
  return w / h;
}

/** Source aspect after quarter turns, or `null` when the size is unknown. */
export function sourceAspect(model: Pick<CropModel, "sourceW" | "sourceH" | "rotation">): number | null {
  const w = num(model.sourceW, 0);
  const h = num(model.sourceH, 0);
  if (w <= 0 || h <= 0) return null;
  const turned = Math.abs(num(model.rotation, 0) % 180) === 90;
  return turned ? h / w : w / h;
}

/**
 * The aspect the crop frame is drawn at. Original follows the photograph, so
 * nothing is ever cropped away by default.
 */
export function frameAspect(model: CropModel, fallback = 4 / 3): number {
  return ratioAspect(model.ratio) ?? sourceAspect(model) ?? fallback;
}

/** Accepts the canonical model, the legacy `{x,y,scale}` crop, or nothing. */
export function normalizeCropModel(v: unknown, defaults?: Partial<CropModel>): CropModel {
  const raw = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const base = { ...DEFAULT_CROP_MODEL, ...(defaults || {}) };
  /* Legacy shape: focal point was x / y and zoom was scale. */
  const focalX = "focalX" in raw ? raw["focalX"] : "x" in raw ? raw["x"] : base.focalX;
  const focalY = "focalY" in raw ? raw["focalY"] : "y" in raw ? raw["y"] : base.focalY;
  const zoom = "zoom" in raw ? raw["zoom"] : "scale" in raw ? raw["scale"] : base.zoom;
  const quarter = ((Math.round(num(raw["rotation"], base.rotation) / 90) * 90) % 360 + 360) % 360;
  return {
    ratio: String(raw["ratio"] ?? base.ratio ?? "original") || "original",
    focalX: clamp01(num(focalX, 0.5)),
    focalY: clamp01(num(focalY, 0.5)),
    zoom: clamp(num(zoom, 1), MIN_CROP_ZOOM, MAX_CROP_ZOOM),
    rotation: quarter,
    flipX: raw["flipX"] === true || (raw["flipX"] === undefined && base.flipX === true),
    flipY: raw["flipY"] === true || (raw["flipY"] === undefined && base.flipY === true),
    straighten: clamp(num(raw["straighten"], base.straighten), -15, 15),
    perspectiveV: clamp(num(raw["perspectiveV"], base.perspectiveV), -100, 100),
    perspectiveH: clamp(num(raw["perspectiveH"], base.perspectiveH), -100, 100),
    sourceW: Math.max(0, Math.round(num(raw["sourceW"], base.sourceW))),
    sourceH: Math.max(0, Math.round(num(raw["sourceH"], base.sourceH))),
    rev: Math.max(0, Math.round(num(raw["rev"], base.rev))),
  };
}

/** The fraction of the source visible through the frame, per axis. */
export function visibleSlice(model: CropModel, aspect?: number | null): { w: number; h: number } {
  const f = aspect && aspect > 0 ? aspect : frameAspect(model);
  const a = sourceAspect(model) ?? f;
  const z = clamp(num(model.zoom, 1), MIN_CROP_ZOOM, MAX_CROP_ZOOM);
  return {
    w: clamp01((a > f ? f / a : 1) / z),
    h: clamp01((a > f ? 1 : a / f) / z),
  };
}

/** How far the focal point may travel from centre before an edge shows. */
export function panBounds(model: CropModel, aspect?: number | null): { x: number; y: number } {
  const s = visibleSlice(model, aspect);
  return { x: Math.max(0, (1 - s.w) / 2), y: Math.max(0, (1 - s.h) / 2) };
}

/** Clamp so the frame is always fully covered — empty space is impossible. */
export function clampCropModel(model: CropModel, aspect?: number | null): CropModel {
  const m = normalizeCropModel(model);
  const b = panBounds(m, aspect);
  return {
    ...m,
    focalX: clamp(m.focalX, 0.5 - b.x, 0.5 + b.x),
    focalY: clamp(m.focalY, 0.5 - b.y, 0.5 + b.y),
  };
}

/** The visible rectangle of the source, normalized 0..1. */
export function cropRectOf(
  model: CropModel,
  aspect?: number | null,
): { x: number; y: number; w: number; h: number } {
  const m = clampCropModel(model, aspect);
  const s = visibleSlice(m, aspect);
  return {
    x: clamp(m.focalX - s.w / 2, 0, Math.max(0, 1 - s.w)),
    y: clamp(m.focalY - s.h / 2, 0, Math.max(0, 1 - s.h)),
    w: s.w,
    h: s.h,
  };
}

/** The same rectangle in source pixels, ready for a canvas draw. */
export function cropPixels(model: CropModel, aspect?: number | null) {
  const r = cropRectOf(model, aspect);
  const w = Math.max(1, num(model.sourceW, 0));
  const h = Math.max(1, num(model.sourceH, 0));
  return {
    sx: Math.round(r.x * w),
    sy: Math.round(r.y * h),
    sw: Math.max(1, Math.round(r.w * w)),
    sh: Math.max(1, Math.round(r.h * h)),
  };
}

/** Set zoom, keeping the same point under the centre of the frame. */
export function zoomCropTo(model: CropModel, zoom: number, aspect?: number | null): CropModel {
  const z = clamp(num(zoom, 1), MIN_CROP_ZOOM, MAX_CROP_ZOOM);
  return clampCropModel({ ...normalizeCropModel(model), zoom: z }, aspect);
}

export function zoomCropBy(model: CropModel, factor: number, aspect?: number | null): CropModel {
  return zoomCropTo(model, num(model.zoom, 1) * num(factor, 1), aspect);
}

/**
 * Wheel and trackpad pinch, magnitude aware. A fixed per-tick factor makes one
 * trackpad flick slam the zoom to its limit, so the delta drives the exponent
 * and `deltaMode` is normalized (Firefox reports lines, not pixels).
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const dy = num(deltaY, 0) * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);
  return Math.exp(-dy * 0.0015);
}

export function wheelZoom(
  model: CropModel,
  deltaY: number,
  deltaMode = 0,
  aspect?: number | null,
): CropModel {
  return zoomCropBy(model, wheelZoomFactor(deltaY, deltaMode), aspect);
}

/** Drag, in fractions of the frame — the same for mouse, touch and keyboard. */
export function panCropBy(
  model: CropModel,
  dxFrames: number,
  dyFrames: number,
  aspect?: number | null,
): CropModel {
  const m = normalizeCropModel(model);
  const s = visibleSlice(m, aspect);
  return clampCropModel(
    { ...m, focalX: m.focalX + num(dxFrames, 0) * s.w, focalY: m.focalY + num(dyFrames, 0) * s.h },
    aspect,
  );
}

/** Back to the calculated cover position: centred, zoom 1, orientation kept. */
export function resetCropModel(model: CropModel): CropModel {
  const m = normalizeCropModel(model);
  return { ...m, focalX: 0.5, focalY: 0.5, zoom: 1 };
}

/** True when the crop differs from the safe centred default. */
export function isCustomCropModel(v: unknown): boolean {
  if (!v) return false;
  const m = normalizeCropModel(v);
  return (
    Math.abs(m.focalX - 0.5) > 0.001 ||
    Math.abs(m.focalY - 0.5) > 0.001 ||
    Math.abs(m.zoom - 1) > 0.001 ||
    m.rotation !== 0 ||
    m.flipX ||
    m.flipY ||
    Math.abs(m.straighten) > 0.001 ||
    Math.abs(m.perspectiveV) > 0.001 ||
    Math.abs(m.perspectiveH) > 0.001
  );
}

/** Commit a change: one revision per accepted edit. */
export function commitCrop(model: CropModel, aspect?: number | null): CropModel {
  const m = clampCropModel(model, aspect);
  return { ...m, rev: m.rev + 1 };
}

/** Store a crop on the draft, or `null` when it is simply the default. */
export function cropForDraftModel(v: unknown): CropModel | null {
  return isCustomCropModel(v) ? normalizeCropModel(v) : null;
}

/** Record the measured source size without disturbing the framing. */
export function withSourceSize(model: CropModel, w: number, h: number): CropModel {
  const m = normalizeCropModel(model);
  const sw = Math.max(0, Math.round(num(w, 0)));
  const sh = Math.max(0, Math.round(num(h, 0)));
  if (sw === m.sourceW && sh === m.sourceH) return m;
  return clampCropModel({ ...m, sourceW: sw, sourceH: sh });
}

/** CSS that previews the crop inside a frame that already has the ratio. */
export function cropModelCss(v: unknown): string {
  const m = normalizeCropModel(v);
  const parts = [
    "object-fit:cover",
    `object-position:${(m.focalX * 100).toFixed(2)}% ${(m.focalY * 100).toFixed(2)}%`,
  ];
  const t: string[] = [];
  if (m.zoom !== 1) t.push(`scale(${m.zoom.toFixed(3)})`);
  if (m.flipX || m.flipY) t.push(`scale(${m.flipX ? -1 : 1},${m.flipY ? -1 : 1})`);
  if (m.rotation || m.straighten) t.push(`rotate(${(m.rotation + m.straighten).toFixed(2)}deg)`);
  if (t.length) parts.push(`transform:${t.join(" ")}`);
  return parts.join(";");
}

/** The snapshot handed to generation. Normalized, so pixels match preview. */
export type CropSnapshot = {
  ratio: string;
  focalX: number;
  focalY: number;
  zoom: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  straighten: number;
  perspectiveV: number;
  perspectiveH: number;
  sourceW: number;
  sourceH: number;
  rev: number;
  rect: { x: number; y: number; w: number; h: number };
};

export function cropSnapshot(v: unknown, ratio?: string): CropSnapshot {
  const m = clampCropModel(normalizeCropModel(v, ratio ? { ratio } : undefined));
  const use = ratio ? { ...m, ratio } : m;
  return { ...use, rect: cropRectOf(use) };
}

/* ------------------------------------------------------ legacy adapters --- */

/** The old `{x, y, scale}` shape, for callers not yet converted. */
export function toLegacyCrop(v: unknown): { x: number; y: number; scale: number } {
  const m = normalizeCropModel(v);
  return { x: m.focalX, y: m.focalY, scale: m.zoom };
}

/**
 * The pixel-space editor state (frame rectangle + offsets) into the canonical
 * model, so the photo editor and the Photos step agree on one geometry.
 */
export function fromFrameState(
  state: {
    ratio?: string;
    frame: { x: number; y: number; width: number; height: number };
    offsetX: number;
    offsetY: number;
    scale: number;
  },
  base: { w: number; h: number },
  view: { w: number; h: number },
  extra?: Partial<CropModel>,
): CropModel {
  const width = Math.max(1, base.w * state.scale);
  const height = Math.max(1, base.h * state.scale);
  const imgX = view.w / 2 + state.offsetX - width / 2;
  const imgY = view.h / 2 + state.offsetY - height / 2;
  const focalX = (state.frame.x + state.frame.width / 2 - imgX) / width;
  const focalY = (state.frame.y + state.frame.height / 2 - imgY) / height;
  const aspect = state.frame.width / Math.max(1, state.frame.height);
  const cover = Math.max(state.frame.width / Math.max(1, base.w), state.frame.height / Math.max(1, base.h));
  const model = normalizeCropModel(
    {
      ...(extra || {}),
      ratio: state.ratio || "original",
      focalX,
      focalY,
      zoom: cover > 0 ? state.scale / cover : 1,
      sourceW: extra?.sourceW ?? Math.round(base.w),
      sourceH: extra?.sourceH ?? Math.round(base.h),
    },
    extra,
  );
  return clampCropModel(model, aspect);
}
