import { describe, expect, it } from "vitest";
import { STYLES } from "@/lib/style-catalog";
import {
  applyToPhotos,
  clearDirection,
  emptyStore,
  parseStore,
  photoDirectionKey,
  propertyDirection,
  resolveDirection,
  searchStyles,
  sectionTitle,
  setDirection,
  styleNeedForTool,
  stylesForNeed,
} from "@/lib/canvas-style";

const A = STYLES[0]!.id;
const B = STYLES[1]!.id;
const ctx = { need: "design" as const, draftId: "d1", photoKey: "p1", propertyId: "prop1" };

describe("styleNeedForTool", () => {
  it("requires a direction for Redesign and a staging style for Stage", () => {
    expect(styleNeedForTool("Redesign")).toBe("design");
    expect(styleNeedForTool("Virtual Stage")).toBe("stage");
    expect(sectionTitle("stage")).toBe("Staging Style");
  });
  it("needs nothing for utility tools", () => {
    ["Declutter", "Multi Angle", "Material Swap", ""].forEach((t) =>
      expect(styleNeedForTool(t)).toBeNull(),
    );
  });
});

describe("direction resolution", () => {
  it("returns null until something is chosen", () => {
    expect(resolveDirection(emptyStore(), ctx)).toBeNull();
  });
  it("prefers photo over project over property", () => {
    let s = setDirection(emptyStore(), "property", ctx, A);
    expect(resolveDirection(s, ctx)).toEqual({ styleId: A, scope: "property" });
    s = setDirection(s, "project", ctx, B);
    expect(resolveDirection(s, ctx)).toEqual({ styleId: B, scope: "project" });
    s = setDirection(s, "photo", ctx, A);
    expect(resolveDirection(s, ctx)).toEqual({ styleId: A, scope: "photo" });
  });
  it("keeps a photo override from leaking to other photos", () => {
    const s = setDirection(emptyStore(), "photo", ctx, A);
    expect(resolveDirection(s, { ...ctx, photoKey: "p2" })).toBeNull();
  });
  it("keeps design and staging selections separate", () => {
    const s = setDirection(emptyStore(), "photo", ctx, A);
    expect(resolveDirection(s, { ...ctx, need: "stage" })).toBeNull();
  });
  it("ignores ids the catalog no longer knows", () => {
    const s = setDirection(emptyStore(), "photo", ctx, "not-a-style");
    expect(resolveDirection(s, ctx)).toBeNull();
  });
  it("clears only the scope asked for", () => {
    let s = setDirection(setDirection(emptyStore(), "project", ctx, B), "photo", ctx, A);
    s = clearDirection(s, "photo", ctx);
    expect(resolveDirection(s, ctx)).toEqual({ styleId: B, scope: "project" });
  });
  it("exposes the property direction on its own", () => {
    const s = setDirection(emptyStore(), "property", ctx, A);
    expect(propertyDirection(s, ctx)).toBe(A);
    expect(propertyDirection(s, { ...ctx, propertyId: null })).toBe("");
  });
});

describe("apply to all", () => {
  it("writes an override for every listed photo only", () => {
    const s = applyToPhotos(emptyStore(), "design", "d1", ["p1", "p2"], A);
    expect(s.photo[photoDirectionKey("design", "d1", "p1")]).toBe(A);
    expect(s.photo[photoDirectionKey("design", "d1", "p2")]).toBe(A);
    expect(resolveDirection(s, { ...ctx, photoKey: "p3" })).toBeNull();
  });
});

describe("catalog helpers", () => {
  it("offers staging styles for the stage tool", () => {
    const list = stylesForNeed(STYLES, "stage", "interior");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.compatibleProjectTypes.includes("virtual-staging"))).toBe(true);
  });
  it("searches names and descriptions", () => {
    const list = stylesForNeed(STYLES, "design", "interior");
    const hit = searchStyles(list, list[0]!.displayName);
    expect(hit.some((s) => s.id === list[0]!.id)).toBe(true);
    expect(searchStyles(list, "zzzzz")).toHaveLength(0);
  });
  it("survives corrupt stored data", () => {
    expect(parseStore("nope")).toEqual(emptyStore());
    expect(parseStore({ photo: { k: 1 } }).photo).toEqual({});
  });
});
