import { describe, expect, it } from "vitest";
import { normalizePolygon, polygonBox, polygonCentroid, pointInPolygon } from "@/lib/selection-mask";
import { surfaceBox, surfaceCentroid, surfacePolygon, type DetectedSurface } from "@/lib/surface-overlay";
import { normalizeSurfaces, maskRegions } from "@/lib/materials-brief";
import { emptyMask } from "@/lib/selection-mask";

const surface = (over: Partial<DetectedSurface> = {}): DetectedSurface => ({
  id: "s1",
  label: "Kitchen Floor",
  category: "floor",
  confidence: 0.9,
  selected: false,
  ...over,
});

describe("polygon geometry", () => {
  it("keeps only real polygons", () => {
    expect(normalizePolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBeUndefined();
    expect(normalizePolygon("nope")).toBeUndefined();
    expect(normalizePolygon([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }])).toHaveLength(3);
  });

  it("clamps points into the frame", () => {
    const p = normalizePolygon([{ x: -1, y: 0 }, { x: 2, y: 0 }, { x: 0.5, y: 3 }])!;
    expect(p.every((pt) => pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1)).toBe(true);
  });

  it("derives a bounding box and centroid", () => {
    const poly = [
      { x: 0.2, y: 0.4 },
      { x: 0.8, y: 0.4 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 0.9 },
    ];
    expect(polygonBox(poly)).toEqual({ x: 0.2, y: 0.4, w: 0.6000000000000001, h: 0.5 });
    const c = polygonCentroid(poly);
    expect(c.x).toBeCloseTo(0.5, 3);
    expect(c.y).toBeCloseTo(0.65, 3);
  });

  it("hit tests points against the outline", () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(pointInPolygon(poly, { x: 0.9, y: 0.5 })).toBe(true);
    expect(pointInPolygon(poly, { x: 0.1, y: 0.9 })).toBe(false);
  });
});

describe("canonical surface records", () => {
  it("falls back to a box-shaped outline when nothing was traced", () => {
    const s = surface({ box: { x: 0.1, y: 0.2, w: 0.4, h: 0.4 } });
    expect(surfacePolygon(s)).toHaveLength(4);
    expect(surfaceBox(s)).toEqual({ x: 0.1, y: 0.2, w: 0.4, h: 0.4 });
    expect(surfaceCentroid(s).x).toBeCloseTo(0.3, 3);
  });

  it("prefers the traced outline", () => {
    const s = surface({
      polygon: [
        { x: 0.1, y: 0.6 },
        { x: 0.9, y: 0.6 },
        { x: 0.7, y: 1 },
        { x: 0.3, y: 1 },
      ],
    });
    expect(surfacePolygon(s)).toHaveLength(4);
    expect(surfaceBox(s).y).toBeCloseTo(0.6, 3);
  });
});

describe("detections carry their outline into the mask", () => {
  const raw = {
    surfaces: [
      {
        id: "floor",
        label: "Kitchen Floor",
        kind: "flooring",
        current_material: "oak plank",
        confidence: 0.92,
        polygon: [
          { x: 0.05, y: 0.62 },
          { x: 0.95, y: 0.6 },
          { x: 0.98, y: 1 },
          { x: 0.02, y: 1 },
        ],
      },
      {
        id: "counter",
        label: "Island Counter",
        kind: "countertop",
        current_material: "beige granite",
        confidence: 0.8,
        box: { x: 0.3, y: 0.4, w: 0.3, h: 0.1 },
      },
    ],
  };

  it("normalizes polygons and centroids", () => {
    const dets = normalizeSurfaces(raw);
    const floor = dets.find((d) => d.id === "floor")!;
    expect(floor.polygon).toHaveLength(4);
    expect(floor.centroid).toBeTruthy();
    expect(floor.box.y).toBeCloseTo(0.6, 2);
    const counter = dets.find((d) => d.id === "counter")!;
    expect(counter.polygon).toBeUndefined();
    expect(counter.centroid).toBeTruthy();
  });

  it("sends the real outline as the edit region and protects the rest", () => {
    const dets = normalizeSurfaces(raw);
    const floor = dets.find((d) => d.id === "floor")!;
    const regions = maskRegions(floor, dets, emptyMask());
    expect(regions.hasTarget).toBe(true);
    expect(regions.target[0]!.polygon).toHaveLength(4);
    expect(regions.keep.some((r) => r.label === "Island Counter")).toBe(true);
  });
});
