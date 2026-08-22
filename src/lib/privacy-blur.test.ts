import { describe, expect, it } from "vitest";
import {
  BRUSH_MAX,
  DEFAULT_PRIVACY_SETTINGS,
  batchBlocked,
  batchRunnable,
  blurRadiusPx,
  brushFraction,
  clampPrivacySettings,
  deselectAll,
  exportWarning,
  featherPx,
  hasPrivacySelection,
  pixelBlockPx,
  privacyMetadata,
  safeDetections,
  selectAll,
  selectGroup,
  unselectedSensitive,
  type PrivacyDetection,
} from "@/lib/privacy-blur";
import { normalizePrivacyDetections, PRIVACY_DETECT_PROMPT } from "@/lib/privacy.server";
import { beginStroke, clearStrokes, createMaskState, extendStroke, redoStroke, undoStroke } from "@/lib/mask-engine";

const dets: PrivacyDetection[] = [
  { id: "a", label: "Faces", confidence: 0.9, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, category: "face" },
  { id: "b", label: "License Plates", confidence: 0.8, box: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, category: "plate" },
  { id: "c", label: "Computer Screens", confidence: 0.7, box: { x: 0.7, y: 0.2, w: 0.2, h: 0.2 }, category: "screen" },
];

describe("privacy detections", () => {
  it("selects automatic detections by category group", () => {
    let m = createMaskState();
    m = selectGroup(m, dets, "faces");
    expect(m.selectedRegions).toEqual(["a"]);
    m = selectGroup(m, dets, "plates");
    expect(m.selectedRegions.sort()).toEqual(["a", "b"]);
    expect(deselectAll(m).selectedRegions).toEqual([]);
    expect(selectAll(m, dets).selectedRegions).toHaveLength(3);
  });

  it("keeps manual masking usable when detection returns nothing", () => {
    let m = createMaskState();
    expect(hasPrivacySelection(m, [])).toBe(false);
    m = beginStroke(m, "add", { x: 0.3, y: 0.3 }, { size: 0.05 });
    m = extendStroke(m, { x: 0.4, y: 0.35 });
    expect(hasPrivacySelection(m, [])).toBe(true);
  });

  it("undo, redo and clear run through the shared engine", () => {
    let m = beginStroke(createMaskState(), "add", { x: 0.2, y: 0.2 }, { size: 0.05 });
    m = undoStroke(m);
    expect(m.strokes).toHaveLength(0);
    m = redoStroke(m);
    expect(m.strokes).toHaveLength(1);
    expect(clearStrokes(m).strokes).toHaveLength(0);
  });

  it("warns about detected areas the user left unselected", () => {
    const m = selectGroup(createMaskState(), dets, "faces");
    expect(unselectedSensitive(m, dets).map((d) => d.id)).toEqual(["b", "c"]);
    expect(exportWarning(m, dets)).toContain("Remain Unblurred");
    expect(exportWarning(selectAll(m, dets), dets)).toBeNull();
  });

  it("never carries transcribed content out of detection", () => {
    const raw = normalizePrivacyDetections({
      items: [{ category: "document", box: { x: 0.1, y: 0.1, w: 2, h: 0.2 }, confidence: 0.5, text: "1234 Elm St" }],
    });
    expect(raw[0]).not.toHaveProperty("text");
    expect(raw[0]!.box!.w).toBeLessThanOrEqual(0.9);
    expect(PRIVACY_DETECT_PROMPT).toMatch(/NEVER transcribe/);
    const safe = safeDetections(dets);
    expect(Object.keys(safe[0]!).sort()).toEqual(["box", "category", "confidence", "id", "label"]);
  });
});

describe("privacy settings", () => {
  it("clamps and persists brush, strength and feather", () => {
    const s = clampPrivacySettings({ brush: 9999, strength: -4, feather: 250, type: "pixelate" });
    expect(s.brush).toBe(BRUSH_MAX);
    expect(s.strength).toBe(1);
    expect(s.feather).toBe(100);
    expect(s.type).toBe("pixelate");
    expect(clampPrivacySettings(null).type).toBe(DEFAULT_PRIVACY_SETTINGS.type);
  });

  it("scales effect radius with strength and image size", () => {
    expect(blurRadiusPx(100, 2000)).toBeGreaterThan(blurRadiusPx(10, 2000));
    expect(pixelBlockPx(50, 4000)).toBeGreaterThan(pixelBlockPx(50, 1000));
    expect(featherPx(0, 2000)).toBe(0);
    expect(brushFraction(48, 1000)).toBeCloseTo(0.048, 4);
  });
});

describe("privacy persistence", () => {
  it("records provenance without content and charges nothing", () => {
    const m = selectAll(createMaskState(), dets);
    const meta = privacyMetadata({
      state: m,
      detections: dets,
      settings: { ...DEFAULT_PRIVACY_SETTINGS, type: "redact" },
      sourceVersion: "v3",
      resultPath: "renders/x.jpg",
    });
    expect(meta.credits).toBe(0);
    expect(meta.modification_class).toBe("Digitally Altered");
    expect(meta.categories.sort()).toEqual(["face", "plate", "screen"]);
    expect(meta.blur_type).toBe("redact");
    expect(meta.source_version).toBe("v3");
    expect(JSON.stringify(meta)).not.toMatch(/Elm|text/);
  });
});

describe("batch privacy review", () => {
  const items = [
    { key: "1", label: "A", detections: dets, reviewed: true, approved: true },
    { key: "2", label: "B", detections: dets, reviewed: true, approved: false },
    { key: "3", label: "C", detections: [], reviewed: false, approved: false },
  ];
  it("only runs photos the user reviewed and approved", () => {
    expect(batchRunnable(items).map((i) => i.key)).toEqual(["1"]);
    expect(batchBlocked(items)).toBe(1);
  });
});
