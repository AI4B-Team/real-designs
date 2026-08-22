import { describe, expect, it } from "vitest";

import { featureState, isFeatureVisible } from "./feature-availability";
import { NAV_GROUPS, SEARCH_SCOPES } from "./nav-items";

const views = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.view));

describe("app shell navigation policy", () => {
  it("never advertises Budget in the sidebar", () => {
    expect(featureState("budget")).toBe("hidden");
    expect(views).not.toContain("scope");
    expect(NAV_GROUPS.flatMap((g) => g.items).some((i) => /budget/i.test(i.label))).toBe(false);
  });

  it("never offers a Budget search scope", () => {
    expect(SEARCH_SCOPES.some((s) => /budget/i.test(s.scope))).toBe(false);
  });

  it("keeps every shipped destination in the sidebar regardless of workspace data", () => {
    for (const view of ["dash", "studio", "explore", "props", "designs", "media", "listings", "products", "reports", "present"]) {
      expect(views).toContain(view);
    }
  });

  it("hides deferred surfaces and keeps live ones", () => {
    expect(isFeatureVisible("budget")).toBe(false);
    expect(isFeatureVisible("api_white_label")).toBe(false);
    expect(isFeatureVisible("checkout")).toBe(false);
    expect(isFeatureVisible("products")).toBe(true);
    expect(isFeatureVisible("reports")).toBe(true);
  });

  it("gives every nav item a label and icon", () => {
    for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
