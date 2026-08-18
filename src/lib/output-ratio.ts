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

export type OutputRatio =
  | "original"
  | "9:16"
  | "16:9"
  | "1:1"
  | "4:3"
  | "4:5"
  | "3:2"
  | "2:3";

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

/** Practical default for listings, presentations and photo-to-video handoff. */
export const DEFAULT_OUTPUT_RATIO: OutputRatio = "16:9";

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
