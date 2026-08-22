import { describe, expect, it } from "vitest";
import {
  compareEnabled,
  defaultGenerationSource,
  defaultOpenSections,
  detectPhotoTraits,
  editedFromLabel,
  enhancementByOp,
  footerLayout,
  generativeEdits,
  photoEnhancements,
  primarySaveLabel,
  PANEL_SECTIONS,
} from "@/lib/photo-editor-context";

describe("photo editor context", () => {
  it("hides outdoor-only enhancements on an interior photograph", () => {
    const traits = detectPhotoTraits({ room: "Kitchen" });
    const ops = photoEnhancements(traits).map((o) => o.op);
    expect(traits.interior).toBe(true);
    expect(ops).not.toContain("lawn");
    expect(ops).not.toContain("sky");
    expect(ops).toContain("window_balance");
  });

  it("offers sky and lawn on an exterior photograph", () => {
    const ops = photoEnhancements(detectPhotoTraits({ room: "Front Exterior" })).map((o) => o.op);
    expect(ops).toContain("sky");
    expect(ops).toContain("lawn");
  });

  it("hides window balance where there are no windows", () => {
    const ops = photoEnhancements(detectPhotoTraits({ room: "Walk-In Closet" })).map((o) => o.op);
    expect(ops).not.toContain("window_balance");
  });

  it("keeps generative edits behind an explicit target confirmation with a cost", () => {
    for (const e of generativeEdits()) {
      expect(e.requiresTarget).toBe(true);
      expect(e.credits).toBeGreaterThan(0);
    }
    expect(generativeEdits().map((e) => e.op)).toEqual(["object_removal", "declutter"]);
  });

  it("does not duplicate Auto Enhance outside Quick Enhance", () => {
    const enhance = photoEnhancements(detectPhotoTraits({ room: "Living Room" }));
    expect(enhance.filter((e) => e.op === "auto_enhance")).toHaveLength(1);
    expect(PANEL_SECTIONS.map((s) => s.id)).toEqual([
      "light",
      "color",
      "detail",
      "crop",
      "enhance",
      "generative",
    ]);
  });

  it("stacks the footer when the panel is too narrow for three labels", () => {
    expect(footerLayout(360)).toBe("stack");
    expect(footerLayout(419)).toBe("stack");
    expect(footerLayout(420)).toBe("row");
  });

  it("never overwrites a persisted generated version", () => {
    expect(primarySaveLabel({ mode: "generated" })).toBe("Save As New Version");
    expect(primarySaveLabel({ mode: "source" })).toBe("Save Changes");
    expect(primarySaveLabel({ mode: "generated", hasPersistedVersion: false })).toBe("Save Changes");
  });

  it("labels the parent of an edited version", () => {
    expect(editedFromLabel(7)).toBe("Edited From Version 7");
    expect(editedFromLabel(null)).toBeNull();
  });

  it("defaults source-mode generation to the edited photo", () => {
    expect(defaultGenerationSource("source")).toBe("edited");
    expect(defaultGenerationSource("generated")).toBe("original");
  });

  it("only enables compare once something changed", () => {
    expect(compareEnabled(false)).toBe(false);
    expect(compareEnabled(true)).toBe(true);
  });

  it("opens exactly one long section by default", () => {
    expect(defaultOpenSections()).toEqual(["light"]);
  });

  it("knows the cost of every operation it can run", () => {
    expect(enhancementByOp("declutter")?.credits).toBe(1);
    expect(enhancementByOp("nope")).toBeUndefined();
  });
});
