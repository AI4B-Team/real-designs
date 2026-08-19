/**
 * One shared navigation contract for both builders.
 *
 * Studio is the source-selection / upload step for Photo Design and Video, so
 * neither builder owns an "Add Photos" page any more. Back from the first
 * builder step returns to Studio (saving the draft); Back on any later step
 * moves exactly one step back in the flow.
 */

/** Photo Design flow: Studio -> Rooms -> Design -> Review. */
export const PHOTO_FLOW = ["review", "design", "final"] as const;
export type PhotoStep = (typeof PHOTO_FLOW)[number];

/** Photo Design rail labels, in rail order. */
export const PHOTO_RAIL: Array<{ key: PhotoStep; label: string; icon: string }> = [
  { key: "review", label: "Photos", icon: "images" },
  { key: "design", label: "Design", icon: "wand-sparkles" },
  { key: "final", label: "Review", icon: "circle-check" },
];

/** Video flow (internal step numbers): Studio -> Scenes -> Titles -> Audio -> Brand -> Review. */
export const VIDEO_FLOW = [2, 5, 6, 4, 7] as const;
export type VideoStep = (typeof VIDEO_FLOW)[number];

export const VIDEO_RAIL: Array<{ key: string; label: string; icon: string; step: number }> = [
  { key: "scenes", label: "Scenes", icon: "layout-grid", step: 2 },
  { key: "titles", label: "Titles", icon: "type", step: 5 },
  { key: "audio", label: "Audio", icon: "music", step: 6 },
  { key: "brand", label: "Brand", icon: "palette", step: 4 },
  { key: "quality", label: "Review", icon: "circle-check", step: 7 },
];

export type BackTarget<T> = { exit: true } | { exit: false; step: T };

/** Where Back goes from a given step. The first step always exits to Studio. */
export function backTarget<T>(flow: readonly T[], step: T): BackTarget<T> {
  const i = flow.indexOf(step);
  if (i <= 0) return { exit: true };
  return { exit: false, step: flow[i - 1] as T };
}

export function backFromPhotoStep(step: string): BackTarget<PhotoStep> {
  return backTarget(PHOTO_FLOW, normalizePhotoStep(step));
}

export function backFromVideoStep(step: number): BackTarget<VideoStep> {
  return backTarget(VIDEO_FLOW, normalizeVideoStep(step));
}

/** Legacy "add"/step-1 values resolve to the first real builder step. */
export function normalizePhotoStep(step: unknown): PhotoStep {
  const s = String(step || "").toLowerCase();
  if (s === "design" || s === "canvas") return "design";
  if (s === "final" || s === "review-results") return "final";
  return "review";
}

export function normalizeVideoStep(step: unknown): VideoStep {
  const n = Number(step);
  if (VIDEO_FLOW.indexOf(n as VideoStep) !== -1) return n as VideoStep;
  if (n === 3) return 2;
  return 2;
}

/** True for the removed internal Add Photos routes, which now bypass to Studio. */
export function isAddPhotosStep(step: unknown): boolean {
  const s = String(step ?? "").toLowerCase();
  return s === "add" || s === "photos" || s === "1";
}

/** The one Start Over confirmation copy, shared by both builders. */
export const START_OVER_COPY =
  "Start over? Your current draft settings will be cleared. Uploaded photos will remain in Media.";
