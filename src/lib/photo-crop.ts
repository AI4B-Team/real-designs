/**
 * Crop placement for a photo rendered into a fixed Image Format frame.
 *
 * A fixed format (Square, Portrait, Landscape…) can never silently discard
 * part of a composition: the user positions each photo inside the frame and
 * the exact placement travels with the draft into generation.
 *
 * The model is deliberately tiny and resolution independent:
 *   x, y   — the focal point, 0..1 of the source image
 *   scale  — zoom, 1 = the smallest size that still covers the frame
 */

export type Crop = { x: number; y: number; scale: number };

export const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, scale: 1 };

export const MAX_CROP_SCALE = 3;

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeCrop(v: unknown): Crop {
  const c = (v || {}) as Partial<Crop>;
  return {
    x: Math.min(1, Math.max(0, num(c.x, 0.5))),
    y: Math.min(1, Math.max(0, num(c.y, 0.5))),
    scale: Math.min(MAX_CROP_SCALE, Math.max(1, num(c.scale, 1))),
  };
}

/** A crop that differs from the safe centred default. */
export function isCustomCrop(v: unknown): boolean {
  if (!v) return false;
  const c = normalizeCrop(v);
  return (
    Math.abs(c.x - 0.5) > 0.001 || Math.abs(c.y - 0.5) > 0.001 || Math.abs(c.scale - 1) > 0.001
  );
}

/** Stored value, or null when the photo simply uses the default placement. */
export function cropForDraft(v: unknown): Crop | null {
  return isCustomCrop(v) ? normalizeCrop(v) : null;
}

/** Aspect ratio (w/h) of a ratio id, or null for Original / unknown. */
export function ratioValue(id: unknown): number | null {
  const s = String(id ?? "");
  if (!s || s === "original") return null;
  const [w, h] = s.split(":").map(Number);
  if (!w || !h) return null;
  return w / h;
}

/**
 * How far the focal point may travel before an empty edge appears.
 * `srcRatio` and `frameRatio` are width / height.
 */
export function cropBounds(srcRatio: number, frameRatio: number, scale: number) {
  const s = Math.max(1, num(scale, 1));
  const a = num(srcRatio, 1) || 1;
  const f = num(frameRatio, 1) || 1;
  const ox = a > f ? (a / f) * s : s;
  const oy = a > f ? s : (f / a) * s;
  return { x: 0.5 * (1 - 1 / ox), y: 0.5 * (1 - 1 / oy) };
}

/** Clamp a crop so the frame is always fully covered — never any empty area. */
export function clampCrop(crop: unknown, srcRatio: number, frameRatio: number): Crop {
  const c = normalizeCrop(crop);
  const b = cropBounds(srcRatio, frameRatio, c.scale);
  return {
    scale: c.scale,
    x: Math.min(0.5 + b.x, Math.max(0.5 - b.x, c.x)),
    y: Math.min(0.5 + b.y, Math.max(0.5 - b.y, c.y)),
  };
}

/** CSS for previewing a crop inside a frame that already has the ratio. */
export function cropStyle(crop: unknown): string {
  const c = normalizeCrop(crop);
  return `object-fit:cover;object-position:${(c.x * 100).toFixed(2)}% ${(c.y * 100).toFixed(2)}%;transform:scale(${c.scale.toFixed(3)})`;
}
