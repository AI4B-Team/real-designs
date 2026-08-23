/**
 * Image Format — the aspect ratio a design is generated at.
 *
 * This is not a file format: it controls the shape of the generated image.
 * The setting is chosen in the Photos step, stored in the durable draft and
 * carried unchanged through Design, Review and generation.
 *
 * "Original" is the one canonical default: each source photo keeps its own
 * shape and nothing is cropped away.
 */

export type OutputRatio =
  | "original"
  | "9:16"
  | "16:9"
  | "1:1"
  | "4:3"
  | "4:5"
  | "3:2"
  | "2:3"
  | "5:4";

export type RatioOption = { id: OutputRatio; label: string; note?: string };

/** The three buttons the video-parity header is allowed to show. */
export const PRIMARY_OUTPUT_RATIOS: RatioOption[] = [
  { id: "9:16", label: "Portrait", note: "9:16" },
  { id: "16:9", label: "Landscape", note: "16:9" },
  { id: "1:1", label: "Square", note: "1:1" },
];

/**
 * The Image Format cards shown in the Photos step, in order. Original leads
 * because it is the safe default.
 */
export const IMAGE_FORMAT_CARDS: RatioOption[] = [
  { id: "original", label: "Original", note: "Keep Current Shape" },
  { id: "16:9", label: "Landscape", note: "16:9" },
  { id: "1:1", label: "Square", note: "1:1" },
  { id: "9:16", label: "Portrait", note: "9:16" },
];

/** Everything reachable through "More" — every one supported by generation. */
export const MORE_OUTPUT_RATIOS: RatioOption[] = [
  { id: "original", label: "Original" },
  { id: "4:3", label: "MLS Landscape", note: "4:3" },
  { id: "3:2", label: "Classic", note: "3:2" },
  { id: "5:4", label: "Print", note: "5:4" },
  { id: "4:5", label: "Instagram Post", note: "4:5" },
  { id: "2:3", label: "Portrait", note: "2:3" },
];

export const OUTPUT_RATIOS: RatioOption[] = [
  { id: "original", label: "Original" },
  { id: "16:9", label: "Landscape", note: "16:9" },
  { id: "1:1", label: "Square", note: "1:1" },
  { id: "9:16", label: "Portrait", note: "9:16" },
  { id: "4:3", label: "MLS Landscape", note: "4:3" },
  { id: "3:2", label: "Classic", note: "3:2" },
  { id: "5:4", label: "Print", note: "5:4" },
  { id: "4:5", label: "Instagram Post", note: "4:5" },
  { id: "2:3", label: "Portrait", note: "2:3" },
];

/** Every ratio the generation backend accepts. */
export const SUPPORTED_RATIOS = OUTPUT_RATIOS.map((r) => r.id);

/** The one canonical default: never Square, never inherited. */
export const DEFAULT_OUTPUT_RATIO: OutputRatio = "original";

export function isOutputRatio(v: unknown): v is OutputRatio {
  return OUTPUT_RATIOS.some((r) => r.id === v);
}

export function isPrimaryRatio(v: unknown): boolean {
  return IMAGE_FORMAT_CARDS.some((r) => r.id === v);
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
  "5:4": "rt-54",
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
