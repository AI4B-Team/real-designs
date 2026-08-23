// @vitest-environment jsdom
/**
 * Design step: selection truth, category isolation and footer behaviour.
 *
 * These tests exist because a decorative checkmark once made every style look
 * selected. Selection state is asserted from the rendered markup, so visual
 * state and model state can never drift apart again.
 */
import { assertDesignState, readDesignSelection } from "@/lib/staging-design";
import { describe, expect, it } from "vitest";
/* The staging model is plain JS by design; tests treat it structurally. */
import { designStepHtml, quickCards, reviewStepHtml } from "@/lib/staging-design-ui";
import {
  categoryStatus,
  clearCategoryStyle,
  designBlockerSummary,
  designBlockers,
  effectiveStyleId,
  newDesignModel,
} from "@/lib/staging-design";
import { compatibleStyles, hasCustomization, photoNote } from "@/lib/staging-design";

const items = [
  { key: "a", room: "Kitchen", selected: true },
  { key: "b", room: "Kitchen", selected: true },
  { key: "c", room: "Bedroom", selected: true },
  { key: "d", room: "Front Exterior", selected: true },
];

type Style = { id: string; displayName: string };
type Model = ReturnType<typeof newDesignModel> & {
  styleBySpace: { interior?: string; exterior?: string };
  overrides: { a?: string };
};
const model0 = () => newDesignModel() as Model;
const pool = (space: string) => compatibleStyles(space) as Style[];
const pick = (space: string, i: number) => pool(space)[i] as Style;
const interiorId = () => pick("interior", 0).id;
const exteriorId = () => pick("exterior", 0).id;

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("design step selection state", () => {
  it("shows no selected card when the model holds no style id", () => {
    const html = designStepHtml({ items, model: model0() });
    expect(count(html, "rdd-card-ck")).toBe(0);
    expect(count(html, 'aria-selected="true"')).toBe(0);
    expect(html).toContain('aria-selected="false"');
  });

  it("marks exactly one card selected per category", () => {
    const model = model0();
    model.styleBySpace.interior = interiorId();
    const html = designStepHtml({ items, model });
    expect(count(html, "rdd-card-ck")).toBe(1);
    expect(count(html, 'aria-selected="true"')).toBe(1);
  });

  it("replaces the previous selection instead of adding one", () => {
    const model = model0();
    model.styleBySpace.interior = pick("interior", 0).id;
    model.styleBySpace.interior = pick("interior", 1).id;
    expect(model.styleBySpace.interior).toBe(pick("interior", 1).id);
    expect(count(designStepHtml({ items, model }), 'aria-selected="true"')).toBe(1);
  });

  it("never offers an interior style to exterior photos", () => {
    const ids = quickCards("exterior", "").map((s) => s.id);
    const interiorOnly = pool("interior")
      .map((s) => s.id)
      .filter((id) => !pool("exterior").some((e) => e.id === id));
    interiorOnly.forEach((id) => expect(ids).not.toContain(id));
  });

  it("never applies an interior selection to an exterior photo", () => {
    const model = model0();
    model.styleBySpace.interior = interiorId();
    expect(effectiveStyleId(model, items[3])).toBe("");
  });
});

describe("categories and layout", () => {
  it("renders one section per present category with its applies-to summary", () => {
    const html = designStepHtml({ items, model: model0() });
    expect(html).toContain('data-space="interior"');
    expect(html).toContain('data-space="exterior"');
    expect(html).toContain("Kitchen &times;2");
    expect(html).toContain("Front Exterior &times;1");
  });

  it("shows compact completion status for every category", () => {
    const cats = categoryStatus(items, model0());
    expect(cats.map((c) => c.label)).toEqual(["Interior", "Exterior"]);
    expect(cats.every((c) => !c.complete)).toBe(true);
    const html = designStepHtml({ items, model: model0() });
    expect(count(html, "Style Needed")).toBe(2);
  });

  it("keeps long style names readable rather than cutting them out of markup", () => {
    const html = designStepHtml({ items, model: model0() });
    const long = pool("interior").find((s) => s.displayName.length > 14);
    if (long && quickCards("interior", "").some((s) => s.id === long.id)) {
      expect(html).toContain(long.displayName);
      expect(html).toContain(`title="${long.displayName}"`);
    }
  });

  it("gives every card the same structure, so heights match", () => {
    const html = designStepHtml({ items, model: model0() });
    expect(count(html, "rdd-card-th")).toBe(count(html, "rdd-card-t\">"));
  });

  it("uses one scroll region and a permanently visible footer", () => {
    const html = designStepHtml({ items, model: model0() });
    expect(count(html, "rdd-scroll")).toBe(1);
    expect(html).toContain("rdd-foot");
    expect(html.indexOf("rdd-foot")).toBeGreaterThan(html.indexOf("rdd-ovr"));
  });

  it("does not repeat the page title inside the content", () => {
    expect(designStepHtml({ items, model: model0() })).not.toContain(
      "Choose a Design Style",
    );
  });
});

describe("clearing and overrides", () => {
  it("clears only its own category", () => {
    const model = model0();
    model.styleBySpace.interior = interiorId();
    model.styleBySpace.exterior = exteriorId();
    const next = clearCategoryStyle(model, "interior");
    expect(next.styleBySpace.interior).toBeUndefined();
    expect(next.styleBySpace.exterior).toBe(model.styleBySpace.exterior);
  });

  it("offers Clear Selection only after a style is chosen", () => {
    const empty = designStepHtml({ items, model: model0() });
    expect(empty).not.toContain("Clear Selection");
    const model = model0();
    model.styleBySpace.interior = interiorId();
    expect(count(designStepHtml({ items, model }), "Clear Selection")).toBe(1);
  });

  it("keeps individual overrides from touching other photos", () => {
    const model = model0();
    model.styleBySpace.interior = interiorId();
    const other = pick("interior", 2).id;
    model.overrides.a = other;
    expect(effectiveStyleId(model, items[0])).toBe(other);
    expect(effectiveStyleId(model, items[1])).toBe(model.styleBySpace.interior);
    expect(model.styleBySpace.interior).not.toBe(other);
  });

  it("renders overrides in one reachable section with Customize wording", () => {
    const html = designStepHtml({ items, model: model0() });
    expect(html).toContain("Customize Individual Photos");
    expect(html).toContain(">Customize<");
    expect(html).not.toContain(">Change<");
  });

  it("labels inherited and overridden photos in plain words", () => {
    const model = model0();
    model.styleBySpace.interior = interiorId();
    model.overrides.a = pick("interior", 2).id;
    const html = designStepHtml({ items, model });
    expect(html).toContain("Uses Interior Style:");
    expect(html).toContain("Custom Style:");
  });
});

describe("next: review gating", () => {
  it("stays disabled until every category has a style", () => {
    const model = model0();
    expect(designStepHtml({ items, model })).toContain('id="rddNext" disabled');
    model.styleBySpace.interior = interiorId();
    expect(designStepHtml({ items, model })).toContain('id="rddNext" disabled');
    model.styleBySpace.exterior = exteriorId();
    const done = designStepHtml({ items, model });
    expect(done).not.toContain('id="rddNext" disabled');
    expect(designBlockers(items, model)).toEqual([]);
  });

  it("explains precisely what is missing", () => {
    const model = model0();
    expect(designBlockerSummary(items, model)).toBe(
      "Choose styles for Interior and Exterior photos.",
    );
    model.styleBySpace.interior = interiorId();
    expect(designBlockerSummary(items, model)).toBe("Choose a style for 1 Exterior photo.");
    model.styleBySpace.exterior = exteriorId();
    expect(designBlockerSummary(items, model)).toBeNull();
  });

  it("never generates or charges from the Design page", () => {
    const model = model0();
    model.styleBySpace.interior = interiorId();
    model.styleBySpace.exterior = exteriorId();
    const html = designStepHtml({ items, model });
    expect(html).toContain("Next: Review");
    expect(html).not.toContain("Generate ");
    expect(html).toContain("at Review");
  });

  it("keeps suppressed features such as Budget out of the page", () => {
    const model = model0();
    model.styleBySpace.interior = interiorId();
    expect(designStepHtml({ items, model })).not.toMatch(/budget/i);
  });
});

describe("design option cards", () => {
  const model = { direction: "makeover", grade: "standard", styleBySpace: {}, overrides: {} };
  const html = () =>
    designStepHtml({ items: [{ key: "a", room: "Kitchen", selected: true }], model });

  it("renders every direction and grade as a selectable card", () => {
    const h = html();
    expect((h.match(/design-option-card/g) || []).length).toBeGreaterThanOrEqual(8);
    expect(h).toContain('role="radio"');
    expect(h).toContain("Recommended");
    expect(h).toContain("Most Popular");
  });

  it("marks exactly one card per group as checked", () => {
    const doc = document.createElement("div");
    doc.innerHTML = html();
    const on = (sel: string) => doc.querySelectorAll(`${sel}[aria-checked="true"]`).length;
    expect(on("[data-dir]")).toBe(1);
    expect(on("[data-grade]")).toBe(1);
    expect(doc.querySelector('[data-dir][aria-checked="true"]')!.getAttribute("data-dir")).toBe(
      "makeover",
    );
  });

  it("reads the rendered selection back as the canonical draft values", () => {
    const doc = document.createElement("div");
    doc.innerHTML = html();
    expect(readDesignSelection(doc)).toMatchObject({ direction: "makeover", grade: "standard" });
    expect(assertDesignState("test", model, readDesignSelection(doc))).toBe(true);
  });
});

/**
 * Per-photo instructions used to be a promise with no input and no readout:
 * the model field was sent to generation while the UI never collected it and
 * Review never showed it. These tests hold the round trip together.
 */
describe("per-photo instructions", () => {
  const model = newDesignModel();
  model.styleBySpace = { interior: "modern", exterior: "modern" };
  model.notesByPhoto = { b: "Leave the fireplace exactly as it is." };

  it("offers an instruction field for every photo on the Design step", () => {
    const doc = document.createElement("div");
    doc.innerHTML = designStepHtml({ items, model });
    const fields = doc.querySelectorAll("[data-photonote]");
    expect(fields.length).toBe(items.length);
    const own = doc.querySelector('[data-photonote="b"]') as HTMLTextAreaElement;
    expect(own.value).toBe("Leave the fireplace exactly as it is.");
  });

  it("shows the instruction on Review so nobody pays for unseen input", () => {
    const doc = document.createElement("div");
    doc.innerHTML = reviewStepHtml({ items, model, plan: "pro", balance: 40 });
    expect(doc.textContent).toContain("Leave the fireplace exactly as it is.");
    expect(doc.querySelectorAll(".rdd-rnote").length).toBe(1);
  });

  it("counts a note-only photo as a customization", () => {
    expect(hasCustomization(model, { key: "b" })).toBe(true);
    expect(hasCustomization(model, { key: "a" })).toBe(false);
    expect(photoNote(model, { key: "b" })).toBe("Leave the fireplace exactly as it is.");
  });
});
