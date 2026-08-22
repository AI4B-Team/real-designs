/**
 * REAL DESIGNS — real pixel processing for the Photo Editor.
 *
 * Light and colour are carried by a CSS/canvas `filter`, which is fast enough
 * to drive a live preview. Detail and lens correction cannot be expressed as a
 * filter, so they are implemented here as honest pixel passes and used by BOTH
 * the on-screen preview and the saved render. Nothing in the inspector is
 * allowed to be decorative CSS that disappears from the exported file.
 *
 * Everything is pure and works on a plain `{ data, width, height }` buffer so
 * it can be unit-tested without a browser.
 */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

export type DetailAdjustments = {
  sharpen?: number; // 0..100
  denoise?: number; // 0..100
  clarity?: number; // -100..100
  dehaze?: number; // -100..100
  lens?: number; // -100..100 (barrel <-> pincushion correction)
};

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** True when the adjustments need a pixel pass rather than just a filter. */
export function needsPixelPass(adj: Record<string, number> | DetailAdjustments): boolean {
  const a = adj as Record<string, number>;
  return ["sharpen", "denoise", "clarity", "dehaze", "lens"].some((k) => n(a[k]) !== 0);
}

/** Pick only the pixel-pass controls out of a full adjustment map. */
export function detailOf(adj: Record<string, number>): DetailAdjustments {
  return {
    sharpen: n(adj["sharpen"]),
    denoise: n(adj["denoise"]),
    clarity: n(adj["clarity"]),
    dehaze: n(adj["dehaze"]),
    lens: n(adj["lens"]),
  };
}

/** A stable cache key for a detail pass on a given source. */
export function detailKey(src: string, d: DetailAdjustments): string {
  return `${src.length}:${src.slice(-24)}|${n(d.sharpen)},${n(d.denoise)},${n(d.clarity)},${n(d.dehaze)},${n(d.lens)}`;
}

function clone(p: Pixels): Uint8ClampedArray {
  return new Uint8ClampedArray(p.data);
}

/** Separable box blur, used by denoise (small radius) and clarity (large). */
export function boxBlur(p: Pixels, radius: number): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius));
  const { width: w, height: h } = p;
  const src = clone(p);
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const pass = (from: Uint8ClampedArray, to: Uint8ClampedArray, horizontal: boolean) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let count = 0;
        for (let k = -r; k <= r; k += 1) {
          const xx = horizontal ? Math.min(w - 1, Math.max(0, x + k)) : x;
          const yy = horizontal ? y : Math.min(h - 1, Math.max(0, y + k));
          const i = (yy * w + xx) * 4;
          sr += from[i] as number;
          sg += from[i + 1] as number;
          sb += from[i + 2] as number;
          count += 1;
        }
        const o = (y * w + x) * 4;
        to[o] = sr / count;
        to[o + 1] = sg / count;
        to[o + 2] = sb / count;
        to[o + 3] = from[o + 3] as number;
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, out, false);
  return out;
}

/** Noise reduction: blend towards a small blur, keeping edges mostly intact. */
export function applyDenoise(p: Pixels, amount: number): void {
  const a = Math.max(0, Math.min(100, n(amount))) / 100;
  if (!a) return;
  const blurred = boxBlur(p, 1 + Math.round(a * 2));
  for (let i = 0; i < p.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const idx = i + c;
      const src = p.data[idx] as number;
      const soft = blurred[idx] as number;
      /* Edge-aware: strong local differences keep more of the original. */
      const diff = Math.abs(src - soft) / 255;
      const mix = a * (1 - Math.min(1, diff * 2.2));
      p.data[idx] = src + (soft - src) * mix;
    }
  }
}

/** Unsharp mask. Positive only — this is Sharpen, not a blur control. */
export function applySharpen(p: Pixels, amount: number): void {
  const a = Math.max(0, Math.min(100, n(amount))) / 100;
  if (!a) return;
  const blurred = boxBlur(p, 1);
  const k = a * 1.25;
  for (let i = 0; i < p.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const idx = i + c;
      const src = p.data[idx] as number;
      p.data[idx] = src + (src - (blurred[idx] as number)) * k;
    }
  }
}

/** Clarity: mid-tone local contrast over a wide radius. */
export function applyClarity(p: Pixels, amount: number): void {
  const a = Math.max(-100, Math.min(100, n(amount))) / 100;
  if (!a) return;
  const radius = Math.max(2, Math.round(Math.min(p.width, p.height) / 40));
  const blurred = boxBlur(p, radius);
  const k = a * 0.75;
  for (let i = 0; i < p.data.length; i += 4) {
    /* Protect the extremes so windows do not gain haloes. */
    const lum =
      (0.2126 * (p.data[i] as number) +
        0.7152 * (p.data[i + 1] as number) +
        0.0722 * (p.data[i + 2] as number)) /
      255;
    const guard = 1 - Math.pow(Math.abs(lum - 0.5) * 2, 2);
    for (let c = 0; c < 3; c += 1) {
      const idx = i + c;
      const src = p.data[idx] as number;
      p.data[idx] = src + (src - (blurred[idx] as number)) * k * guard;
    }
  }
}

/**
 * Dehaze. Removes the atmospheric veil by pulling the dark channel down and
 * re-expanding the range — the standard approach, bounded so a hazy exterior
 * clears without turning the sky into a poster.
 */
export function applyDehaze(p: Pixels, amount: number): void {
  const a = Math.max(-100, Math.min(100, n(amount))) / 100;
  if (!a) return;
  let darkSum = 0;
  let count = 0;
  for (let i = 0; i < p.data.length; i += 4) {
    darkSum += Math.min(p.data[i] as number, p.data[i + 1] as number, p.data[i + 2] as number);
    count += 1;
  }
  const veil = count ? darkSum / count : 0;
  const t = Math.min(0.55, Math.abs(a) * 0.55) * Math.sign(a);
  for (let i = 0; i < p.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const idx = i + c;
      const v = p.data[idx] as number;
      p.data[idx] = (v - veil * t) / (1 - t) || 0;
    }
  }
}

/**
 * Lens correction. Positive removes barrel distortion (wide real-estate
 * lenses), negative removes pincushion. Straight remap, edge-clamped.
 */
export function applyLens(p: Pixels, amount: number): void {
  const a = Math.max(-100, Math.min(100, n(amount))) / 100;
  if (!a) return;
  const k = a * 0.22;
  const { width: w, height: h } = p;
  const src = clone(p);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const norm = Math.max(1, Math.hypot(cx, cy));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = (x - cx) / norm;
      const dy = (y - cy) / norm;
      const r2 = dx * dx + dy * dy;
      const scale = 1 + k * r2;
      const sx = Math.round(cx + dx * norm * scale);
      const sy = Math.round(cy + dy * norm * scale);
      const cxx = Math.min(w - 1, Math.max(0, sx));
      const cyy = Math.min(h - 1, Math.max(0, sy));
      const from = (cyy * w + cxx) * 4;
      const to = (y * w + x) * 4;
      p.data[to] = src[from] as number;
      p.data[to + 1] = src[from + 1] as number;
      p.data[to + 2] = src[from + 2] as number;
      p.data[to + 3] = src[from + 3] as number;
    }
  }
}

/** The whole pixel pass, in the order a photographer would expect. */
export function applyDetailPass(p: Pixels, d: DetailAdjustments): void {
  if (n(d.lens)) applyLens(p, n(d.lens));
  if (n(d.denoise)) applyDenoise(p, n(d.denoise));
  if (n(d.dehaze)) applyDehaze(p, n(d.dehaze));
  if (n(d.clarity)) applyClarity(p, n(d.clarity));
  if (n(d.sharpen)) applySharpen(p, n(d.sharpen));
}
