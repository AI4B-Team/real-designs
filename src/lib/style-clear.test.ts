import { describe, expect, it } from "vitest";

import {
  applyClear,
  clearPlan,
  generateBlockReason,
  styleHeaderActions,
  undoClear,
  CHOOSE_STYLE_SUMMARY,
  CLEAR_A11Y,
  NARROW_INSPECTOR_PX,
} from "@/lib/style-clear";
import {
  emptyStore,
  resolveDirection,
  setDirection,
  type DirectionContext,
} from "@/lib/canvas-style";

const ctx: DirectionContext = {
  need: "design",
  draftId: "d1",
  photoKey: "p1",
  propertyId: "prop1",
};


describe("design style header actions", () => {
  it("hides Clear until a style is selected", () => {
    const none = styleHeaderActions({ selected: false, scopeLabel: null, width: 420 });
    expect(none.inline.map((a) => a.id)).toEqual(["browse"]);
    expect(none.overflow).toHaveLength(0);
  });

  it("orders Clear, View All then the scope control", () => {
    const l = styleHeaderActions({ selected: true, scopeLabel: "This Photo", width: 420 });
    expect(l.inline.map((a) => a.id)).toEqual(["clear", "browse", "scope"]);
    expect(l.inline[2]!.label).toBe("This Photo");
  });

  it("keeps View All more prominent than Clear", () => {
    const l = styleHeaderActions({ selected: true, scopeLabel: "This Photo", width: 420 });
    expect(l.inline.find((a) => a.id === "clear")!.prominence).toBe("secondary");
    expect(l.inline.find((a) => a.id === "browse")!.prominence).toBe("primary");
  });

  it("moves Clear into the overflow menu on a narrow inspector", () => {
    const l = styleHeaderActions({
      selected: true,
      scopeLabel: "This Photo",
      width: NARROW_INSPECTOR_PX - 20,
    });
    expect(l.inline.map((a) => a.id)).toEqual(["browse", "scope"]);
    expect(l.overflow.map((a) => a.id)).toEqual(["clear"]);
  });

  it("exposes the accessible label and the empty summary copy", () => {
    expect(CLEAR_A11Y).toBe("Remove selected design style.");
    expect(CHOOSE_STYLE_SUMMARY).toBe("Choose a Design Style");
  });
});

describe("clear scope behaviour", () => {
  it("clears only the active photo when the scope is This Photo", () => {
    let store = setDirection(emptyStore(), "photo", ctx, "modern");
    const other: DirectionContext = { ...ctx, photoKey: "p2" };
    store = setDirection(store, "photo", other, "coastal");

    const sel = resolveDirection(store, ctx)!;
    expect(sel.scope).toBe("photo");
    const res = applyClear(store, sel, ctx);

    expect(resolveDirection(res.store, ctx)).toBeNull();
    expect(resolveDirection(res.store, other)!.styleId).toBe("coastal");
  });

  it("clears only the group when a project scope is active", () => {
    let store = setDirection(emptyStore(), "project", ctx, "modern");
    store = setDirection(store, "property", ctx, "coastal");
    const sel = resolveDirection(store, ctx)!;
    expect(sel.scope).toBe("project");

    const res = applyClear(store, sel, ctx);
    /* The property direction underneath is untouched. */
    expect(resolveDirection(res.store, ctx)!.scope).toBe("property");
  });

  it("asks for confirmation before clearing a shared scope", () => {
    const store = setDirection(emptyStore(), "project", ctx, "modern");
    const sel = resolveDirection(store, ctx)!;
    expect(clearPlan(sel, { otherPhotoCount: 3 })!.needsConfirm).toBe(true);
    expect(clearPlan(sel, { otherPhotoCount: 0 })!.needsConfirm).toBe(false);
  });

  it("never asks for confirmation for a photo-scoped clear", () => {
    const store = setDirection(emptyStore(), "photo", ctx, "modern");
    const sel = resolveDirection(store, ctx)!;
    expect(clearPlan(sel, { otherPhotoCount: 5 })!.needsConfirm).toBe(false);
  });

  it("touches nothing outside the direction store", () => {
    const store = setDirection(emptyStore(), "photo", ctx, "modern");
    const sel = resolveDirection(store, ctx)!;
    const res = applyClear(store, sel, ctx);
    expect(Object.keys(res.store).sort()).toEqual(["photo", "project", "property"]);
  });
});

describe("after clearing", () => {
  it("blocks Generate with an explanation and allows it again once chosen", () => {
    expect(generateBlockReason(null)).toMatch(/Choose a Design Style/);
    expect(generateBlockReason({ styleId: "modern", scope: "photo" })).toBeNull();
  });

  it("undo restores the previous style at the same scope", () => {
    const store = setDirection(emptyStore(), "project", ctx, "modern");
    const sel = resolveDirection(store, ctx)!;
    const res = applyClear(store, sel, ctx);
    const back = resolveDirection(undoClear(res.store, res.undo), ctx)!;
    expect(back.styleId).toBe("modern");
    expect(back.scope).toBe("project");
  });

  it("preserves the cleared state until undo runs", () => {
    const store = setDirection(emptyStore(), "photo", ctx, "modern");
    const sel = resolveDirection(store, ctx)!;
    const res = applyClear(store, sel, ctx);
    expect(resolveDirection(res.store, ctx)).toBeNull();
    expect(resolveDirection(res.store, ctx)).toBeNull();
  });
});
