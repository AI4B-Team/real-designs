/**
 * Design step: selection truth, category isolation and footer behaviour.
 *
 * These tests exist because a decorative checkmark once made every style look
 * selected. Selection state is asserted from the rendered markup, so visual
 * state and model state can never drift apart again.
 */
import { describe, expect, it } from "vitest";
import { designStepHtml, quickCards } from "@/lib/staging-design-ui";
import {
  categoryStatus,
  clearCategoryStyle,
  designBlockerSummary,
  designBlockers,
  effectiveStyleId,
  newDesignModel,
} from "@/lib/staging-design";
import { compatibleStyles } from "@/lib/staging-design";

const items = [
  { key: "a", room: "Kitchen", selected: true },
  { key: "b", room: "Kitchen", selected: true },
  { key: "c", room: "Bedroom", selected: true },
  { key: "d", room: "Front Exterior", selected: true },
];

const interiorId = () => compatibleStyles("interior")[0].id;
const exteriorId = () => compatibleStyles("exterior")[0].id;

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("design step selection state", () => {
  it("shows no selected card when the model holds no style id", () => {
    const html = designStepHtml({ items, model: newDesignModel() });
    expect(count(html, "rdd-card-ck")).toBe(0);
    expect(count(html, 'aria-selected="true"')).toBe(0);
    expect(html).toContain('aria-selected="false"');
  });

  it("marks exactly one card selected per category", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    const html = designStepHtml({ items, model });
    expect(count(html, "rdd-card-ck")).toBe(1);
    expect(count(html, 'aria-selected="true"')).toBe(1);
  });

  it("replaces the previous selection instead of adding one", () => {
    const model = newDesignModel();
    const pool = compatibleStyles("interior");
    model.styleBySpace.interior = pool[0].id;
    model.styleBySpace.interior = pool[1].id;
    expect(model.styleBySpace.interior).toBe(pool[1].id);
    expect(count(designStepHtml({ items, model }), 'aria-selected="true"')).toBe(1);
  });

  it("never offers an interior style to exterior photos", () => {
    const ids = quickCards("exterior", "").map((s) => s.id);
    const interiorOnly = compatibleStyles("interior")
      .map((s) => s.id)
      .filter((id) => !compatibleStyles("exterior").some((e) => e.id === id));
    interiorOnly.forEach((id) => expect(ids).not.toContain(id));
  });

  it("never applies an interior selection to an exterior photo", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    expect(effectiveStyleId(model, items[3])).toBe("");
  });
});

describe("categories and layout", () => {
  it("renders one section per present category with its applies-to summary", () => {
    const html = designStepHtml({ items, model: newDesignModel() });
    expect(html).toContain('data-space="interior"');
    expect(html).toContain('data-space="exterior"');
    expect(html).toContain("Kitchen &times;2");
    expect(html).toContain("Front Exterior &times;1");
  });

  it("shows compact completion status for every category", () => {
    const cats = categoryStatus(items, newDesignModel());
    expect(cats.map((c) => c.label)).toEqual(["Interior", "Exterior"]);
    expect(cats.every((c) => !c.complete)).toBe(true);
    const html = designStepHtml({ items, model: newDesignModel() });
    expect(count(html, "Style Needed")).toBe(2);
  });

  it("keeps long style names readable rather than cutting them out of markup", () => {
    const html = designStepHtml({ items, model: newDesignModel() });
    const long = compatibleStyles("interior").find((s) => s.displayName.length > 14);
    if (long && quickCards("interior", "").some((s) => s.id === long.id)) {
      expect(html).toContain(long.displayName);
      expect(html).toContain(`title="${long.displayName}"`);
    }
  });

  it("gives every card the same structure, so heights match", () => {
    const html = designStepHtml({ items, model: newDesignModel() });
    expect(count(html, "rdd-card-th")).toBe(count(html, "rdd-card-t\">"));
  });

  it("uses one scroll region and a permanently visible footer", () => {
    const html = designStepHtml({ items, model: newDesignModel() });
    expect(count(html, "rdd-scroll")).toBe(1);
    expect(html).toContain("rdd-foot");
    expect(html.indexOf("rdd-foot")).toBeGreaterThan(html.indexOf("rdd-ovr"));
  });

  it("does not repeat the page title inside the content", () => {
    expect(designStepHtml({ items, model: newDesignModel() })).not.toContain(
      "Choose a Design Style",
    );
  });
});

describe("clearing and overrides", () => {
  it("clears only its own category", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    model.styleBySpace.exterior = exteriorId();
    const next = clearCategoryStyle(model, "interior");
    expect(next.styleBySpace.interior).toBeUndefined();
    expect(next.styleBySpace.exterior).toBe(model.styleBySpace.exterior);
  });

  it("offers Clear Selection only after a style is chosen", () => {
    const empty = designStepHtml({ items, model: newDesignModel() });
    expect(empty).not.toContain("Clear Selection");
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    expect(count(designStepHtml({ items, model }), "Clear Selection")).toBe(1);
  });

  it("keeps individual overrides from touching other photos", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    const other = compatibleStyles("interior")[2].id;
    model.overrides.a = other;
    expect(effectiveStyleId(model, items[0])).toBe(other);
    expect(effectiveStyleId(model, items[1])).toBe(model.styleBySpace.interior);
    expect(model.styleBySpace.interior).not.toBe(other);
  });

  it("renders overrides in one reachable section with Customize wording", () => {
    const html = designStepHtml({ items, model: newDesignModel() });
    expect(html).toContain("Customize Individual Photos");
    expect(html).toContain(">Customize<");
    expect(html).not.toContain(">Change<");
  });

  it("labels inherited and overridden photos in plain words", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    model.overrides.a = compatibleStyles("interior")[2].id;
    const html = designStepHtml({ items, model });
    expect(html).toContain("Uses Interior Style:");
    expect(html).toContain("Custom Style:");
  });
});

describe("next: review gating", () => {
  it("stays disabled until every category has a style", () => {
    const model = newDesignModel();
    expect(designStepHtml({ items, model })).toContain('id="rddNext" disabled');
    model.styleBySpace.interior = interiorId();
    expect(designStepHtml({ items, model })).toContain('id="rddNext" disabled');
    model.styleBySpace.exterior = exteriorId();
    const done = designStepHtml({ items, model });
    expect(done).not.toContain('id="rddNext" disabled');
    expect(designBlockers(items, model)).toEqual([]);
  });

  it("explains precisely what is missing", () => {
    const model = newDesignModel();
    expect(designBlockerSummary(items, model)).toBe(
      "Choose styles for Interior and Exterior photos.",
    );
    model.styleBySpace.interior = interiorId();
    expect(designBlockerSummary(items, model)).toBe("Choose a style for 1 Exterior photo.");
    model.styleBySpace.exterior = exteriorId();
    expect(designBlockerSummary(items, model)).toBeNull();
  });

  it("never generates or charges from the Design page", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    model.styleBySpace.exterior = exteriorId();
    const html = designStepHtml({ items, model });
    expect(html).toContain("Next: Review");
    expect(html).not.toContain("Generate ");
    expect(html).toContain("at Review");
  });

  it("keeps suppressed features such as Budget out of the page", () => {
    const model = newDesignModel();
    model.styleBySpace.interior = interiorId();
    expect(designStepHtml({ items, model })).not.toMatch(/budget/i);
  });
});
