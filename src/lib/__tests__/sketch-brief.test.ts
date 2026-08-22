import { describe, expect, it } from "vitest";
import {
  buildRuns,
  buildSketchBrief,
  cameraMarker,
  costSentence,
  dimensionsKnown,
  emptyGeometry,
  emptyScale,
  exportPlanText,
  geometryReady,
  modesForKind,
  normalizeClassification,
  normalizeDrift,
  normalizeGeometry,
  rejectionMessage,
  restoreFromMeta,
  sketchCredits,
  sketchMeta,
  sketchPrompt,
  uncertainItems,
  type SketchSettings,
} from "@/lib/sketch-brief";

function geometry() {
  return normalizeGeometry({
    summary: "A two-room cabin plan.",
    units: "ft",
    warnings: ["The right-hand wall is drawn twice."],
    elements: [
      { id: "w1", kind: "wall", label: "North wall", box: { x: 0, y: 0, w: 1, h: 0.05 }, dimension: "24'-0\"", confidence: 0.9 },
      { id: "r1", kind: "room", label: "Living", box: { x: 0.05, y: 0.1, w: 0.5, h: 0.6 }, confidence: 0.8 },
      { id: "d1", kind: "door", label: "Front door", box: { x: 0.2, y: 0, w: 0.08, h: 0.05 }, confidence: 0.4 },
    ],
  });
}

function settings(over: Partial<SketchSettings> = {}): SketchSettings {
  return {
    classification: normalizeClassification({ kind: "floor_plan", confidence: 0.9, summary: "A plan." }),
    geometry: geometry(),
    mode: "interior_perspective",
    cameras: [cameraMarker({ id: "cam-1", x: 0.3, y: 0.5, direction: 90 })],
    activeCameraId: "cam-1",
    materialDirection: "auto",
    furnitureLevel: "balanced",
    finishGrade: "retail",
    roomType: "Living Room",
    styleId: "modern",
    styleName: "Modern",
    units: "ft",
    dimensions: [],
    scale: emptyScale(),
    notes: null,
    results: 1,
    sceneId: "scene-test",
    continuity: [],
    hasSource: true,
    ...over,
  };
}

describe("source classification", () => {
  it("refuses a photograph with an honest reason instead of rendering it", () => {
    const c = normalizeClassification({ kind: "photograph", confidence: 0.95 });
    expect(c.supported).toBe(false);
    expect(rejectionMessage(c)).toMatch(/photo/i);
  });

  it("never marks an unread classification as confirmed", () => {
    expect(normalizeClassification({}).confirmed).toBe(false);
  });

  it("offers plan-shaped modes for a floor plan and perspective for a sketch", () => {
    expect(modesForKind("floor_plan")).toContain("floor_plan_3d_furnished");
    expect(modesForKind("hand_sketch")[0]).toBe("interior_perspective");
  });
});

describe("geometry reading", () => {
  it("keeps only elements the reader actually returned and never invents dimensions", () => {
    const g = geometry();
    expect(g.items).toHaveLength(3);
    expect(g.items.find((i) => i.id === "r1")?.dimension).toBeNull();
  });

  it("flags low-confidence elements for review", () => {
    expect(uncertainItems(geometry()).map((i) => i.label)).toEqual(["Front door"]);
  });

  it("treats an empty read as not ready to render", () => {
    expect(geometryReady(emptyGeometry())).toBe(false);
    expect(geometryReady(geometry())).toBe(true);
  });

  it("does not claim dimensions it was not given", () => {
    expect(dimensionsKnown(emptyGeometry(), [])).toBe(false);
    expect(dimensionsKnown(geometry(), [])).toBe(true);
  });
});

describe("brief validation", () => {
  it("blocks rendering until the drawing type is confirmed", () => {
    const b = buildSketchBrief(settings());
    expect(b.valid).toBe(false);
    expect(b.missing).toContain("Confirm the drawing type");
  });

  it("blocks a perspective view with no camera placed", () => {
    const c = normalizeClassification({ kind: "floor_plan", confidence: 0.9 });
    const b = buildSketchBrief(
      settings({ classification: { ...c, confirmed: true }, cameras: [], activeCameraId: null }),
    );
    expect(b.missing).toContain("Place a camera on the drawing for this view");
  });

  it("blocks rendering before geometry has been read", () => {
    const c = normalizeClassification({ kind: "floor_plan", confidence: 0.9 });
    const b = buildSketchBrief(settings({ classification: { ...c, confirmed: true }, geometry: emptyGeometry() }));
    expect(b.missing).toContain("Review the detected geometry before rendering");
  });

  it("passes once type, geometry and camera are all settled", () => {
    const c = normalizeClassification({ kind: "floor_plan", confidence: 0.9 });
    const b = buildSketchBrief(settings({ classification: { ...c, confirmed: true } }));
    expect(b.valid).toBe(true);
    expect(b.credits).toBe(1);
  });

  it("warns rather than lying when no scale or dimensions exist", () => {
    const c = normalizeClassification({ kind: "hand_sketch", confidence: 0.9 });
    const b = buildSketchBrief(
      settings({ classification: { ...c, confirmed: true }, geometry: normalizeGeometry({ elements: [{ id: "w", kind: "wall", label: "Wall", box: {}, confidence: 0.9 }] }) }),
    );
    expect(b.warnings.join(" ")).toMatch(/no dimensions/i);
    expect(b.warnings.join(" ")).toMatch(/scale/i);
  });

  it("forces an empty room for plan modes that cannot be furnished", () => {
    const c = normalizeClassification({ kind: "floor_plan", confidence: 0.9 });
    const b = buildSketchBrief(
      settings({ classification: { ...c, confirmed: true }, mode: "floor_plan_3d_unfurnished", furnitureLevel: "styled" }),
    );
    expect(b.payload.furniture_level).toBe("empty");
  });
});

describe("cost", () => {
  it("charges one credit per requested view and says so", () => {
    expect(sketchCredits(1)).toBe(1);
    expect(sketchCredits(3)).toBe(3);
    expect(buildRuns(3)).toHaveLength(3);
    expect(costSentence(2)).toMatch(/refunded/i);
  });

  it("clamps a nonsense result count instead of over-charging", () => {
    expect(sketchCredits(99)).toBe(4);
    expect(sketchCredits(0)).toBe(1);
  });
});

describe("prompt", () => {
  const c = normalizeClassification({ kind: "floor_plan", confidence: 0.9 });
  const brief = buildSketchBrief(settings({ classification: { ...c, confirmed: true } }));
  const text = sketchPrompt(brief.payload, buildRuns(2)[1]!);

  it("hands the model the detected geometry rather than asking it to re-read the plan", () => {
    expect(text).toContain("North wall");
    expect(text).toContain("labelled 24'-0\"");
    expect(text).toContain("GEOMETRY LOCK");
  });

  it("states the camera and refuses invented text on the image", () => {
    expect(text).toMatch(/facing right/i);
    expect(text).toMatch(/never add dimension lines/i);
  });

  it("carries the alternate-view directive without unlocking geometry", () => {
    expect(text).toContain("For this option:");
    expect(text).toMatch(/same geometry/i);
  });
});

describe("drift check", () => {
  it("escalates a major issue and stays honest when clean", () => {
    const bad = normalizeDrift({ issues: [{ id: "moved_wall", severity: "major", detail: "The rear wall shifted." }] });
    expect(bad.major).toBe(true);
    expect(bad.issues).toHaveLength(1);
    expect(normalizeDrift({ issues: [] }).issues).toHaveLength(0);
  });
});

describe("persistence", () => {
  it("round-trips a saved render back into the panel", () => {
    const c = normalizeClassification({ kind: "floor_plan", confidence: 0.9 });
    const brief = buildSketchBrief(settings({ classification: { ...c, confirmed: true } }));
    const meta = sketchMeta({ payload: brief.payload, sourceVersion: "v1.png", run: "Primary View" });
    const back = restoreFromMeta(meta);
    expect(back?.geometry.items.map((i) => i.label)).toContain("North wall");
    expect(back?.cameras[0]?.direction).toBe(90);
    expect(back?.sceneId).toBe("scene-test");
    expect(back?.mode).toBe("interior_perspective");
  });

  it("ignores metadata from another tool", () => {
    expect(restoreFromMeta({ tool: "Materials" })).toBeNull();
  });

  it("exports the interpreted plan as readable text", () => {
    const text = exportPlanText(geometry(), {
      kind: "floor_plan",
      dimensions: [],
      cameras: [cameraMarker({ id: "c", x: 0.5, y: 0.5 })],
      units: "ft",
    });
    expect(text).toMatch(/North wall/);
    expect(text).toMatch(/Concept visualization/);
  });
});
