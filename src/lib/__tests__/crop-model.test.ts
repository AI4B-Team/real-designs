// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEFAULT_CROP_MODEL,
  KEY_PAN_STEP,
  MAX_CROP_ZOOM,
  clampCropModel,
  commitCrop,
  cropForDraftModel,
  cropPixels,
  cropRectOf,
  cropSnapshot,
  frameAspect,
  isCustomCropModel,
  normalizeCropModel,
  panBounds,
  panCropBy,
  ratioAspect,
  resetCropModel,
  sourceAspect,
  toLegacyCrop,
  visibleSlice,
  wheelZoom,
  withSourceSize,
  zoomCropBy,
  zoomCropTo,
} from "@/lib/crop-model";
import { OUTPUT_RATIOS, DEFAULT_OUTPUT_RATIO, effectiveRatio } from "@/lib/output-ratio";
import { clampCrop, normalizeCrop, cropStyle } from "@/lib/photo-crop";
import { fitFrame, fromCropModel, toCropModel } from "@/lib/crop-frame";

const wide = (ratio: string) => normalizeCropModel({ ratio, sourceW: 4000, sourceH: 2250 });
const tall = (ratio: string) => normalizeCropModel({ ratio, sourceW: 2000, sourceH: 3000 });
const square = (ratio: string) => normalizeCropModel({ ratio, sourceW: 2000, sourceH: 2000 });

/** The frame is covered when the visible slice fits inside the source. */
function covers(m: ReturnType<typeof normalizeCropModel>) {
  const r = cropRectOf(m);
  return (
    r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9 && r.w > 0 && r.h > 0
  );
}

describe("canonical crop model", () => {
  it("Original is the default and never crops", () => {
    expect(DEFAULT_CROP_MODEL.ratio).toBe("original");
    expect(DEFAULT_OUTPUT_RATIO).toBe("original");
    expect(ratioAspect("original")).toBeNull();
    const m = wide("original");
    expect(frameAspect(m)).toBeCloseTo(4000 / 2250);
    const r = cropRectOf(m);
    expect(r).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(isCustomCropModel(m)).toBe(false);
    expect(cropForDraftModel(m)).toBeNull();
  });

  it("covers the frame for every supported ratio, from every source shape", () => {
    for (const { id } of OUTPUT_RATIOS) {
      for (const src of [wide(id), tall(id), square(id)]) {
        expect(covers(src)).toBe(true);
        const slice = visibleSlice(src);
        expect(Math.max(slice.w, slice.h)).toBeCloseTo(1, 6);
      }
    }
  });

  it("fits a wide source into portrait and a tall source into landscape", () => {
    const portrait = wide("9:16");
    const ps = visibleSlice(portrait);
    expect(ps.h).toBeCloseTo(1, 6);
    expect(ps.w).toBeLessThan(0.35);

    const landscape = tall("16:9");
    const ls = visibleSlice(landscape);
    expect(ls.w).toBeCloseTo(1, 6);
    expect(ls.h).toBeLessThan(0.4);
  });

  it("keeps a square source square", () => {
    const r = cropRectOf(square("1:1"));
    expect(r).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("clamps pan so empty space can never appear", () => {
    const m = wide("1:1");
    const b = panBounds(m);
    expect(b.y).toBe(0);
    const pushed = panCropBy(m, 5, 5);
    expect(pushed.focalX).toBeCloseTo(0.5 + b.x, 6);
    expect(pushed.focalY).toBeCloseTo(0.5, 6);
    expect(covers(pushed)).toBe(true);
    const pulled = panCropBy(m, -5, -5);
    expect(pulled.focalX).toBeCloseTo(0.5 - b.x, 6);
    expect(covers(pulled)).toBe(true);
  });

  it("bounds zoom at both ends and keeps covering under extreme zoom", () => {
    const m = wide("4:5");
    expect(zoomCropTo(m, 0.1).zoom).toBe(1);
    expect(zoomCropTo(m, 99).zoom).toBe(MAX_CROP_ZOOM);
    const deep = panCropBy(zoomCropTo(m, MAX_CROP_ZOOM), 9, 9);
    expect(covers(deep)).toBe(true);
    expect(zoomCropBy(m, 1.1).zoom).toBeCloseTo(1.1, 6);
  });

  it("zooms by wheel magnitude, not per tick, and normalizes deltaMode", () => {
    const m = wide("1:1");
    const one = wheelZoom(m, -100);
    const flick = wheelZoom(m, -400);
    expect(flick.zoom).toBeGreaterThan(one.zoom);
    expect(one.zoom).toBeGreaterThan(1);
    expect(one.zoom).toBeLessThan(1.2);
    /* Firefox reports lines; 100 lines must behave like ~1600 pixels. */
    expect(wheelZoom(m, -6.25, 1).zoom).toBeCloseTo(wheelZoom(m, -100, 0).zoom, 6);
    /* Many small events cannot slam to the limit in one gesture. */
    let acc = m;
    for (let i = 0; i < 12; i++) acc = wheelZoom(acc, -12);
    expect(acc.zoom).toBeLessThan(MAX_CROP_ZOOM);
  });

  it("reset restores the calculated cover position", () => {
    const dirty = panCropBy(zoomCropTo(wide("1:1"), 2.5), 1, 1);
    const reset = resetCropModel(dirty);
    expect(reset.zoom).toBe(1);
    expect(reset.focalX).toBe(0.5);
    expect(reset.focalY).toBe(0.5);
    expect(isCustomCropModel(reset)).toBe(false);
  });

  it("is independent of rendered pixels — browser zoom cannot change it", () => {
    const base = wide("4:5");
    const target = { x: -0.25, y: 0.1 };
    /* The same gesture measured through frames rendered at 80%…125%. */
    const results = [0.8, 0.9, 1, 1.1, 1.25].map((z) => {
      const frameW = 400 * z;
      const frameH = 500 * z;
      const dx = target.x * frameW;
      const dy = target.y * frameH;
      return cropRectOf(panCropBy(base, dx / frameW, dy / frameH));
    });
    for (const r of results) {
      expect(r.x).toBeCloseTo(results[0]!.x, 9);
      expect(r.y).toBeCloseTo(results[0]!.y, 9);
      expect(r.w).toBeCloseTo(results[0]!.w, 9);
    }
  });

  it("a touch drag and the keyboard reach the same place", () => {
    const m = wide("1:1");
    const nudges = 5;
    let keyed = m;
    for (let i = 0; i < nudges; i++) keyed = panCropBy(keyed, KEY_PAN_STEP, 0);
    const dragged = panCropBy(m, KEY_PAN_STEP * nudges, 0);
    expect(keyed.focalX).toBeCloseTo(dragged.focalX, 9);
  });

  it("survives a refresh: normalize round-trips every field", () => {
    const m = commitCrop(
      normalizeCropModel({
        ratio: "4:5",
        focalX: 0.31,
        focalY: 0.72,
        zoom: 1.8,
        rotation: 90,
        flipX: true,
        flipY: false,
        straighten: 3.5,
        perspectiveV: -12,
        perspectiveH: 4,
        sourceW: 4000,
        sourceH: 2250,
      }),
    );
    const restored = normalizeCropModel(JSON.parse(JSON.stringify(m)));
    expect(restored).toEqual(m);
    expect(restored.rev).toBe(m.rev);
  });

  it("counts one revision per committed change", () => {
    const a = commitCrop(wide("1:1"));
    const b = commitCrop(panCropBy(a, 0.1, 0));
    expect(a.rev).toBe(1);
    expect(b.rev).toBe(2);
  });

  it("respects quarter turns when measuring the source", () => {
    expect(sourceAspect({ sourceW: 4000, sourceH: 2000, rotation: 0 })).toBeCloseTo(2);
    expect(sourceAspect({ sourceW: 4000, sourceH: 2000, rotation: 90 })).toBeCloseTo(0.5);
    expect(sourceAspect({ sourceW: 0, sourceH: 0, rotation: 0 })).toBeNull();
  });

  it("records the measured source size without moving the framing", () => {
    const before = panCropBy(normalizeCropModel({ ratio: "1:1" }), 0.1, 0);
    const after = withSourceSize(before, 4000, 2250);
    expect(after.sourceW).toBe(4000);
    expect(covers(after)).toBe(true);
  });

  it("hands generation the same rectangle the preview showed", () => {
    const m = panCropBy(zoomCropTo(wide("4:5"), 1.6), 0.2, -0.1);
    const snap = cropSnapshot(m);
    expect(snap.rect).toEqual(cropRectOf(m));
    expect(snap.ratio).toBe("4:5");
    const px = cropPixels(m);
    expect(px.sx + px.sw).toBeLessThanOrEqual(4000);
    expect(px.sy + px.sh).toBeLessThanOrEqual(2250);
    /* The CSS preview uses the very same focal point. */
    expect(cropStyle(m)).toContain(`${(m.focalX * 100).toFixed(2)}%`);
  });
});

describe("format ownership", () => {
  it("a global ratio applies to photos without an override", () => {
    expect(effectiveRatio("4:5", null)).toBe("4:5");
    expect(effectiveRatio("4:5", undefined)).toBe("4:5");
  });

  it("a per-photo override affects only that photo", () => {
    expect(effectiveRatio("4:5", "1:1")).toBe("1:1");
    expect(effectiveRatio("4:5", null)).toBe("4:5");
    /* An unknown override never leaks in. */
    expect(effectiveRatio("4:5", "banana")).toBe("4:5");
  });

  it("an unset project format stays Original", () => {
    expect(effectiveRatio(undefined, null)).toBe("original");
  });
});

describe("adapters over the one model", () => {
  it("reads the legacy {x, y, scale} crop", () => {
    const m = normalizeCropModel({ x: 0.3, y: 0.8, scale: 2, ratio: "1:1" });
    expect(m.focalX).toBeCloseTo(0.3);
    expect(m.focalY).toBeCloseTo(0.8);
    expect(m.zoom).toBe(2);
    expect(toLegacyCrop(m)).toEqual({ x: 0.3, y: 0.8, scale: 2 });
  });

  it("the Photos-step helper clamps through the canonical geometry", () => {
    const c = clampCrop({ x: 0, y: 0, scale: 1 }, 16 / 9, 1);
    expect(c.focalY).toBeCloseTo(0.5, 6);
    expect(c.focalX).toBeGreaterThan(0);
    expect(normalizeCrop(null).zoom).toBe(1);
  });

  it("the photo editor's pixel state converts both ways without drift", () => {
    const base = { w: 4000, h: 2250 };
    const view = { w: 900, h: 600 };
    const aspect = 4 / 5;
    const model = clampCropModel(
      normalizeCropModel({ ratio: "4:5", focalX: 0.42, focalY: 0.6, zoom: 1.5, sourceW: base.w, sourceH: base.h }),
      aspect,
    );
    const state = fromCropModel(model, aspect, base, view);
    expect(state.frame).toEqual(fitFrame(view, base, aspect));
    const back = toCropModel(state, base, view, { ratio: "4:5", sourceW: base.w, sourceH: base.h });
    expect(back.focalX).toBeCloseTo(model.focalX, 4);
    expect(back.focalY).toBeCloseTo(model.focalY, 4);
    expect(back.zoom).toBeCloseTo(model.zoom, 4);
  });
});
