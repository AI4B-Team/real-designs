import { describe, expect, it } from "vitest";
import {
  MAX_MASK_STROKES,
  beginStroke,
  clearStrokes,
  createMaskState,
  deserializeMask,
  extendStroke,
  isMaskEmpty,
  isMaskStale,
  maskCoverage,
  paintFromLegacy,
  paintFromState,
  paintMaskLayer,
  redoStroke,
  regionBox,
  serializeMask,
  setInverted,
  setOpacity,
  strokeDabs,
  toggleProtectedRegion,
  toggleSelectedRegion,
  undoStroke,
  type MaskPaint,
} from "@/lib/mask-engine";

const src = { assetId: "a1", versionId: "v1" };

/** A recorder standing in for a 2D context so rendering is testable. */
function recorder() {
  const calls: string[] = [];
  const ctx: any = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    clearRect: () => calls.push("clear"),
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`fillRect:${ctx.fillStyle}:${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)}`),
    strokeRect: () => calls.push(`strokeRect:${ctx.strokeStyle}`),
    beginPath: () => calls.push("begin"),
    arc: () => calls.push("arc"),
    fill: () => calls.push(`fill:${ctx.fillStyle}`),
    stroke: () => calls.push(`stroke:${ctx.strokeStyle}`),
  };
  return { ctx, calls };
}

describe("stroke model", () => {
  it("records a polyline and drops jitter", () => {
    let m = beginStroke(createMaskState(src), "add", { x: 0.2, y: 0.2 }, { size: 0.05 });
    m = extendStroke(m, { x: 0.2005, y: 0.2005 });
    expect(m.strokes[0]!.points).toHaveLength(1);
    m = extendStroke(m, { x: 0.4, y: 0.4 });
    expect(m.strokes[0]!.points).toHaveLength(2);
  });

  it("clamps points and brush size into range", () => {
    const m = beginStroke(createMaskState(), "add", { x: 4, y: -2 }, { size: 99 });
    expect(m.strokes[0]!.points[0]).toEqual({ x: 1, y: 0 });
    expect(m.strokes[0]!.size).toBe(0.4);
  });

  it("undoes, redoes and clears, and a new stroke drops the redo stack", () => {
    let m = beginStroke(beginStroke(createMaskState(), "add", { x: 0.2, y: 0.2 }), "add", { x: 0.4, y: 0.4 });
    m = undoStroke(m);
    expect(m.strokes).toHaveLength(1);
    expect(m.redo).toHaveLength(1);
    m = redoStroke(m);
    expect(m.strokes).toHaveLength(2);
    m = beginStroke(undoStroke(m), "protect", { x: 0.5, y: 0.5 });
    expect(m.redo).toHaveLength(0);
    expect(clearStrokes(m).strokes).toHaveLength(0);
  });

  it("keeps history bounded", () => {
    let m = createMaskState();
    for (let i = 0; i < MAX_MASK_STROKES + 25; i += 1) m = beginStroke(m, "add", { x: 0.5, y: 0.5 });
    expect(m.strokes).toHaveLength(MAX_MASK_STROKES);
  });

  it("interpolates a fast drag into a continuous band", () => {
    let m = beginStroke(createMaskState(), "add", { x: 0.1, y: 0.5 }, { size: 0.02 });
    m = extendStroke(m, { x: 0.9, y: 0.5 });
    const dabs = strokeDabs(m.strokes[0]!);
    expect(dabs.length).toBeGreaterThan(10);
    expect(dabs.every((d) => d.r === 0.02)).toBe(true);
  });
});

describe("regions", () => {
  const regions = [
    { id: "r1", label: "Sofa", confidence: 0.9, box: { x: 0.3, y: 0.4, w: 0.2, h: 0.2 } },
    { id: "r2", label: "Window", confidence: 0.8, polygon: [{ x: 0.7, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.4 }] },
  ];

  it("derives a box from a polygon", () => {
    const b = regionBox(regions[1]!);
    expect(b.x).toBeCloseTo(0.7, 5);
    expect(b.y).toBeCloseTo(0.1, 5);
    expect(b.w).toBeCloseTo(0.2, 5);
    expect(b.h).toBeCloseTo(0.3, 5);
  });


  it("selecting and protecting are mutually exclusive", () => {
    let m = toggleSelectedRegion(createMaskState(), "r1");
    expect(m.selectedRegions).toEqual(["r1"]);
    m = toggleProtectedRegion(m, "r1");
    expect(m.selectedRegions).toEqual([]);
    expect(m.protectedRegions).toEqual(["r1"]);
  });

  it("swaps edit and protect when inverted", () => {
    let m = toggleSelectedRegion(createMaskState(), "r1");
    m = toggleProtectedRegion(m, "r2");
    const normal = paintFromState(m, regions);
    expect(normal.edit[0]!.label).toBe("Sofa");
    const flipped = paintFromState(setInverted(m, true), regions);
    expect(flipped.edit[0]!.label).toBe("Window");
    expect(flipped.protect[0]!.label).toBe("Sofa");
  });

  it("treats erase and protect strokes as protection", () => {
    let m = toggleSelectedRegion(createMaskState(), "r1");
    m = beginStroke(m, "erase", { x: 0.35, y: 0.45 });
    m = beginStroke(m, "add", { x: 0.6, y: 0.6 });
    const paint = paintFromState(m, regions);
    expect(paint.protectStrokes).toHaveLength(1);
    expect(paint.editStrokes).toHaveLength(1);
  });

  it("reports coverage and emptiness honestly", () => {
    const empty: MaskPaint = paintFromState(createMaskState(), regions);
    expect(isMaskEmpty(empty)).toBe(true);
    const filled = paintFromState(toggleSelectedRegion(createMaskState(), "r1"), regions);
    expect(isMaskEmpty(filled)).toBe(false);
    expect(maskCoverage(filled)).toBeCloseTo(0.04, 5);
  });
});

describe("legacy vocabulary adapter", () => {
  it("maps a tool's dabs onto the shared paint model", () => {
    const paint = paintFromLegacy<"remove" | "keep">({
      edit: [{ label: "Boxes", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      protect: [{ label: "Window", box: { x: 0.6, y: 0.1, w: 0.2, h: 0.2 } }],
      strokes: [
        { x: 0.2, y: 0.2, r: 0.05, kind: "remove" },
        { x: 0.7, y: 0.2, r: 0.05, kind: "keep" },
      ],
      intent: (k) => (k === "remove" ? "include" : "exclude"),
      feather: 0.02,
    });
    expect(paint.editStrokes).toHaveLength(1);
    expect(paint.protectStrokes).toHaveLength(1);
    expect(paint.feather).toBe(0.02);
  });
});

describe("rendering", () => {
  const paint: MaskPaint = {
    edit: [{ label: "Sofa", box: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } }],
    protect: [{ label: "Window", box: { x: 0, y: 0, w: 0.1, h: 0.1 } }],
    editStrokes: [{ x: 0.5, y: 0.5, r: 0.05 }],
    protectStrokes: [{ x: 0.05, y: 0.05, r: 0.02 }],
    feather: 0.01,
    opacity: 0.6,
  };

  it("paints a real binary mask: black frame, white target, protection punched out", () => {
    const { ctx, calls } = recorder();
    paintMaskLayer(ctx, 100, 100, paint, "binary");
    expect(calls[0]).toBe("fillRect:#000000:0,0,100,100");
    expect(calls).toContain("fillRect:#ffffff:25,25,50,50");
    expect(calls).toContain("fill:#ffffff");
    expect(calls).toContain("fillRect:#000000:0,0,10,10");
    expect(calls.filter((c) => c === "fill:#000000")).toHaveLength(1);
  });

  it("outlines protection instead of erasing it in the previews", () => {
    const { ctx, calls } = recorder();
    paintMaskLayer(ctx, 100, 100, paint, "overlay");
    expect(calls.some((c) => c.startsWith("strokeRect:rgba(0,200,120"))).toBe(true);
    expect(calls).not.toContain("fillRect:#000000:0,0,10,10");
  });

  it("draws nothing in the panel when the mask is hidden", () => {
    const { ctx, calls } = recorder();
    paintMaskLayer(ctx, 100, 100, { ...paint, opacity: 0 }, "overlay");
    expect(calls).toHaveLength(0);
  });
});

describe("persistence", () => {
  it("round-trips a mask", () => {
    let m = beginStroke(createMaskState(src), "add", { x: 0.3, y: 0.3 }, { size: 0.06 });
    m = extendStroke(m, { x: 0.6, y: 0.6 });
    m = setOpacity(toggleProtectedRegion(m, "r2"), 0.8);
    const back = deserializeMask(JSON.parse(JSON.stringify(serializeMask(m))));
    expect(back.strokes[0]!.points).toHaveLength(2);
    expect(back.strokes[0]!.size).toBeCloseTo(0.06, 5);
    expect(back.protectedRegions).toEqual(["r2"]);
    expect(back.opacity).toBe(0.8);
    expect(back.sourceVersionId).toBe("v1");
  });

  it("upgrades version 1 dabs instead of discarding them", () => {
    const back = deserializeMask({
      sourceAssetId: "a1",
      sourceVersionId: "v1",
      strokes: [
        { x: 0.4, y: 0.5, r: 0.05, kind: "remove" },
        { x: 0.8, y: 0.5, r: 0.05, kind: "keep" },
      ],
    });
    expect(back.strokes).toHaveLength(2);
    expect(back.strokes[0]!.mode).toBe("add");
    expect(back.strokes[1]!.mode).toBe("protect");
  });

  it("refuses a mask drawn on a different source", () => {
    const m = createMaskState(src);
    expect(isMaskStale(m, "a1", "v1")).toBe(false);
    expect(isMaskStale(m, "a1", "v2")).toBe(true);
    expect(isMaskStale(createMaskState(), "a9", "v9")).toBe(false);
  });
});
