import { describe, expect, it } from "vitest";
import {
  MARKUP_WARNING,
  bringForward,
  clampLabelBox,
  closePolygon,
  closesOnFirstPoint,
  createLayer,
  deletePoint,
  duplicateLayer,
  emptyDoc,
  hitTest,
  insertPoint,
  labelAnchor,
  markupMetadata,
  moveLayer,
  movePoint,
  nextMarkerNumber,
  parseMarkup,
  scaledFontSize,
  sendBackward,
  serializeMarkup,
  warningRequired,
} from "@/lib/markup";

const square = [
  { x: 0.2, y: 0.2 },
  { x: 0.6, y: 0.2 },
  { x: 0.6, y: 0.6 },
  { x: 0.2, y: 0.6 },
];

describe("markup geometry", () => {
  it("closes a polygon only when it has three points", () => {
    expect(closePolygon([{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]).ok).toBe(false);
    expect(closePolygon(square).ok).toBe(true);
  });

  it("closes on a click near the first point", () => {
    expect(closesOnFirstPoint(square, { x: 0.205, y: 0.205 })).toBe(true);
    expect(closesOnFirstPoint(square, { x: 0.5, y: 0.5 })).toBe(false);
  });

  it("keeps every point inside the frame when a layer is dragged", () => {
    const layer = createLayer("boundary", square);
    const moved = moveLayer(layer, 0.9, 0.9);
    expect(Math.max(...moved.points.map((p) => p.x))).toBeLessThanOrEqual(1);
    expect(Math.max(...moved.points.map((p) => p.y))).toBeLessThanOrEqual(1);
  });

  it("refuses to edit a locked layer", () => {
    const layer = { ...createLayer("parking", square), locked: true };
    expect(movePoint(layer, 0, { x: 0.9, y: 0.9 })).toBe(layer);
    expect(deletePoint(layer, 0)).toBe(layer);
  });

  it("never drops a polygon below three points", () => {
    let layer = createLayer("parking", square);
    layer = deletePoint(layer, 0);
    expect(layer.points).toHaveLength(3);
    expect(deletePoint(layer, 0).points).toHaveLength(3);
  });

  it("inserts a midpoint on an edge", () => {
    const layer = insertPoint(createLayer("parking", square), 0);
    expect(layer.points).toHaveLength(5);
    expect(layer.points[1]).toEqual({ x: 0.4, y: 0.2 });
  });

  it("clamps a label box inside the exported frame", () => {
    const box = clampLabelBox({ x: 980, y: -10, w: 120, h: 40 }, 1000, 800, 8);
    expect(box.x + box.w).toBeLessThanOrEqual(992);
    expect(box.y).toBeGreaterThanOrEqual(8);
  });

  it("scales label text with the export width", () => {
    expect(scaledFontSize(16, 4000)).toBe(64);
    expect(scaledFontSize(16, 1000)).toBe(16);
  });
});

describe("markup layers", () => {
  it("numbers markers in placement order", () => {
    const a = createLayer("marker", [{ x: 0.2, y: 0.2 }], { number: 1 });
    expect(nextMarkerNumber([a])).toBe(2);
  });

  it("duplicates with a fresh id and an offset", () => {
    const a = createLayer("parking", square);
    const out = duplicateLayer([a], a.id);
    expect(out).toHaveLength(2);
    expect(out[1]!.id).not.toBe(a.id);
    expect(out[1]!.points[0]!.x).toBeCloseTo(0.22);
  });

  it("reorders paint order", () => {
    const a = createLayer("parking", square);
    const b = createLayer("footprint", square);
    expect(bringForward([a, b], a.id)[1]!.id).toBe(a.id);
    expect(sendBackward([a, b], b.id)[0]!.id).toBe(b.id);
  });

  it("hit-tests vertices before bodies and ignores locked layers", () => {
    const a = createLayer("parking", square);
    expect(hitTest([a], { x: 0.2, y: 0.2 })).toMatchObject({ kind: "vertex", index: 0 });
    expect(hitTest([{ ...a, locked: true }], { x: 0.2, y: 0.2 })).toBeNull();
  });

  it("anchors a polygon label at its centroid", () => {
    const a = createLayer("parking", square);
    expect(labelAnchor(a)).toEqual({ x: 0.4, y: 0.4 });
  });
});

describe("markup warnings and persistence", () => {
  it("requires the survey warning for boundaries, easements and measurements", () => {
    expect(warningRequired([createLayer("boundary", square)])).toBe(true);
    expect(warningRequired([createLayer("access", square)])).toBe(true);
    expect(warningRequired([createLayer("parking", square)])).toBe(false);
  });

  it("carries the warning and a zero credit cost into export metadata", () => {
    const doc = { ...emptyDoc("a1"), layers: [createLayer("boundary", square)] };
    const meta = markupMetadata(doc);
    expect(meta.boundary_warning).toBe(MARKUP_WARNING);
    expect(meta.classification).toBe("Property Markup");
    expect(meta.credits).toBe(0);
  });

  it("round-trips a document without losing style or visibility", () => {
    const doc = {
      ...emptyDoc("a1"),
      visibleDisclosure: true,
      layers: [{ ...createLayer("boundary", square), label: "Parcel 1", visible: false }],
    };
    const back = parseMarkup(JSON.parse(JSON.stringify(serializeMarkup(doc))), "a1");
    expect(back.layers[0]!.label).toBe("Parcel 1");
    expect(back.layers[0]!.visible).toBe(false);
    expect(back.visibleDisclosure).toBe(true);
  });

  it("degrades malformed input to an empty document instead of throwing", () => {
    expect(parseMarkup(null, "a1").layers).toEqual([]);
    expect(parseMarkup({ layers: [{ type: "nope", points: [] }] }, "a1").layers).toEqual([]);
  });
});
