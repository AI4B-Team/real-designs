/**
 * Crop placement for a photo rendered into a fixed Image Format frame.
 *
 * This module is now a thin adapter over the canonical crop model in
 * `crop-model.ts`. It exists so the older call sites keep their vocabulary
 * while there is only one geometry, one clamp and one stored shape.
 */

import {
  type CropModel,
  DEFAULT_CROP_MODEL,
  MAX_CROP_ZOOM,
  clampCropModel,
  cropForDraftModel,
  cropModelCss,
  isCustomCropModel,
  normalizeCropModel,
  panBounds,
  ratioAspect,
} from "@/lib/crop-model";

export type Crop = CropModel;

export const DEFAULT_CROP: Crop = DEFAULT_CROP_MODEL;
export const MAX_CROP_SCALE = MAX_CROP_ZOOM;

export const normalizeCrop = (v: unknown): Crop => normalizeCropModel(v);
export const isCustomCrop = (v: unknown): boolean => isCustomCropModel(v);
export const cropForDraft = (v: unknown): Crop | null => cropForDraftModel(v);
export const cropStyle = (v: unknown): string => cropModelCss(v);

/** Aspect ratio (w/h) of a ratio id, or null for Original / unknown. */
export const ratioValue = (id: unknown): number | null => ratioAspect(id);

/** Source dimensions that carry a given aspect, for callers that only know it. */
function sizedFor(crop: Crop, srcRatio: number): Crop {
  const a = Number(srcRatio) > 0 ? Number(srcRatio) : 1;
  if (crop.sourceW > 0 && crop.sourceH > 0) return crop;
  return { ...crop, sourceW: Math.round(1000 * a), sourceH: 1000, rotation: 0 };
}

/** How far the focal point may travel before an empty edge appears. */
export function cropBounds(srcRatio: number, frameRatio: number, scale: number) {
  const model = sizedFor(normalizeCrop({ zoom: scale }), srcRatio);
  return panBounds(model, Number(frameRatio) > 0 ? Number(frameRatio) : 1);
}

/** Clamp a crop so the frame is always fully covered — never any empty area. */
export function clampCrop(crop: unknown, srcRatio: number, frameRatio: number): Crop {
  const model = sizedFor(normalizeCrop(crop), srcRatio);
  return clampCropModel(model, Number(frameRatio) > 0 ? Number(frameRatio) : 1);
}
