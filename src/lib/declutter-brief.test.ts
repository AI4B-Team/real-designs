import { describe, expect, it } from "vitest";
import {
  DECLUTTER_MODES,
  EMPTY_ROOM_CONFIRM,
  applyModeSelection,
  buildDeclutterBrief,
  buildRuns,
  classificationFor,
  declutterCredits,
  declutterMeta,
  declutterPrompt,
  emptyMask,
  isProtectedLabel,
  maskRegions,
  normalizeDetections,
  normalizeQuality,
  pushStroke,
  redoStroke,
  restoreFromMeta,
  restoreItem,
  undoStroke,
  type Detection,
} from "@/lib/declutter-brief";

const det = (over: Partial<Detection> = {}): Detection => ({
  id: "d1",
  label: "cardboard box",
  category: "boxes",
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
  confidence: 0.8,
  personal: false,
  protectedItem: false,
  decision: "keep",
  ...over,
});

const base = {
  roomType: "Living Room",
  notes: null,
  results: 1,
  hasSource: true,
  roomRead: null,
  emptyConfirm: null,
};

describe("detection", () => {
  it("normalizes boxes and flags furniture as protected", () => {
    const list = normalizeDetections({
      items: [
        { label: "sofa", category: "other", box: { x: -1, y: 0.2, w: 4, h: 0.3 } },
        { label: "power cord", category: "cords", box: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 } },
      ],
    });
    expect(list).toHaveLength(2);
    expect(list[0]!.protectedItem).toBe(true);
    expect(list[0]!.box.x).toBe(0);
    expect(list[0]!.box.w).toBeLessThanOrEqual(1);
    expect(list[1]!.category).toBe("cords");
    /* Nothing is selected for removal until a mode is applied. */
    expect(list.every((d) => d.decision === "keep")).toBe(true);
  });

  it("treats furniture, appliances and architecture as protected labels", () => {
    ["sofa", "refrigerator", "kitchen cabinet", "window", "door frame", "built-in shelving"].forEach(
      (l) => expect(isProtectedLabel(l)).toBe(true),
    );
    ["cardboard box", "toothbrush", "laundry pile"].forEach((l) =>
      expect(isProtectedLabel(l)).toBe(false),
    );
  });
});

describe("mode selection", () => {
  const items = [
    det({ id: "d1", label: "sofa", category: "other", protectedItem: true }),
    det({ id: "d2", label: "cardboard box", category: "boxes" }),
    det({ id: "d3", label: "framed family photo", category: "photos", personal: true }),
    det({ id: "d4", label: "toothbrush", category: "toiletries", personal: true }),
  ];

  it("auto mode never selects major furniture", () => {
    const out = applyModeSelection(items, "auto");
    expect(out.find((d) => d.id === "d1")!.decision).toBe("keep");
    expect(out.find((d) => d.id === "d2")!.decision).toBe("remove");
  });

  it("personal mode selects only personal items", () => {
    const out = applyModeSelection(items, "personal");
    expect(out.map((d) => d.decision)).toEqual(["keep", "keep", "remove", "remove"]);
  });

  it("select mode preselects nothing", () => {
    expect(applyModeSelection(items, "select").every((d) => d.decision === "keep")).toBe(true);
  });

  it("keep locks survive a mode change", () => {
    const out = applyModeSelection(items, "auto", ["d2"]);
    expect(out.find((d) => d.id === "d2")!.decision).toBe("keep");
  });
});

describe("masks", () => {
  it("keep selections override removals", () => {
    const items = [det({ id: "d1", decision: "remove" })];
    let mask = emptyMask();
    mask = pushStroke(mask, { x: 0.2, y: 0.2, r: 0.05, kind: "keep" });
    const regions = maskRegions(items, mask);
    expect(regions.remove).toHaveLength(0);
    expect(regions.keep.length + regions.strokes.length).toBeGreaterThan(0);
  });

  it("supports undo and redo of brush marks", () => {
    let mask = emptyMask();
    mask = pushStroke(mask, { x: 0.3, y: 0.3, r: 0.05, kind: "remove" });
    mask = pushStroke(mask, { x: 0.4, y: 0.4, r: 0.05, kind: "remove" });
    mask = undoStroke(mask);
    expect(mask.strokes).toHaveLength(1);
    mask = redoStroke(mask);
    expect(mask.strokes).toHaveLength(2);
  });

  it("puts the mask into the payload and the prompt", () => {
    const items = [det({ id: "d1", label: "cardboard box", decision: "remove" }), det({ id: "d2", label: "sofa", protectedItem: true })];
    const brief = buildDeclutterBrief({ ...base, mode: "select", detections: items, mask: emptyMask() });
    expect(brief.payload.remove[0]!.label).toBe("cardboard box");
    expect(brief.payload.keep[0]!.label).toBe("sofa");
    const prompt = declutterPrompt(brief.payload, null);
    expect(prompt).toContain("cardboard box at");
    expect(prompt).toContain("sofa at");
    expect(prompt).toContain("magenta");
  });
});

describe("brief", () => {
  it("refuses to run with nothing selected", () => {
    const brief = buildDeclutterBrief({ ...base, mode: "auto", detections: [], mask: emptyMask() });
    expect(brief.valid).toBe(false);
    expect(brief.missing).toContain("Select At Least One Item To Remove");
  });

  it("warns when furniture is marked for removal outside Empty Room", () => {
    const brief = buildDeclutterBrief({
      ...base,
      mode: "select",
      detections: [det({ label: "sofa", protectedItem: true, decision: "remove" })],
      mask: emptyMask(),
    });
    expect(brief.warnings.join(" ")).toContain("sofa");
  });

  it("requires a separate confirmation for Empty Room", () => {
    const items = [det({ decision: "remove" })];
    const no = buildDeclutterBrief({ ...base, mode: "empty_room", detections: items, mask: emptyMask() });
    expect(no.valid).toBe(false);
    expect(no.missing).toContain("Confirm Empty Room");
    const yes = buildDeclutterBrief({
      ...base,
      mode: "empty_room",
      detections: items,
      mask: emptyMask(),
      emptyConfirm: EMPTY_ROOM_CONFIRM,
    });
    expect(yes.valid).toBe(true);
    expect(yes.classification).toBe("Virtually Emptied");
    expect(yes.warnings.join(" ")).toContain("deletes the furniture");
  });

  it("discloses the provider mask limitation instead of faking precision", () => {
    const brief = buildDeclutterBrief({
      ...base,
      mode: "auto",
      detections: [det({ decision: "remove" })],
      mask: emptyMask(),
    });
    expect(brief.payload.mask_native).toBe(false);
    expect(brief.warnings.join(" ")).toContain("does not accept a separate mask layer");
  });

  it("prices one credit per requested result", () => {
    expect(declutterCredits(1)).toBe(1);
    expect(declutterCredits(3)).toBe(3);
    expect(buildRuns(3)).toHaveLength(3);
    const brief = buildDeclutterBrief({
      ...base,
      results: 2,
      mode: "auto",
      detections: [det({ decision: "remove" })],
      mask: emptyMask(),
    });
    expect(brief.credits).toBe(2);
    expect(brief.costSentence).toContain("free");
  });

  it("classifies each mode", () => {
    expect(classificationFor("auto")).toBe("Decluttered");
    expect(classificationFor("select")).toBe("Item Removal");
    expect(DECLUTTER_MODES.find((m) => m.id === "empty_room")!.needsConfirm).toBe(true);
  });
});

describe("quality and persistence", () => {
  it("rejects a result that lost furniture or drifted architecture", () => {
    const r = normalizeQuality({
      issues: [{ id: "furniture_lost", severity: "major", detail: "The armchair is gone." }],
    });
    expect(r.rejected).toBe(true);
    expect(normalizeQuality({ issues: [] }).headline).toContain("passed");
  });

  it("round-trips version metadata", () => {
    const items = [det({ decision: "remove" }), det({ id: "d2", label: "sofa", protectedItem: true })];
    const brief = buildDeclutterBrief({ ...base, mode: "select", detections: items, mask: pushStroke(emptyMask(), { x: 0.5, y: 0.5, r: 0.04, kind: "remove" }) });
    const meta = declutterMeta({
      payload: brief.payload,
      detections: items,
      sourceVersion: "rooms/a.jpg",
      run: "primary",
    });
    expect(meta.source_version).toBe("rooms/a.jpg");
    expect(meta.removal_mask).toHaveLength(1);
    expect(meta.strokes).toHaveLength(1);
    const back = restoreFromMeta(JSON.parse(JSON.stringify(meta)));
    expect(back).not.toBeNull();
    expect(back!.detections).toHaveLength(2);
    expect(back!.mask.strokes).toHaveLength(1);
    expect(back!.detections.find((d) => d.label === "sofa")!.protectedItem).toBe(true);
  });

  it("restores a mistakenly removed object without rebuilding the brief", () => {
    const items = [det({ id: "d1", decision: "remove" })];
    const after = restoreItem(items, "d1");
    expect(after[0]!.decision).toBe("keep");
    const brief = buildDeclutterBrief({ ...base, mode: "select", detections: after, mask: emptyMask() });
    expect(brief.valid).toBe(false);
    expect(maskRegions(after, emptyMask()).remove).toHaveLength(0);
  });
});
