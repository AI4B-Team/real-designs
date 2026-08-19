import { describe, expect, it } from "vitest";

import { groupBySpace, styleCompatibility, styleFitsSpace } from "@/lib/staging-bulk";
import { STYLES } from "@/lib/style-catalog";

describe("bulk style compatibility", () => {
  it("does not warn about an interior direction used on an exterior", () => {
    expect(styleCompatibility("warm-minimal", "exterior")).toBe("compatible");
  });

  it("only advises where the catalog declares the space uncommon", () => {
    const declared = STYLES.filter((s) => (s.uncommonProjectTypes || []).length);
    declared.forEach((s) => {
      (s.uncommonProjectTypes || []).forEach((t) => {
        const space = t === "garden" ? "landscape" : t;
        expect(styleCompatibility(s.id, space)).toBe("unusual");
      });
    });
    const undeclared = STYLES.filter((s) => !(s.uncommonProjectTypes || []).length);
    undeclared.forEach((s) => {
      expect(["compatible", "unsupported"]).toContain(styleCompatibility(s.id, "exterior"));
    });
  });

  it("still blocks operations that genuinely cannot run", () => {
    const garden = STYLES.find(
      (s) =>
        s.compatibleProjectTypes.filter((t) => t !== "concept").every((t) => t === "garden") &&
        s.compatibleProjectTypes.includes("garden"),
    );
    if (garden) expect(styleFitsSpace(garden.id, "interior")).toBe(false);
  });

  it("never warns for a photo with no room type yet", () => {
    expect(styleCompatibility("warm-minimal", "unassigned")).toBe("compatible");
  });
});

describe("selected photo grouping", () => {
  it("keeps every photo and separates spaces", () => {
    const groups = groupBySpace([
      { key: "1", room: "Kitchen" },
      { key: "2", room: "Front Elevation" },
      { key: "3", room: "Bedroom" },
      { key: "4" },
    ]);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(4);
    const spaces = groups.map((g) => g.space).sort();
    expect(spaces).toContain("interior");
    expect(spaces).toContain("exterior");
    expect(spaces).toContain("unassigned");
  });
});
