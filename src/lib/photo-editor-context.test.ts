import { describe, expect, it } from "vitest";
import {
  compareEnabled,
  continueWithTools,
  defaultGenerationSource,
  defaultOpenSections,
  detectPhotoTraits,
  editedFromLabel,
  enhancementByOp,
  footerLayout,
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

  it("hands scene-changing work to the canonical rail tools", () => {
    const tools = continueWithTools().map((t) => t.tool);
    expect(tools).toEqual(["Redesign", "Virtual Stage", "Declutter", "Material Swap", "object"]);
    for (const t of continueWithTools()) expect(t.blurb.length).toBeGreaterThan(10);
  });

  it("keeps Auto Enhance out of the credit-bearing AI section", () => {
    const enhance = photoEnhancements(detectPhotoTraits({ room: "Living Room" }));
    expect(enhance.some((e) => e.op === "auto_enhance")).toBe(false);
    expect(enhance.every((e) => e.credits > 0)).toBe(true);
    expect(PANEL_SECTIONS.map((s) => s.id)).toEqual([
      "auto",
      "light",
      "detail",
      "crop",
      "ai",
      "continue",
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
