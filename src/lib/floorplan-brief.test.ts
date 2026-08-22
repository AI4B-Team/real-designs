import { describe, expect, it } from "vitest";
import {
  CONCEPT_DISCLAIMER,
  CREDITS_PER_OUTPUT,
  addElement,
  buildFloorplanBrief,
  buildRuns,
  calibrateScale,
  classificationWarning,
  correctElement,
  correctionCount,
  costSentence,
  defaultSettings,
  dimensionStatement,
  elementsOnFloor,
  exportPlanData,
  exportPlanText,
  floorplanCredits,
  floorplanMeta,
  floorplanPrompt,
  geometryConfidence,
  geometryCounts,
  geometryReady,
  materialSchedule,
  mergeFloor,
  normalizeClassification,
  normalizeDrift,
  normalizeGeometry,
  planRooms,
  realLength,
  rejectionMessage,
  removeElement,
  restoreFromMeta,
  scaleStatement,
  type FloorplanSettings,
} from "@/lib/floorplan-brief";

const RAW_GEOMETRY = {
  summary: "A single-level three bedroom plan.",
  units: "ft",
  scale: { note: null },
  warnings: ["The lower right corner is cut off."],
  elements: [
    { id: "w1", kind: "wall", label: "North exterior wall", box: { x: 0, y: 0, w: 1, h: 0.04 }, confidence: 0.9 },
    { id: "r1", kind: "room", label: "Kitchen", box: { x: 0.05, y: 0.1, w: 0.3, h: 0.3 }, confidence: 0.88, dimension: "12' x 10'" },
    { id: "r2", kind: "space", label: "Living", box: { x: 0.4, y: 0.1, w: 0.4, h: 0.4 }, confidence: 0.4 },
    { id: "d1", kind: "doorway", label: "Front door", box: { x: 0.5, y: 0.9, w: 0.08, h: 0.05 }, confidence: 0.7 },
    { id: "x1", kind: "spaceship", label: "Nonsense", box: { x: 0, y: 0, w: 1, h: 1 }, confidence: 1 },
  ],
};

function ready(overrides: Partial<FloorplanSettings> = {}): FloorplanSettings {
  const geometry = normalizeGeometry(RAW_GEOMETRY);
  return {
    ...defaultSettings(),
    hasSource: true,
    classification: normalizeClassification({ kind: "floor_plan_image", confidence: 0.9 }),
    geometry,
    reviewed: true,
    styleId: "warm-minimal",
    styleName: "Warm Minimal",
    ...overrides,
  };
}

describe("plan classification", () => {
  it("keeps supported plans and rejects photographs", () => {
    const plan = normalizeClassification({ kind: "blueprint", confidence: 0.9 });
    expect(plan.supported).toBe(true);
    expect(rejectionMessage(plan)).toBeNull();

    const photo = normalizeClassification({ kind: "photo", confidence: 0.95 });
    expect(photo.kind).toBe("photograph");
    expect(photo.supported).toBe(false);
    expect(rejectionMessage(photo)).toMatch(/photograph/i);
  });

  it("warns instead of silently trusting a low-confidence read", () => {
    const c = normalizeClassification({ kind: "scanned_plan", confidence: 0.3, alternatives: ["blueprint"] });
    expect(classificationWarning(c)).toMatch(/low confidence/i);
    expect(classificationWarning(normalizeClassification({ kind: "blueprint", confidence: 0.9 }))).toBeNull();
  });
});

describe("geometry reading", () => {
  it("normalizes synonyms and drops elements it cannot classify", () => {
    const g = normalizeGeometry(RAW_GEOMETRY);
    expect(g.elements).toHaveLength(4);
    expect(g.elements.map((e) => e.kind)).toContain("room");
    expect(g.elements.find((e) => e.label === "Living")?.kind).toBe("room");
    expect(g.elements.find((e) => e.label === "Front door")?.kind).toBe("door");
    expect(g.warnings).toHaveLength(1);
  });

  it("never invents a scale that the plan does not state", () => {
    const g = normalizeGeometry(RAW_GEOMETRY);
    expect(g.scale.known).toBe(false);
    expect(scaleStatement(g.scale)).toMatch(/No scale was calibrated/);

    const stated = normalizeGeometry({ ...RAW_GEOMETRY, scale: { note: '1/4" = 1\'' } });
    expect(stated.scale.known).toBe(true);
    expect(scaleStatement(stated.scale)).toMatch(/stated on the plan/);
  });

  it("counts, flags low confidence and reports honestly", () => {
    const g = normalizeGeometry(RAW_GEOMETRY);
    expect(geometryCounts(g).room).toBe(2);
    const report = geometryConfidence(g);
    expect(report.uncertain).toContain("Living");
    expect(report.missing).toContain("No scale was calibrated");
    expect(report.disclaimer).toBe(CONCEPT_DISCLAIMER);
    expect(report.score).toBeLessThan(100);
  });

  it("accepts user corrections and treats them as certain", () => {
    let g = normalizeGeometry(RAW_GEOMETRY);
    g = correctElement(g, g.elements.find((e) => e.label === "Living")!.id, { label: "Great Room" });
    const fixed = g.elements.find((e) => e.label === "Great Room")!;
    expect(fixed.origin).toBe("user");
    expect(fixed.confidence).toBe(1);
    expect(correctionCount(g)).toBe(1);

    g = addElement(g, { kind: "room", label: "Pantry" });
    expect(planRooms(g).map((r) => r.label)).toContain("Pantry");
    g = removeElement(g, fixed.id);
    expect(g.elements.some((e) => e.label === "Great Room")).toBe(false);
  });

  it("keeps every level of a multi-floor plan separate", () => {
    const base = normalizeGeometry(RAW_GEOMETRY);
    const upper = normalizeGeometry({
      elements: [{ id: "b1", kind: "room", label: "Primary Bedroom", box: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, confidence: 0.9 }],
    });
    const merged = mergeFloor(base, upper, "Level 2");
    expect(merged.floors).toHaveLength(2);
    expect(elementsOnFloor(merged, "floor-2").map((e) => e.label)).toEqual(["Primary Bedroom"]);
    expect(elementsOnFloor(merged, "floor-1")).toHaveLength(4);
  });
});

describe("scale and dimensions", () => {
  it("only calibrates from a real reference and length", () => {
    expect(calibrateScale({ reference: "", length: 20, units: "ft" }).known).toBe(false);
    expect(calibrateScale({ reference: "Front wall", length: 0, units: "ft" }).known).toBe(false);
    const s = calibrateScale({ reference: "Front wall", length: 30, units: "ft", pixels: 0.5 });
    expect(s.known).toBe(true);
    expect(realLength(s, 0.25)).toBe(15);
    expect(realLength({ ...s, known: false }, 0.25)).toBeNull();
  });

  it("says plainly when nothing is measured", () => {
    const g = normalizeGeometry({ elements: [] });
    expect(dimensionStatement(g, [])).toMatch(/No dimensions were read/);
    expect(dimensionStatement(normalizeGeometry(RAW_GEOMETRY), [])).toMatch(/1 read from the plan/);
  });
});

describe("brief", () => {
  it("blocks generation until the plan is read, reviewed and styled", () => {
    expect(buildFloorplanBrief(defaultSettings()).missing).toContain("Upload A Floor Plan");
    expect(buildFloorplanBrief(ready({ reviewed: false })).missing).toContain("Review The Interpretation");
    expect(buildFloorplanBrief(ready({ styleId: null, styleName: null })).missing).toContain(
      "Choose A Design Style",
    );
    expect(buildFloorplanBrief(ready()).valid).toBe(true);
  });

  it("refuses an unsupported upload no matter what else is set", () => {
    const brief = buildFloorplanBrief(
      ready({ classification: normalizeClassification({ kind: "photograph", confidence: 1 }) }),
    );
    expect(brief.valid).toBe(false);
    expect(brief.missing).toContain("Upload A Supported Floor Plan");
  });

  it("needs a camera for eye level and rooms for room views", () => {
    expect(buildFloorplanBrief(ready({ output: "eye_level" })).missing).toContain("Place A Camera Marker");
    expect(buildFloorplanBrief(ready({ output: "room_views", roomIds: [] })).missing).toContain(
      "Select At Least One Room",
    );
  });

  it("prices one view per room and refunds language stays honest", () => {
    const s = ready();
    const rooms = planRooms(s.geometry, s.floorId).map((r) => r.id);
    const brief = buildFloorplanBrief({ ...s, output: "room_views", roomIds: rooms });
    expect(brief.runs).toHaveLength(2);
    expect(brief.credits).toBe(2 * CREDITS_PER_OUTPUT);
    expect(costSentence(brief)).toMatch(/refunded/);
    expect(floorplanCredits(3)).toBe(18);
  });

  it("drops style and furniture from an unfurnished plan", () => {
    const brief = buildFloorplanBrief(ready({ output: "unfurnished_3d" }));
    expect(brief.valid).toBe(true);
    expect(brief.payload.style_name).toBeNull();
    expect(brief.payload.furniture_level).toBe("none");
  });

  it("carries the concept disclaimer everywhere", () => {
    const brief = buildFloorplanBrief(ready());
    expect(brief.disclaimer).toBe(CONCEPT_DISCLAIMER);
    expect(brief.payload.disclaimer).toBe(CONCEPT_DISCLAIMER);
  });
});

describe("prompt", () => {
  const brief = buildFloorplanBrief(ready());

  it("locks the plan and never claims measured accuracy", () => {
    const p = floorplanPrompt(brief.payload, null);
    expect(p).toMatch(/The supplied plan is the authority/);
    expect(p).toMatch(/Do not add rooms, walls, doors/);
    expect(p).toMatch(/Kitchen/);
    expect(p).toMatch(/drawn as 12' x 10'/);
    expect(p).toMatch(/not construction documentation/);
    expect(p).toMatch(/No scale was calibrated/);
  });

  it("names the room when a single room view is requested", () => {
    const s = ready();
    const rooms = planRooms(s.geometry, s.floorId);
    const roomBrief = buildFloorplanBrief({ ...s, output: "room_views", roomIds: [rooms[0]!.id] });
    const run = buildRuns({ ...s, output: "room_views", roomIds: [rooms[0]!.id] }, s.geometry)[0]!;
    expect(floorplanPrompt(roomBrief.payload, run)).toMatch(/Render Kitchen only/);
  });
});

describe("drift", () => {
  it("keeps only known checks and flags major issues", () => {
    const report = normalizeDrift({
      issues: [
        { id: "room_count", severity: "major", detail: "The concept shows two rooms, the plan has three." },
        { id: "made_up", severity: "major", detail: "Ignored." },
        { id: "openings", severity: "minor", detail: "One window moved along the wall." },
      ],
    });
    expect(report.issues).toHaveLength(2);
    expect(report.major).toBe(true);
    expect(normalizeDrift({ issues: [] }).headline).toMatch(/follows your plan/);
  });
});

describe("persistence and reuse", () => {
  const brief = buildFloorplanBrief(ready());

  it("saves the interpretation with every view and restores it", () => {
    const meta = floorplanMeta({ payload: brief.payload, sourceVersion: "v1.png", run: "main" });
    expect(meta.classification).toBe("3D Plan Concept");
    expect(meta.geometry.length).toBe(brief.payload.geometry.length);

    const restored = restoreFromMeta(meta)!;
    expect(restored).not.toBeNull();
    expect(restored.output).toBe("furnished_3d");
    expect(restored.geometry.elements.map((e) => e.label)).toContain("Kitchen");
    expect(restoreFromMeta({ tool: "Sketch" })).toBeNull();
  });

  it("exports interpreted plan data other tools can read", () => {
    const s = ready();
    const data = exportPlanData({
      planId: "plan-1",
      sourceKind: "floor_plan_image",
      geometry: s.geometry,
      dimensions: [],
      cameras: [],
    });
    expect(data.floors[0]!.rooms.map((r) => r.label)).toContain("Kitchen");
    expect(data.dimensions_known).toBe(true);
    expect(data.disclaimer).toBe(CONCEPT_DISCLAIMER);

    const text = exportPlanText({
      planId: "plan-1",
      sourceKind: "floor_plan_image",
      geometry: s.geometry,
      dimensions: [],
      cameras: [],
    });
    expect(text).toMatch(/INTERPRETED FLOOR PLAN/);
    expect(text).toMatch(/NOT ESTABLISHED/);
  });

  it("produces an indicative schedule with no products or prices", () => {
    const sched = materialSchedule(brief.payload);
    expect(sched.rows.length).toBeGreaterThan(0);
    expect(sched.note).toMatch(/No products, quantities or costs/);
    expect(JSON.stringify(sched)).not.toMatch(/\$/);
  });
});

describe("readiness", () => {
  it("is only ready once walls or rooms exist", () => {
    expect(geometryReady(normalizeGeometry({ elements: [] }))).toBe(false);
    expect(geometryReady(normalizeGeometry(RAW_GEOMETRY))).toBe(true);
  });
});
