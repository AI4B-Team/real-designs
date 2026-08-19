/**
 * Photo Design output ratios.
 *
 * The header offers exactly the same three primary choices as the Video
 * Builder — Portrait 9:16, Landscape 16:9, Square 1:1 — in the same order, so
 * a photo project and a video project speak one format language. Everything
 * else (Original, 4:3, 4:5, 3:2, 2:3) stays available under "More Ratios".
 *
 * The ratio is metadata only: it is stored beside the photo and passed into
 * generation. The uploaded original is never rewritten.
 */

export type OutputRatio = "original" | "9:16" | "16:9" | "1:1" | "4:3" | "4:5" | "3:2" | "2:3";

export type RatioOption = { id: OutputRatio; label: string; note?: string };

/** The three buttons the header is allowed to show, matching Video Format. */
export const PRIMARY_OUTPUT_RATIOS: RatioOption[] = [
  { id: "9:16", label: "Portrait", note: "9:16" },
  { id: "16:9", label: "Landscape", note: "16:9" },
  { id: "1:1", label: "Square", note: "1:1" },
];

/** Everything reachable through "More Ratios". */
export const MORE_OUTPUT_RATIOS: RatioOption[] = [
  { id: "original", label: "Original" },
  { id: "4:3", label: "Landscape", note: "4:3" },
  { id: "4:5", label: "Portrait", note: "4:5" },
  { id: "3:2", label: "Classic", note: "3:2" },
  { id: "2:3", label: "Portrait", note: "2:3" },
];

export const OUTPUT_RATIOS: RatioOption[] = [...PRIMARY_OUTPUT_RATIOS, ...MORE_OUTPUT_RATIOS];

/** New photo projects open in Portrait, the shape most listings publish in. */
export const DEFAULT_OUTPUT_RATIO: OutputRatio = "9:16";

export function isOutputRatio(v: unknown): v is OutputRatio {
  return OUTPUT_RATIOS.some((r) => r.id === v);
}

export function isPrimaryRatio(v: unknown): boolean {
  return PRIMARY_OUTPUT_RATIOS.some((r) => r.id === v);
}

export function normalizeOutputRatio(v: unknown): OutputRatio {
  return isOutputRatio(v) ? v : DEFAULT_OUTPUT_RATIO;
}

/** Per-photo override, or null when the photo follows the project default. */
export function normalizeOverride(v: unknown): OutputRatio | null {
  return isOutputRatio(v) ? v : null;
}

export function ratioLabel(id: unknown): string {
  const r = OUTPUT_RATIOS.find((x) => x.id === id);
  if (!r) return "Original";
  return r.note ? `${r.label} ${r.note}` : r.label;
}

/** The ratio a photo actually renders at. */
export function effectiveRatio(projectDefault: unknown, override: unknown): OutputRatio {
  return isOutputRatio(override) ? override : normalizeOutputRatio(projectDefault);
}

/** True when a photo ratio can feed a video format with no reshaping. */
export function ratioMatchesFormat(ratio: unknown, format: unknown): boolean {
  return isPrimaryRatio(ratio) && ratio === format;
}

/* ------------------------------------------------------------ card preview */

/**
 * The class that gives a card's image frame the shape of its output.
 *
 * Photo Design and the Video Builder both preview the real output shape, so
 * the mapping lives here and neither surface invents its own.
 */
const RATIO_CLASS: Record<OutputRatio, string> = {
  "9:16": "rt-916",
  "16:9": "rt-169",
  "1:1": "rt-11",
  "4:3": "rt-43",
  "4:5": "rt-45",
  "3:2": "rt-32",
  "2:3": "rt-23",
  original: "rt-orig",
};

export const RATIO_CLASSES: string[] = Object.values(RATIO_CLASS);

export function ratioClass(id: unknown): string {
  const r = normalizeOutputRatio(id);
  return RATIO_CLASS[r];
}

/** The css aspect-ratio value, or null for Original (intrinsic). */
export function ratioAspect(id: unknown): string | null {
  const r = normalizeOutputRatio(id);
  if (r === "original") return null;
  return r.replace(":", " / ");
}
