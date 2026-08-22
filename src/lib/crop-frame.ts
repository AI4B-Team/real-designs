/**
 * Crop frame geometry.
 *
 * The interaction model is the familiar one: the crop frame is stationary and
 * the photograph is dragged behind it. This module owns every number that
 * makes that honest — the frame rectangle, the minimum scale at which the
 * photograph still covers the frame, the clamped offsets that make empty
 * space impossible, and the normalized crop rectangle the renderer consumes.
 *
 * All coordinates are CSS pixels inside the image viewport, with the image
 * centred in that viewport before offsets are applied.
 */

export type CropRatioId = string;

export type Frame = { x: number; y: number; width: number; height: number };

export type Box = { w: number; h: number };

export type CropState = {
  ratio: CropRatioId;
  frame: Frame;
  offsetX: number;
  offsetY: number;
  scale: number;
  focalX: number;
  focalY: number;
};

export const MAX_CROP_ZOOM = 4;
const MIN_FRAME = 40;

function fin(v: unknown, d = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

/** The largest rectangle of `aspect` that fits inside `box`, centred in `view`. */
export function fitFrame(view: Box, box: Box, aspect: number): Frame {
  const a = aspect > 0 ? aspect : box.w / Math.max(1, box.h);
  let width = box.w;
  let height = width / a;
  if (height > box.h) {
    height = box.h;
    width = height * a;
  }
  return {
    x: (view.w - width) / 2,
    y: (view.h - height) / 2,
    width,
    height,
  };
}

/** Smallest scale at which the photograph still covers the frame completely. */
export function minCoverScale(frame: Frame, base: Box): number {
  if (base.w <= 0 || base.h <= 0) return 1;
  return Math.max(frame.width / base.w, frame.height / base.h);
}

/** The displayed photograph rectangle, in viewport pixels. */
export function imageRect(state: CropState, base: Box, view: Box): Frame {
  const width = base.w * state.scale;
  const height = base.h * state.scale;
  return {
    x: view.w / 2 + state.offsetX - width / 2,
    y: view.h / 2 + state.offsetY - height / 2,
    width,
    height,
  };
}

/**
 * Clamp the offsets so the photograph always covers the frame. When the image
 * is smaller than the frame in an axis (only possible transiently) it centres
 * on the frame rather than snapping to a corner.
 */
export function clampOffset(state: CropState, base: Box, view: Box): { offsetX: number; offsetY: number } {
  const width = base.w * state.scale;
  const height = base.h * state.scale;
  const cx = view.w / 2;
  const cy = view.h / 2;
  const maxX = state.frame.x - cx + width / 2;
  const minX = state.frame.x + state.frame.width - cx - width / 2;
  const maxY = state.frame.y - cy + height / 2;
  const minY = state.frame.y + state.frame.height - cy - height / 2;
  const axis = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
  return {
    offsetX: axis(fin(state.offsetX), minX, maxX),
    offsetY: axis(fin(state.offsetY), minY, maxY),
  };
}

/** Normalized crop rectangle over the displayed photograph, 0..1. */
export function cropRect(
  state: CropState,
  base: Box,
  view: Box,
): { x: number; y: number; w: number; h: number } {
  const img = imageRect(state, base, view);
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const x = clamp01((state.frame.x - img.x) / Math.max(1, img.width));
  const y = clamp01((state.frame.y - img.y) / Math.max(1, img.height));
  const w = Math.min(1 - x, Math.max(0.02, state.frame.width / Math.max(1, img.width)));
  const h = Math.min(1 - y, Math.max(0.02, state.frame.height / Math.max(1, img.height)));
  return { x, y, w, h };
}

/** The point of the photograph currently under the centre of the frame, 0..1. */
export function focalOf(state: CropState, base: Box, view: Box): { focalX: number; focalY: number } {
  const img = imageRect(state, base, view);
  return {
    focalX: Math.min(1, Math.max(0, (state.frame.x + state.frame.width / 2 - img.x) / Math.max(1, img.width))),
    focalY: Math.min(1, Math.max(0, (state.frame.y + state.frame.height / 2 - img.y) / Math.max(1, img.height))),
  };
}

/** Offsets that place `focal` under the centre of the frame. */
export function offsetForFocal(
  state: CropState,
  base: Box,
  view: Box,
  focalX: number,
  focalY: number,
): { offsetX: number; offsetY: number } {
  const width = base.w * state.scale;
  const height = base.h * state.scale;
  const wanted: CropState = {
    ...state,
    offsetX: state.frame.x + state.frame.width / 2 - view.w / 2 - (focalX - 0.5) * width,
    offsetY: state.frame.y + state.frame.height / 2 - view.h / 2 - (focalY - 0.5) * height,
  };
  return clampOffset(wanted, base, view);
}

/** A fresh, centred, cover-fitting crop for the given aspect. */
export function createCrop(
  ratio: CropRatioId,
  aspect: number,
  base: Box,
  view: Box,
  focal?: { focalX: number; focalY: number },
): CropState {
  const frame = fitFrame(view, base, aspect);
  const min = minCoverScale(frame, base);
  const state: CropState = {
    ratio,
    frame,
    offsetX: 0,
    offsetY: 0,
    scale: Math.max(min, 1),
    focalX: focal?.focalX ?? 0.5,
    focalY: focal?.focalY ?? 0.5,
  };
  const o = offsetForFocal(state, base, view, state.focalX, state.focalY);
  state.offsetX = o.offsetX;
  state.offsetY = o.offsetY;
  return state;
}

/** Apply a new scale, keeping the frame centre anchored on the same pixels. */
export function zoomTo(state: CropState, base: Box, view: Box, scale: number): CropState {
  const min = minCoverScale(state.frame, base);
  const next = Math.min(MAX_CROP_ZOOM, Math.max(min, fin(scale, min)));
  const focal = focalOf(state, base, view);
  const zoomed: CropState = { ...state, scale: next };
  const o = offsetForFocal(zoomed, base, view, focal.focalX, focal.focalY);
  return { ...zoomed, ...o, ...focal };
}

/** Wheel/pinch delta into a scale multiplier — magnitude aware, never per-tick. */
export function wheelScale(state: CropState, deltaY: number, deltaMode = 0): number {
  const dy = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);
  return state.scale * Math.exp(-dy * 0.0015);
}

/** Resize the frame from a corner or edge handle, in Free mode. */
export function resizeFrame(
  start: Frame,
  handle: string,
  dx: number,
  dy: number,
  view: Box,
): Frame {
  let { x, y, width, height } = start;
  if (handle.includes("e")) width = Math.max(MIN_FRAME, Math.min(view.w - x, start.width + dx));
  if (handle.includes("s")) height = Math.max(MIN_FRAME, Math.min(view.h - y, start.height + dy));
  if (handle.includes("w")) {
    x = Math.min(start.x + start.width - MIN_FRAME, Math.max(0, start.x + dx));
    width = start.width + (start.x - x);
  }
  if (handle.includes("n")) {
    y = Math.min(start.y + start.height - MIN_FRAME, Math.max(0, start.y + dy));
    height = start.height + (start.y - y);
  }
  return { x, y, width, height };
}

/** Re-fit an existing crop after the viewport, ratio or rotation changed. */
export function refit(state: CropState, aspect: number, base: Box, view: Box): CropState {
  const frame = aspect > 0 ? fitFrame(view, base, aspect) : {
    ...state.frame,
    x: Math.min(Math.max(0, state.frame.x), Math.max(0, view.w - state.frame.width)),
    y: Math.min(Math.max(0, state.frame.y), Math.max(0, view.h - state.frame.height)),
  };
  const min = minCoverScale(frame, base);
  const next: CropState = { ...state, frame, scale: Math.max(min, Math.min(MAX_CROP_ZOOM, state.scale)) };
  const o = offsetForFocal(next, base, view, state.focalX, state.focalY);
  return { ...next, ...o };
}
