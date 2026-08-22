import { describe, expect, it } from "vitest";
import {
  buildMaterialsBrief,
  buildRuns,
  materialsCredits,
  materialsMeta,
  materialsPrompt,
  normalizeQuality,
  normalizeSurfaces,
  restoreFromMeta,
  type MaterialsSettings,
  type SurfaceDetection,
} from "@/lib/materials-brief";
import { isCompatible, materialsForSurface } from "@/lib/materials-catalog";

const floor: SurfaceDetection = {
  id: "s1",
  label: "living room floor",
  kind: "flooring",
  box: { x: 0, y: 0.55, w: 1, h: 0.45 },
  current: "worn beige carpet",
  confidence: 0.9,
  area: 0.45,
};
const wall: SurfaceDetection = {
  id: "s2",
  label: "back wall",
  kind: "wall_paint",
  box: { x: 0, y: 0.1, w: 1, h: 0.4 },
  current: "flat beige paint",
  confidence: 0.8,
  area: 0.4,
};

function settings(over: Partial<MaterialsSettings> = {}): MaterialsSettings & { hasSource: boolean } {
  return {
    surfaceId: "s1",
    surfaceKind: "flooring",
    detections: [floor, wall],
    mask: emptyMask(),
    materialId: "white_oak",
    finishId: "matte",
    colorId: "natural",
    patternId: "straight",
    scaleId: "wide",
    groutId: null,
    results: 1,
    notes: null,
    roomType: "Living Room",
    roomRead: {
      roomType: "Living Room",
      summary: "A bright living room.",
      lighting: "Soft daylight from the left.",
      otherSurfaces: ["white ceiling", "oak trim"],
    },
    hasSource: true,
    ...over,
  };
}

describe("materials brief", () => {
  it("is valid for one surface with one compatible material", () => {
    const b = buildMaterialsBrief(settings());
    expect(b.valid).toBe(true);
    expect(b.missing).toEqual([]);
    expect(b.credits).toBe(1);
  });

  it("refuses to run without a surface", () => {
    const b = buildMaterialsBrief(settings({ surfaceId: null, surfaceKind: null }));
    expect(b.valid).toBe(false);
    expect(b.missing).toContain("Select A Surface");
  });

  it("refuses a material that cannot go on the surface", () => {
    const b = buildMaterialsBrief(settings({ materialId: "arch_shingle" }));
    expect(b.valid).toBe(false);
    expect(b.missing.join(" ")).toMatch(/suits/i);
  });

  it("refuses without a photo", () => {
    expect(buildMaterialsBrief(settings({ hasSource: false } as any)).missing).toContain("Add A Photo");
  });

  it("charges one credit per requested option", () => {
    expect(materialsCredits(3)).toBe(3);
    expect(buildMaterialsBrief(settings({ results: 4 })).credits).toBe(4);
    expect(buildRuns(4)).toHaveLength(4);
    expect(buildRuns(9)).toHaveLength(4);
  });

  it("protects every other detected surface", () => {
    const b = buildMaterialsBrief(settings());
    expect(b.payload.keep.map((k) => k.label)).toEqual(["back wall"]);
    expect(b.payload.target.map((t) => t.label)).toEqual(["living room floor"]);
  });
});

describe("materials prompt", () => {
  const b = buildMaterialsBrief(settings());
  const prompt = materialsPrompt(b.payload, null);

  it("names the single target surface and its current material", () => {
    expect(prompt).toContain("living room floor");
    expect(prompt).toContain("worn beige carpet");
    expect(prompt).toContain("White Oak");
  });

  it("states the single-surface, preserve-everything rule", () => {
    expect(prompt).toMatch(/Change exactly one surface/);
    expect(prompt).toMatch(/Respect occlusion/);
    expect(prompt).toMatch(/Follow perspective/);
    expect(prompt).toContain("back wall");
  });

  it("carries finish, colour, scale and layout choices", () => {
    expect(prompt).toMatch(/Colour:/);
    expect(prompt).toMatch(/Finish:/);
    expect(prompt).toMatch(/Scale:/);
    expect(prompt).toMatch(/Layout:/);
  });

  it("adds the variation directive for extra options", () => {
    const runs = buildRuns(2);
    expect(materialsPrompt(b.payload, runs[1]!)).toContain(runs[1]!.directive);
  });
});

describe("catalog compatibility", () => {
  it("never offers roofing indoors or carpet on a counter", () => {
    expect(isCompatible("countertop", "wool_carpet")).toBe(false);
    expect(isCompatible("flooring", "arch_shingle")).toBe(false);
    expect(isCompatible("flooring", "white_oak")).toBe(true);
  });

  it("gives every surface at least one material", () => {
    ["flooring", "countertop", "backsplash", "cabinetry", "siding", "roofing", "paving"].forEach((k) => {
      expect(materialsForSurface(k).length).toBeGreaterThan(0);
    });
  });
});

describe("detection normalization", () => {
  it("maps loose model labels onto real surface kinds", () => {
    const out = normalizeSurfaces({
      surfaces: [
        { id: "a", label: "kitchen floor", kind: "floor", current_material: "tile", box: { x: 0, y: 0.6, w: 1, h: 0.4 }, confidence: 0.9 },
        { id: "b", label: "counters", kind: "worktop", current_material: "granite", box: { x: 0.2, y: 0.4, w: 0.5, h: 0.1 }, confidence: 0.7 },
        { id: "c", label: "nonsense", kind: "spaceship", box: {} },
      ],
    });
    expect(out.map((s) => s.kind)).toEqual(["flooring", "countertop"]);
  });
});

describe("quality report", () => {
  it("rejects a result that changed another surface", () => {
    const r = normalizeQuality({
      issues: [{ id: "other_surface_changed", severity: "major", detail: "The walls turned grey." }],
    });
    expect(r.rejected).toBe(true);
  });

  it("passes a clean result", () => {
    expect(normalizeQuality({ issues: [] }).rejected).toBe(false);
  });
});

describe("persistence", () => {
  it("round-trips a saved swap", () => {
    const s = settings();
    const b = buildMaterialsBrief(s);
    const meta = materialsMeta({ payload: b.payload, settings: s, sourceVersion: "v1", run: "Exact Specification" });
    const back = restoreFromMeta(meta);
    expect(back?.materialId).toBe("white_oak");
    expect(back?.surfaceKind).toBe("flooring");
    expect(back?.detections).toHaveLength(2);
    expect(back?.surfaceId).toBe("s1");
  });

  it("ignores metadata from another tool", () => {
    expect(restoreFromMeta({ tool: "Declutter" })).toBeNull();
  });
});
