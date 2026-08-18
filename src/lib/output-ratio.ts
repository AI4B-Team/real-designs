/**
 * Photo Design output ratios.
 *
 * Video has ONE required canvas format for the whole render. Photo Design is
 * different: the project carries a default ratio ("Original" out of the box)
 * and any single photo may override it. Both surfaces share the visual
 * segmented control (see builder-format-selector) but not this logic.
 */

export type OutputRatio = "original" | "4:3" | "4:5" | "1:1";

export const OUTPUT_RATIOS: Array<{ id: OutputRatio; label: string; note?: string }> = [
  { id: "original", label: "Original" },
  { id: "4:3", label: "Landscape", note: "4:3" },
  { id: "4:5", label: "Portrait", note: "4:5" },
  { id: "1:1", label: "Square", note: "1:1" },
];

export const DEFAULT_OUTPUT_RATIO: OutputRatio = "original";

export function isOutputRatio(v: unknown): v is OutputRatio {
  return v === "original" || v === "4:3" || v === "4:5" || v === "1:1";
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
