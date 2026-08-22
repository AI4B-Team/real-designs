import { describe, expect, it } from "vitest";
import {
  CREDITS_PER_EDIT,
  actionSupported,
  autoName,
  buildObjectEditBrief,
  costSentence,
  defaultSettings,
  emptyMask,
  growMask,
  hasMask,
  invertMask,
  maskRegions,
  maskSummary,
  matchingTargets,
  normalizeDetections,
  normalizePreservation,
  objectEditMeta,
  objectEditPrompt,
  pushStroke,
  redoStroke,
  undoStroke,
  type Detection,
  type MaskState,
} from "@/lib/object-edit-brief";

function det(over: Partial<Detection> = {}): Detection {
  return {
    id: "d1",
    label: "Gray Sofa",
    category: "seating",
    box: { x: 0.2, y: 0.4, w: 0.3, h: 0.25 },
    confidence: 0.9,
    movable: true,
    architectural: false,
    selected: true,
    protectedItem: false,
    ...over,
  };
}

function brief(detections: Detection[], mask: MaskState, settings = defaultSettings()) {
  return buildObjectEditBrief({ hasSource: true, detections, mask, settings });
}

describe("detection normalization", () => {
  it("names every object even when the model returns none", () => {
    expect(autoName("", "lighting", 2)).toBe("Lighting 3");
    expect(autoName("floor lamp", "lighting", 0)).toBe("Floor Lamp");
  });

  it("treats architecture as protected and immovable", () => {
    const out = normalizeDetections({
      objects: [{ label: "Window", category: "opening", architectural: true, box: { x: 0, y: 0, w: 0.4, h: 0.4 } }],
    });
    expect(out[0]!.protectedItem).toBe(true);
    expect(out[0]!.movable).toBe(false);
  });
});

describe("mask maths", () => {
  it("undo and redo round-trip a stroke", () => {
    const one = pushStroke(emptyMask(), { x: 0.5, y: 0.5, r: 0.05, kind: "add" });
    expect(undoStroke(one).strokes).toHaveLength(0);
    expect(redoStroke(undoStroke(one)).strokes).toHaveLength(1);
  });

  it("expand and contract move the target edge", () => {
    const grown = growMask(emptyMask(), 0.02);
    const region = maskRegions([det()], grown).edit[0]!;
    expect(region.box.w).toBeGreaterThan(0.3);
    const shrunk = maskRegions([det()], growMask(emptyMask(), -0.02)).edit[0]!;
    expect(shrunk.box.w).toBeLessThan(0.3);
  });

  it("invert swaps target and protected regions", () => {
    const detections = [det(), det({ id: "d2", label: "Wall", selected: false, protectedItem: true })];
    const flipped = maskRegions(detections, invertMask(emptyMask()));
    expect(flipped.edit[0]!.label).toBe("Wall");
    expect(flipped.protect[0]!.label).toBe("Gray Sofa");
  });

  it("counts a brushed area as a real selection", () => {
    expect(hasMask([], emptyMask())).toBe(false);
    expect(hasMask([], pushStroke(emptyMask(), { x: 0.1, y: 0.1, r: 0.04, kind: "add" }))).toBe(true);
    expect(maskSummary([], emptyMask())).toBe("Nothing selected yet");
  });
});

describe("brief validation", () => {
  it("refuses to run without a selection", () => {
    const b = brief([det({ selected: false })], emptyMask());
    expect(b.valid).toBe(false);
    expect(b.missing).toContain("Select Or Brush The Target");
  });

  it("requires the input each action needs", () => {
    const b = brief([det()], emptyMask(), { ...defaultSettings(), action: "replace" });
    expect(b.missing).toContain("Describe The Replacement");
    const ok = brief([det()], emptyMask(), {
      ...defaultSettings(),
      action: "replace",
      instruction: "A walnut sideboard",
    });
    expect(ok.valid).toBe(true);
  });

  it("never offers Move on architecture", () => {
    expect(actionSupported("move", { movable: false }).ok).toBe(false);
    expect(actionSupported("remove", { movable: false }).ok).toBe(true);
    const b = brief([det({ movable: false, architectural: true })], emptyMask(), {
      ...defaultSettings(),
      action: "move",
      instruction: "To the far wall",
    });
    expect(b.valid).toBe(false);
  });

  it("charges one credit and says so before anything runs", () => {
    const b = brief([det()], emptyMask());
    expect(b.credits).toBe(CREDITS_PER_EDIT);
    expect(costSentence(b)).toContain("1 credit");
    expect(costSentence(b)).toContain("preserved");
  });

  it("extends the target set to matching objects when asked", () => {
    const detections = [det(), det({ id: "d2", label: "Second Sofa", selected: false })];
    expect(matchingTargets(detections, detections[0]!)).toHaveLength(1);
    const b = brief(detections, emptyMask(), { ...defaultSettings(), applyToMatching: true });
    expect(b.payload.targets).toHaveLength(2);
  });
});

describe("prompt and metadata", () => {
  it("states the preservation contract and the mask", () => {
    const b = brief([det(), det({ id: "d2", label: "Window", selected: false, protectedItem: true })], emptyMask());
    const prompt = objectEditPrompt(b.payload);
    expect(prompt).toContain("magenta");
    expect(prompt).toContain("Gray Sofa");
    expect(prompt).toContain("Window");
    expect(prompt).toContain("identical to the source photograph");
  });

  it("stores the mask and action with the saved version", () => {
    const b = brief([det()], pushStroke(emptyMask(), { x: 0.2, y: 0.2, r: 0.03, kind: "add" }));
    const meta = objectEditMeta({ payload: b.payload, sourceVersion: "v1.png", model: "m" });
    expect(meta.classification).toBe("Object Removed");
    expect(meta.source_version).toBe("v1.png");
    expect(meta.mask.strokes).toHaveLength(1);
  });
});

describe("preservation report", () => {
  it("rejects a result that changed the rest of the room", () => {
    const r = normalizePreservation({
      drift: 0.3,
      issues: [{ id: "outside_changed", severity: "major", detail: "The floor was re-textured." }],
    });
    expect(r.rejected).toBe(true);
    expect(r.headline).toContain("more than your selection");
  });

  it("accepts a clean result", () => {
    const r = normalizePreservation({ drift: 0.01, issues: [] });
    expect(r.rejected).toBe(false);
    expect(r.headline).toBe("Only your selection changed");
  });
});
