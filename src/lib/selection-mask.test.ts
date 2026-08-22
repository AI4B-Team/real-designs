import { describe, expect, it } from "vitest";
import {
  MAX_STROKES,
  boxSentence,
  buildRegions,
  clampStroke,
  clearStrokes,
  emptyMask,
  growMask,
  invertMask,
  padBox,
  pushStroke,
  redoStroke,
  setFeather,
  strokeCoversBox,
  summarizeRegions,
  undoStroke,
  type SelectionIntent,
} from "@/lib/selection-mask";
import { strokeIntent as objectIntent, maskRegions as objectRegions, emptyMask as objectMask, pushStroke as objectPush } from "@/lib/object-edit-brief";
import { strokeIntent as declutterIntent, maskRegions as declutterRegions, emptyMask as declutterMask, pushStroke as declutterPush } from "@/lib/declutter-brief";
import { strokeIntent as materialsIntent, maskRegions as materialsRegions, emptyMask as materialsMask, pushStroke as materialsPush } from "@/lib/materials-brief";

type Kind = "include" | "exclude";
const intent = (k: Kind): SelectionIntent => k;
const dab = (x: number, y: number, kind: Kind = "include") => ({ x, y, r: 0.05, kind });

describe("stroke history", () => {
  it("clamps a dab into the frame and to a sane radius", () => {
    const s = clampStroke({ x: 2, y: -1, r: 9, kind: "include" });
    expect(s.x).toBe(1);
    expect(s.y).toBe(0);
    expect(s.r).toBe(0.4);
  });

  it("undoes and redoes, and a new dab clears the redo stack", () => {
    let m = pushStroke(pushStroke(emptyMask<Kind>(), dab(0.2, 0.2)), dab(0.4, 0.4));
    m = undoStroke(m);
    expect(m.strokes).toHaveLength(1);
    expect(m.redo).toHaveLength(1);
    m = redoStroke(m);
    expect(m.strokes).toHaveLength(2);
    m = pushStroke(undoStroke(m), dab(0.6, 0.6));
    expect(m.redo).toHaveLength(0);
    expect(clearStrokes(m).strokes).toHaveLength(0);
  });

  it("keeps history bounded", () => {
    let m = emptyMask<Kind>();
    for (let i = 0; i < MAX_STROKES + 40; i += 1) m = pushStroke(m, dab(0.5, 0.5));
    expect(m.strokes).toHaveLength(MAX_STROKES);
  });
});

describe("edge controls", () => {
  it("clamps grow and feather and toggles invert", () => {
    let m = growMask(emptyMask<Kind>(), 0.5);
    expect(m.grow).toBe(0.08);
    m = growMask(m, -1);
    expect(m.grow).toBe(-0.08);
    expect(setFeather(m, 9).feather).toBe(0.06);
    expect(invertMask(m).invert).toBe(true);
  });

  it("pads a box without leaving the frame", () => {
    const b = padBox({ x: 0.02, y: 0.02, w: 0.2, h: 0.2 }, 0.05);
    expect(b.x).toBe(0);
    expect(b.x + b.w).toBeLessThanOrEqual(1);
  });
});

describe("regions", () => {
  const target = { label: "Sofa", box: { x: 0.3, y: 0.4, w: 0.2, h: 0.2 } };
  const keep = { label: "Window", box: { x: 0.7, y: 0.1, w: 0.2, h: 0.3 } };

  it("expands the edit area and never the protected area", () => {
    const mask = growMask(emptyMask<Kind>(), 0.04);
    const r = buildRegions<Kind>({ selected: [target], protectedRegions: [keep], mask, intent });
    expect(r.edit[0]!.box.w).toBeCloseTo(0.28, 5);
    expect(r.protect[0]!.box).toEqual(keep.box);
    expect(r.hasEdit).toBe(true);
  });

  it("lets a protective stroke win over a selected target", () => {
    const mask = pushStroke(emptyMask<Kind>(), dab(0.4, 0.5, "exclude"));
    const r = buildRegions<Kind>({ selected: [target], protectedRegions: [], mask, intent });
    expect(r.edit).toHaveLength(0);
    expect(r.hasEdit).toBe(false);
  });

  it("counts a brushed area as a real selection with nothing detected", () => {
    const mask = pushStroke(emptyMask<Kind>(), dab(0.5, 0.5));
    const r = buildRegions<Kind>({ selected: [], protectedRegions: [], mask, intent });
    expect(r.hasEdit).toBe(true);
  });

  it("swaps edit and protect when inverted", () => {
    const mask = invertMask(emptyMask<Kind>());
    const r = buildRegions<Kind>({ selected: [target], protectedRegions: [keep], mask, intent });
    expect(r.edit[0]!.label).toBe("Window");
    expect(r.protect[0]!.label).toBe("Sofa");
  });

  it("summarizes a selection honestly", () => {
    const mask = pushStroke(growMask(emptyMask<Kind>(), 0.02), dab(0.1, 0.1));
    const r = buildRegions<Kind>({ selected: [target], protectedRegions: [keep], mask, intent });
    const text = summarizeRegions(r, mask, intent);
    expect(text).toMatch(/Sofa/);
    expect(text).toMatch(/1 brushed area/);
    expect(text).toMatch(/expanded edge/);
    expect(summarizeRegions(
      buildRegions<Kind>({ selected: [], protectedRegions: [], mask: emptyMask<Kind>(), intent }),
      emptyMask<Kind>(),
      intent,
    )).toBe("Nothing selected yet");
  });

  it("describes a box in plain coordinates", () => {
    expect(boxSentence({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toBe("10%,20% to 40%,60%");
    expect(strokeCoversBox(dab(0.4, 0.5), target.box)).toBe(true);
    expect(strokeCoversBox(dab(0.95, 0.95), target.box)).toBe(false);
  });
});

describe("one foundation, three vocabularies", () => {
  it("maps every tool's stroke names onto the same two intents", () => {
    expect(objectIntent("add")).toBe("include");
    expect(objectIntent("erase")).toBe("exclude");
    expect(objectIntent("protect")).toBe("exclude");
    expect(declutterIntent("remove")).toBe("include");
    expect(declutterIntent("keep")).toBe("exclude");
    expect(materialsIntent("include")).toBe("include");
    expect(materialsIntent("exclude")).toBe("exclude");
  });

  it("gives every tool the same protective-stroke behaviour", () => {
    const box = { x: 0.3, y: 0.3, w: 0.2, h: 0.2 };

    const obj = objectRegions(
      [{ id: "o1", label: "Lamp", box, selected: true, protectedItem: false, category: "decor", confidence: 0.9, architectural: false } as never],
      objectPush(objectMask(), { x: 0.4, y: 0.4, r: 0.05, kind: "protect" }),
    );
    expect(obj.edit).toHaveLength(0);

    const dec = declutterRegions(
      [{ id: "d1", label: "Boxes", box, decision: "remove", category: "clutter", confidence: 0.9, personal: false, protectedItem: false } as never],
      declutterPush(declutterMask(), { x: 0.4, y: 0.4, r: 0.05, kind: "keep" }),
    );
    expect(dec.remove).toHaveLength(0);
    expect(dec.hasRemoval).toBe(false);

    const mat = materialsRegions(
      { id: "s1", label: "Floor", box, kind: "flooring", current: "oak", confidence: 0.9, area: 0.3 } as never,
      [],
      materialsPush(materialsMask(), { x: 0.4, y: 0.4, r: 0.05, kind: "exclude" }),
    );
    expect(mat.target).toHaveLength(0);
    expect(mat.hasTarget).toBe(false);
  });

  it("gives every tool the same brush-only selection behaviour", () => {
    expect(objectRegions([], objectPush(objectMask(), { x: 0.5, y: 0.5, r: 0.05, kind: "add" })).strokes).toHaveLength(1);
    expect(declutterRegions([], declutterPush(declutterMask(), { x: 0.5, y: 0.5, r: 0.05, kind: "remove" })).hasRemoval).toBe(true);
    expect(materialsRegions(null, [], materialsPush(materialsMask(), { x: 0.5, y: 0.5, r: 0.05, kind: "include" })).hasTarget).toBe(true);
  });
});
