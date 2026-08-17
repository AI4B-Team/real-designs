/**
 * One source of truth for property-video output formats and quality tiers.
 *
 * The builder used to keep two independent format controls (an orientation
 * toggle in Select & Order and a multi-select in Review & Generate) that could
 * disagree. Everything now flows through `primaryFormat` + `additionalFormats`
 * and `getOutputFormats()`.
 */

export type VideoFormat = "9:16" | "16:9" | "1:1";

export const VIDEO_FORMATS: Array<{ id: VideoFormat; label: string; note: string }> = [
  { id: "9:16", label: "Portrait", note: "9:16" },
  { id: "16:9", label: "Landscape", note: "16:9" },
  { id: "1:1", label: "Square", note: "1:1" },
];

export const DEFAULT_FORMAT: VideoFormat = "9:16";

export function isVideoFormat(v: unknown): v is VideoFormat {
  return v === "9:16" || v === "16:9" || v === "1:1";
}

export function formatLabel(id: string) {
  const f = VIDEO_FORMATS.find((x) => x.id === id);
  return f ? `${f.label} — ${f.note}` : id;
}

/** Complete, de-duplicated output list. Primary always comes first. */
export function getOutputFormats(primaryFormat: unknown, additionalFormats: unknown): VideoFormat[] {
  const primary = isVideoFormat(primaryFormat) ? primaryFormat : DEFAULT_FORMAT;
  const out: VideoFormat[] = [primary];
  for (const f of Array.isArray(additionalFormats) ? additionalFormats : []) {
    if (isVideoFormat(f) && !out.includes(f)) out.push(f);
  }
  return out;
}

/**
 * Older projects saved a flat `formats[]`. Normalise them on load: the first
 * entry becomes the primary, the rest become additional versions.
 */
export function normalizeFormats(formats: unknown): { primaryFormat: VideoFormat; additionalFormats: VideoFormat[] } {
  const list = (Array.isArray(formats) ? formats : [])
    .map((f) => (f === "4:5" ? "9:16" : f))
    .filter(isVideoFormat) as VideoFormat[];
  const primaryFormat = list[0] || DEFAULT_FORMAT;
  const additionalFormats = list.slice(1).filter((f, i, a) => f !== primaryFormat && a.indexOf(f) === i);
  return { primaryFormat, additionalFormats };
}

/* ------------------------------- QUALITY ------------------------------- */

export type QualityTier = {
  id: string;
  name: string;
  note: string;
  /** Hard ceiling on how many scenes this tier can render. */
  maxScenes: number;
  costMultiplier: number;
};

export const QUALITY_TIERS: QualityTier[] = [
  { id: "basic", name: "Basic", note: "720p, Quick Render", maxScenes: 10, costMultiplier: 1 },
  { id: "standard", name: "Standard", note: "1080p, The Usual Choice", maxScenes: 20, costMultiplier: 1.5 },
  { id: "high", name: "High", note: "1080p, Sharper Motion And Longer Cut", maxScenes: 30, costMultiplier: 2 },
  { id: "ultra", name: "Ultra", note: "4K Master, Every Photo Used", maxScenes: 60, costMultiplier: 3 },
];

export function qualityTierById(id: unknown): QualityTier {
  return QUALITY_TIERS.find((t) => t.id === id) || (QUALITY_TIERS[1] as QualityTier);
}

export type QualityCompatibility = {
  compatible: boolean;
  maxScenes: number;
  sceneCount: number;
  overBy: number;
  reason: string;
};

/**
 * A quality tier must never silently drop selected scenes: if the tier cannot
 * carry every selected photo it is unavailable, with the reason stated.
 */
export function getQualityCompatibility(quality: unknown, selectedSceneCount: number): QualityCompatibility {
  const tier = qualityTierById(quality);
  const sceneCount = Math.max(0, Number(selectedSceneCount) || 0);
  const overBy = Math.max(0, sceneCount - tier.maxScenes);
  return {
    compatible: overBy === 0,
    maxScenes: tier.maxScenes,
    sceneCount,
    overBy,
    reason: overBy
      ? `${tier.name} supports up to ${tier.maxScenes} scenes. Your video contains ${sceneCount}.`
      : "",
  };
}

/** Cheapest tier that can carry every selected scene, or null when none can. */
export function lowestCompatibleQuality(selectedSceneCount: number): QualityTier | null {
  return QUALITY_TIERS.find((t) => t.maxScenes >= (Number(selectedSceneCount) || 0)) || null;
}

/** Largest scene count any tier supports. */
export const MAX_SCENES = QUALITY_TIERS.reduce((n, t) => Math.max(n, t.maxScenes), 0);
