/**
 * One media-card frame contract for every builder grid.
 *
 * Photo Design and the Video Builder show the same photos in the same grid,
 * so a card must not change shape when the user moves between them. The
 * Video scene card is the approved reference: a portrait project renders a
 * 3:4 frame, a landscape project a 4:3 frame, a square project a 1:1 frame,
 * always `object-fit: cover` at `object-position: center`.
 *
 * The frame previews the output shape without reproducing its literal
 * extremes: a true 9:16 card is so tall it breaks grid density, which is why
 * the approved Video frame uses the portrait bucket instead. This module is
 * the single place that decision lives; the CSS in rd-reveal.css mirrors it
 * and rd-staging.css must not redefine it.
 */

export type FrameShape = "portrait" | "landscape" | "square";

/** The rendered aspect for each bucket — identical in both workflows. */
export const FRAME_ASPECT: Record<FrameShape, string> = {
  portrait: "3 / 4",
  landscape: "4 / 3",
  square: "1 / 1",
};

const SHAPES: Record<string, FrameShape> = {
  "9:16": "portrait",
  "4:5": "portrait",
  "2:3": "portrait",
  "16:9": "landscape",
  "4:3": "landscape",
  "3:2": "landscape",
  original: "landscape",
  "1:1": "square",
};

/** The bucket a selected format renders in. Unknown values follow Video. */
export function frameShape(ratio: unknown): FrameShape {
  return SHAPES[String(ratio)] || "landscape";
}

/** The rendered aspect-ratio value for a selected format. */
export function frameAspect(ratio: unknown): string {
  return FRAME_ASPECT[frameShape(ratio)];
}

/** Grid-level class the Video Builder already uses, for either workflow. */
export function frameGridClass(ratio: unknown): FrameShape {
  return frameShape(ratio);
}
