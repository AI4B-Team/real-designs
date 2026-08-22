import { describe, expect, it } from "vitest";
import {
  MAX_CROP_ZOOM,
  clampOffset,
  createCrop,
  cropRect,
  fitFrame,
  focalOf,
  imageRect,
  minCoverScale,
  refit,
  resizeFrame,
  wheelScale,
  zoomTo,
} from "./crop-frame";

const view = { w: 800, h: 600 };
const base = { w: 600, h: 400 };

describe("fitFrame", () => {
  it("centres a square frame inside the viewport", () => {
    const f = fitFrame(view, base, 1);
    expect(f.width).toBeCloseTo(400);
    expect(f.height).toBeCloseTo(400);
    expect(f.x).toBeCloseTo(200);
    expect(f.y).toBeCloseTo(100);
  });

  it("falls back to the image aspect when none is given", () => {
    const f = fitFrame(view, base, 0);
    expect(f.width / f.height).toBeCloseTo(base.w / base.h);
  });
});

describe("minCoverScale", () => {
  it("is the scale at which the photo just covers the frame", () => {
    const f = fitFrame(view, base, 1);
    expect(minCoverScale(f, base)).toBeCloseTo(1);
  });

  it("exceeds 1 for a frame taller than the photo", () => {
    expect(minCoverScale({ x: 0, y: 0, width: 300, height: 600 }, base)).toBeCloseTo(1.5);
  });
});

describe("createCrop", () => {
  it("never leaves empty space inside the frame", () => {
    for (const aspect of [1, 4 / 3, 3 / 2, 16 / 9, 9 / 16]) {
      const s = createCrop("x", aspect, base, view);
      const img = imageRect(s, base, view);
      expect(img.x).toBeLessThanOrEqual(s.frame.x + 0.01);
      expect(img.y).toBeLessThanOrEqual(s.frame.y + 0.01);
      expect(img.x + img.width).toBeGreaterThanOrEqual(s.frame.x + s.frame.width - 0.01);
      expect(img.y + img.height).toBeGreaterThanOrEqual(s.frame.y + s.frame.height - 0.01);
    }
  });

  it("keeps a reachable focal point under the frame centre", () => {
    const s = createCrop("1:1", 1, base, view, { focalX: 0.4, focalY: 0.5 });
    const f = focalOf(s, base, view);
    expect(f.focalX).toBeCloseTo(0.4, 2);
  });

  it("clamps an unreachable focal point to the nearest covering position", () => {
    /* A 1:1 frame over a 3:2 photo can only pan between 1/3 and 2/3. */
    const s = createCrop("1:1", 1, base, view, { focalX: 0, focalY: 0.5 });
    expect(focalOf(s, base, view).focalX).toBeCloseTo(1 / 3, 2);
  });
});

describe("clampOffset", () => {
  it("stops the photo before a gap appears", () => {
    const s = createCrop("1:1", 1, base, view);
    const dragged = { ...s, offsetX: 5000, offsetY: 5000 };
    const o = clampOffset(dragged, base, view);
    expect(o.offsetX).toBeLessThan(5000);
    const img = imageRect({ ...dragged, ...o }, base, view);
    expect(img.x).toBeLessThanOrEqual(s.frame.x + 0.01);
    expect(img.y).toBeLessThanOrEqual(s.frame.y + 0.01);
  });
});

describe("zoomTo", () => {
  it("clamps between cover scale and the maximum", () => {
    const s = createCrop("1:1", 1, base, view);
    expect(zoomTo(s, base, view, 0.1).scale).toBeCloseTo(minCoverScale(s.frame, base));
    expect(zoomTo(s, base, view, 99).scale).toBe(MAX_CROP_ZOOM);
  });

  it("keeps the frame centre anchored on the same pixels", () => {
    const s = createCrop("1:1", 1, base, view, { focalX: 0.3, focalY: 0.7 });
    const before = focalOf(s, base, view);
    const after = focalOf(zoomTo(s, base, view, 2), base, view);
    expect(after.focalX).toBeCloseTo(before.focalX, 2);
    expect(after.focalY).toBeCloseTo(before.focalY, 2);
  });
});

describe("wheelScale", () => {
  it("scales by delta magnitude, not a fixed factor per event", () => {
    const s = createCrop("1:1", 1, base, view);
    const small = wheelScale(s, -10);
    const big = wheelScale(s, -100);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(s.scale);
    expect(wheelScale(s, 100)).toBeLessThan(s.scale);
  });

  it("normalizes line-mode deltas", () => {
    const s = createCrop("1:1", 1, base, view);
    expect(wheelScale(s, -1, 1)).toBeCloseTo(wheelScale(s, -16, 0));
  });
});

describe("cropRect", () => {
  it("returns the full photo for an unzoomed matching ratio", () => {
    const s = createCrop("orig", base.w / base.h, base, view);
    const r = cropRect(s, base, view);
    expect(r.x).toBeCloseTo(0, 2);
    expect(r.w).toBeCloseTo(1, 2);
    expect(r.h).toBeCloseTo(1, 2);
  });

  it("stays inside 0..1 when zoomed in hard", () => {
    const s = zoomTo(createCrop("1:1", 1, base, view), base, view, MAX_CROP_ZOOM);
    const r = cropRect(s, base, view);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(1.0001);
    expect(r.y + r.h).toBeLessThanOrEqual(1.0001);
  });
});

describe("resizeFrame", () => {
  const start = { x: 100, y: 100, width: 200, height: 200 };

  it("grows from the south-east handle", () => {
    const f = resizeFrame(start, "se", 50, 30, view);
    expect(f.width).toBe(250);
    expect(f.height).toBe(230);
    expect(f.x).toBe(100);
  });

  it("moves the origin from the north-west handle", () => {
    const f = resizeFrame(start, "nw", -40, -40, view);
    expect(f.x).toBe(60);
    expect(f.width).toBe(240);
  });

  it("enforces a minimum size and the viewport bounds", () => {
    expect(resizeFrame(start, "se", -1000, -1000, view).width).toBe(40);
    expect(resizeFrame(start, "se", 5000, 5000, view).width).toBe(view.w - 100);
  });
});

describe("refit", () => {
  it("re-covers the frame after the viewport shrinks", () => {
    const s = createCrop("1:1", 1, base, view);
    const smaller = { w: 400, h: 900 };
    const next = refit(s, 1, base, smaller);
    const img = imageRect(next, base, smaller);
    expect(img.x).toBeLessThanOrEqual(next.frame.x + 0.01);
    expect(img.x + img.width).toBeGreaterThanOrEqual(next.frame.x + next.frame.width - 0.01);
  });

  it("keeps a free frame inside the viewport", () => {
    const s = { ...createCrop("free", 1, base, view), frame: { x: 700, y: 500, width: 300, height: 300 } };
    const next = refit(s, 0, base, view);
    expect(next.frame.x + next.frame.width).toBeLessThanOrEqual(view.w + 0.01);
    expect(next.frame.y + next.frame.height).toBeLessThanOrEqual(view.h + 0.01);
  });
});
