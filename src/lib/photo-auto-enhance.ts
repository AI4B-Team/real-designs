/**
 * REAL DESIGNS — scene-aware Auto Enhance and live histogram maths.
 *
 * Real-estate photographs are not ordinary snapshots: they contain blown
 * windows, white cabinetry, ceiling lights and reflective surfaces that a naive
 * "push exposure until the mean is 128" auto-correction destroys. Everything
 * here is pure and bounded so the same photo always produces the same, modest,
 * reversible correction.
 */

export type Strength = "subtle" | "balanced" | "strong";

export type PhotoStats = {
  /** 0..1 mean luma. */
  mean: number;
  /** 0..1 luma percentiles. */
  p05: number;
  p50: number;
  p95: number;
  /** Fraction of pixels at the very top / bottom of the range. */
  clippedHighlights: number;
  clippedShadows: number;
  /** Mean channel values, 0..1 — used for a gentle white-balance nudge. */
  r: number;
  g: number;
  b: number;
  /** 0..1 average distance from grey; low means a flat, washed-out photo. */
  colorfulness: number;
  /** 256-bin luma histogram, normalised to its own peak. */
  histogram: number[];
};

const STRENGTH: Record<Strength, number> = { subtle: 0.6, balanced: 1, strong: 1.35 };

export const STRENGTHS: { id: Strength; label: string }[] = [
  { id: "subtle", label: "Subtle" },
  { id: "balanced", label: "Balanced" },
  { id: "strong", label: "Strong" },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Sample an already-loaded image down to a small grid and measure it. */
export function analyzeImageData(data: Uint8ClampedArray): PhotoStats {
  const hist = new Array(256).fill(0);
  let rs = 0;
  let gs = 0;
  let bs = 0;
  let chroma = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] as number;
    const g = data[i + 1] as number;
    const b = data[i + 2] as number;
    rs += r;
    gs += g;
    bs += b;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    chroma += (mx - mn) / 255;
    const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist[clamp(l, 0, 255)] += 1;
  }

  const at = (q: number) => {
    let seen = 0;
    const want = px * q;
    for (let i = 0; i < 256; i += 1) {
      seen += hist[i] as number;
      if (seen >= want) return i / 255;
    }
    return 1;
  };

  let clipHi = 0;
  let clipLo = 0;
  for (let i = 250; i < 256; i += 1) clipHi += hist[i] as number;
  for (let i = 0; i < 4; i += 1) clipLo += hist[i] as number;

  const peak = Math.max(1, ...hist);
  return {
    mean: (0.2126 * rs + 0.7152 * gs + 0.0722 * bs) / px / 255,
    p05: at(0.05),
    p50: at(0.5),
    p95: at(0.95),
    clippedHighlights: clipHi / px,
    clippedShadows: clipLo / px,
    r: rs / px / 255,
    g: gs / px / 255,
    b: bs / px / 255,
    colorfulness: chroma / px,
    histogram: hist.map((h) => h / peak),
  };
}

/**
 * The correction itself. Deliberately conservative and multi-control: exposure
 * alone is never allowed to carry the photo, and any image that already has
 * blown windows gets its highlights pulled instead of its exposure pushed.
 */
export function autoEnhanceAdjustments(stats: PhotoStats, strength: Strength = "balanced"): Record<string, number> {
  const k = STRENGTH[strength] ?? 1;

  /* Target a mid-tone around 0.46 — interiors read better slightly under a
     neutral grey because ceilings and windows carry the top of the range. */
  const midGap = 0.46 - stats.p50;
  /* Blown highlights veto brightening entirely. */
  const blown = clamp(stats.clippedHighlights * 6, 0, 1);
  let exposure = midGap * 70 * (1 - blown);
  if (exposure > 0) exposure *= 1 - clamp(stats.p95 - 0.9, 0, 0.1) * 8;
  exposure = clamp(exposure * k, -14, 14);

  /* Contrast comes from how compressed the real range is, not from taste. */
  const range = clamp(stats.p95 - stats.p05, 0.05, 1);
  let contrast = clamp((0.72 - range) * 60 * k, -8, 16);
  if (stats.clippedHighlights > 0.02 || stats.clippedShadows > 0.02) contrast *= 0.5;

  /* Open shadows only as far as they are actually closed. */
  const shadows = clamp((0.14 - stats.p05) * 130 * k, 0, 22);
  /* Protect windows, white cabinets and reflective surfaces. */
  const highlights = -clamp((stats.p95 - 0.86) * 150 * k + stats.clippedHighlights * 220 * k, 0, 26);

  const whites = clamp((0.94 - stats.p95) * 40 * k, -6, 8);
  const blacks = clamp((stats.p05 - 0.06) * -40 * k, -8, 4);

  /* White balance: nudge the cast out, never invent one. */
  const cast = stats.b - stats.r;
  const temperature = clamp(cast * 60 * k, -12, 12);
  const tint = clamp((stats.g - (stats.r + stats.b) / 2) * -50 * k, -8, 8);

  /* Flat photos get vibrance, never brute saturation. */
  const vibrance = clamp((0.16 - stats.colorfulness) * 70 * k, 0, 14);
  const saturation = clamp(vibrance * 0.35, 0, 6);

  const sharpen = clamp(10 * k, 0, 16);

  const out: Record<string, number> = {
    exposure,
    contrast,
    shadows,
    highlights,
    whites,
    blacks,
    temperature,
    tint,
    vibrance,
    saturation,
    sharpen,
  };
  for (const key of Object.keys(out)) out[key] = Math.round((out[key] as number) * 10) / 10;
  return out;
}

/** Human-readable warning when the current preview is clipping. */
export function clippingWarning(stats: PhotoStats | null): string | null {
  if (!stats) return null;
  const hi = stats.clippedHighlights > 0.02;
  const lo = stats.clippedShadows > 0.02;
  if (hi && lo) return "Highlights And Shadows Are Clipping";
  if (hi) return "Highlights Are Clipping";
  if (lo) return "Shadows Are Clipping";
  return null;
}
