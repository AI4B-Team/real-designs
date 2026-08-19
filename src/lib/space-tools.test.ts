import { describe, expect, it } from "vitest";
import {
  costLabel,
  instructionPlaceholder,
  normalizeSpace,
  spacePromptIntro,
  spacePromptRules,
  styleCompatible,
  styleProjectType,
  styleSectionLabel,
  toolCost,
  toolDescription,
  toolLabel,
  toolSupport,
} from "./space-tools";
import { browserSubtitle, sectionTitle, stylesForNeed } from "./canvas-style";

describe("space normalization", () => {
  it("maps chip values and synonyms", () => {
    expect(normalizeSpace("Exterior")).toBe("exterior");
    expect(normalizeSpace("landscape")).toBe("garden");
    expect(normalizeSpace("")).toBe("interior");
    expect(normalizeSpace(null)).toBe("interior");
  });
});

describe("space-aware tool copy", () => {
  it("keeps interior staging language on interiors", () => {
    expect(toolLabel("Virtual Stage", "interior")).toBe("Stage");
    expect(toolDescription("Virtual Stage", "interior")).toBe(
      "Choose the furniture and décor style for this room.",
    );
  });

  it("renames Stage contextually for exterior and garden", () => {
    expect(toolLabel("Virtual Stage", "exterior")).toBe("Exterior Styling");
    expect(toolLabel("Virtual Stage", "garden")).toBe("Landscape Design");
    expect(toolDescription("Virtual Stage", "exterior")).toBe(
      "Improve curb appeal with compatible landscaping, exterior décor, lighting, and finishes.",
    );
    expect(toolDescription("Virtual Stage", "garden")).toBe(
      "Add plants, hardscaping, lighting, and outdoor features in the selected style.",
    );
  });

  it("never describes an exterior as an empty room to furnish", () => {
    for (const space of ["exterior", "garden"]) {
      const d = toolDescription("Virtual Stage", space).toLowerCase();
      expect(d).not.toContain("furniture");
      expect(d).not.toContain("room");
    }
  });
});

describe("tool compatibility", () => {
  it("disables interior-only tools outside interiors with a reason", () => {
    expect(toolSupport("2D To 3D Plan", "interior").ok).toBe(true);
    const ex = toolSupport("2D To 3D Plan", "exterior");
    expect(ex.ok).toBe(false);
    expect(ex.reason).toMatch(/interior/i);
    expect(toolSupport("2D To 3D Plan", "garden").ok).toBe(false);
  });

  it("keeps styling tools available on every space", () => {
    for (const space of ["interior", "exterior", "garden"]) {
      expect(toolSupport("Redesign", space).ok).toBe(true);
      expect(toolSupport("Virtual Stage", space).ok).toBe(true);
    }
  });
});

describe("style sections", () => {
  it("labels the section for the active space", () => {
    expect(styleSectionLabel("stage", "interior")).toBe("Staging Style");
    expect(styleSectionLabel("stage", "exterior")).toBe("Exterior Style");
    expect(styleSectionLabel("design", "garden")).toBe("Landscape Style");
    expect(sectionTitle("stage", "exterior")).toBe("Exterior Style");
    expect(sectionTitle("stage")).toBe("Staging Style");
  });

  it("selects the catalog pool by space, not by tool alone", () => {
    expect(styleProjectType("stage", "interior")).toBe("virtual-staging");
    expect(styleProjectType("stage", "exterior")).toBe("exterior");
    expect(styleProjectType("design", "garden")).toBe("garden");
  });

  it("rejects a style that is not compatible with the active pool", () => {
    expect(styleCompatible(["virtual-staging"], "stage", "interior")).toBe(true);
    expect(styleCompatible(["virtual-staging"], "stage", "exterior")).toBe(false);
    expect(styleCompatible(["exterior", "garden"], "design", "garden")).toBe(true);
    expect(styleCompatible([], "design", "interior")).toBe(false);
  });

  it("offers exterior styles to a staging tool on an exterior photo", () => {
    const all = [
      {
        id: "a",
        isActive: true,
        isAuto: false,
        compatibleProjectTypes: ["virtual-staging"],
      },
      { id: "b", isActive: true, isAuto: false, compatibleProjectTypes: ["exterior"] },
    ] as any;
    const out = stylesForNeed(all, "stage", "exterior");
    expect(out.map((s: any) => s.id)).toEqual(["b"]);
  });

  it("never promises indoor furniture in the exterior browser subtitle", () => {
    const sub = browserSubtitle("stage", "front yard", "exterior").toLowerCase();
    expect(sub).toContain("no indoor furniture");
    expect(sub).toContain("roofline");
  });
});

describe("credit cost display", () => {
  it("states the real cost of a run", () => {
    expect(toolCost("Redesign")).toBe(1);
    expect(toolCost("Walkthrough Video")).toBe(40);
    expect(toolCost("2D To 3D Plan")).toBe(6);
    expect(costLabel(1)).toBe("1 Credit");
    expect(costLabel(40)).toBe("40 Credits");
    expect(costLabel(0)).toBe("Free");
  });
});

describe("instruction placeholder", () => {
  it("is space aware and free of budget language", () => {
    for (const space of ["interior", "exterior", "garden"]) {
      const p = instructionPlaceholder(space);
      expect(p).not.toMatch(/\$|budget|under \d/i);
    }
    expect(instructionPlaceholder("exterior")).toMatch(/roofline/i);
    expect(instructionPlaceholder("garden")).toMatch(/planting/i);
  });
});

describe("generation payload rules", () => {
  it("carries architecture preservation per space", () => {
    expect(spacePromptRules("exterior").join(" ")).toMatch(/lot boundaries/i);
    expect(spacePromptRules("exterior").join(" ")).toMatch(/never add indoor furniture/i);
    expect(spacePromptRules("garden").join(" ")).toMatch(/mature trees/i);
    expect(spacePromptRules("interior").join(" ")).toMatch(/ceiling height/i);
  });

  it("uses space-specific intros for the staging tool", () => {
    expect(spacePromptIntro("interior", "Virtual Stage", "living room", "Warm Minimal")).toMatch(
      /stage this empty/i,
    );
    expect(spacePromptIntro("exterior", "Virtual Stage", "facade", "Warm Minimal")).toMatch(
      /curb appeal/i,
    );
    expect(spacePromptIntro("garden", "Virtual Stage", "back yard", "Warm Minimal")).toMatch(
      /hardscaping/i,
    );
  });
});
