import { describe, expect, it } from "vitest";

import {
  canEnterReview,
  creditCost,
  designBlockers,
  designGroups,
  effectiveStyleId,
  newDesignModel,
  normalizeDesignModel,
  pruneIncompatible,
  reviewBlockers,
  toDirection,
} from "@/lib/staging-design";
import { STYLES } from "@/lib/style-catalog";

const interiorStyle = STYLES.find((s) => s.compatibleProjectTypes.includes("interior"))!;
const exteriorStyle = STYLES.find((s) => s.compatibleProjectTypes.includes("exterior"))!;

const photos = [
  { key: "a", room: "Kitchen", selected: true, status: "ready" },
  { key: "b", room: "Bedroom", selected: true, status: "ready" },
  { key: "c", room: "Front Elevation", selected: true, status: "ready" },
];

describe("multi-photo design model", () => {
  it("groups mixed spaces so one style is never forced across them", () => {
    const groups = designGroups(photos);
    expect(groups.map((g) => g.space)).toEqual(["interior", "exterior"]);
    expect(groups[0].items).toHaveLength(2);
  });

  it("blocks the next step until every group has a style", () => {
    const model = newDesignModel();
    expect(designBlockers(photos, model).length).toBeGreaterThan(0);
    model.styleBySpace.interior = interiorStyle.id;
    model.styleBySpace.exterior = exteriorStyle.id;
    expect(designBlockers(photos, model)).toEqual([]);
    expect(canEnterReview(photos, model)).toBe(true);
  });

  it("lets one photo override its group style", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorStyle.id;
    model.overrides.b = STYLES.filter((s) => s.compatibleProjectTypes.includes("interior"))[1].id;
    expect(effectiveStyleId(model, photos[0])).toBe(interiorStyle.id);
    expect(effectiveStyleId(model, photos[1])).toBe(model.overrides.b);
  });

  it("clears only the choice a room-type change made impossible", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorStyle.id;
    model.notes = "Warm oak floors";
    model.direction = "renovation";
    const gardenOnly = STYLES.find(
      (s) =>
        s.compatibleProjectTypes.filter((t) => t !== "concept").every((t) => t === "garden") &&
        s.compatibleProjectTypes.includes("garden"),
    );
    if (!gardenOnly) return;
    model.styleBySpace.exterior = gardenOnly.id;
    const out = pruneIncompatible(model, photos);
    expect(out.model.styleBySpace.exterior).toBeUndefined();
    expect(out.model.styleBySpace.interior).toBe(interiorStyle.id);
    expect(out.model.notes).toBe("Warm oak floors");
    expect(out.model.direction).toBe("renovation");
    expect(out.cleared.length).toBe(1);
  });

  it("charges one credit per photo and explains a short balance", () => {
    expect(creditCost(photos)).toBe(3);
    const model = newDesignModel();
    model.styleBySpace.interior = interiorStyle.id;
    model.styleBySpace.exterior = exteriorStyle.id;
    expect(reviewBlockers({ items: photos, model, balance: 10 })).toEqual([]);
    const short = reviewBlockers({ items: photos, model, balance: 1 });
    expect(short.join(" ")).toContain("2 more credits");
  });

  it("sends every chosen style to the render payload", () => {
    const model = normalizeDesignModel({
      styleBySpace: { interior: interiorStyle.id, exterior: exteriorStyle.id },
      overrides: { b: exteriorStyle.id },
      direction: "refresh",
      grade: "premium",
      preserve: false,
    });
    const dir = toDirection(model, photos, "1:1");
    expect(dir.styleBySpace.interior.id).toBe(interiorStyle.id);
    expect(dir.styleByPhoto.b.id).toBe(exteriorStyle.id);
    expect(dir.intensity).toBe("Refresh");
    expect(dir.grade).toBe("Premium Grade");
    expect(dir.preserve).toBe(false);
    expect(dir.outputRatio).toBe("1:1");
  });
});
