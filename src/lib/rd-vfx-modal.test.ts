import { describe, expect, it } from "vitest";
import {
  applyAllPlan, effectTiles, fxCats, fxDirty, fxRestore, fxSnap, intensityWord,
  lookCats, looksForCat, needsDisclosure, sceneEffectCredits, supportsIntensity,
} from "@/lib/rd-vfx-modal";

const scene = (o: any = {}) => ({ look: null, look_amount: null, vfx: "none", vfx_gen: null, disclosure: null, ...o });

describe("effects modal view model", () => {
  it("only lists categories that hold options, All first", () => {
    expect(lookCats()[0]).toEqual(["all", "All"]);
    expect(fxCats()[0]).toEqual(["all", "All"]);
    expect(fxCats().map(([id]) => id)).toContain("exterior");
    expect(fxCats().find(([id]) => id === "exterior")?.[1]).toBe("Exterior");
    lookCats().slice(1).forEach(([id]) => expect(looksForCat(id).length).toBeGreaterThan(0));
    fxCats().slice(1).forEach(([id]) => expect(effectTiles(id).length).toBeGreaterThan(0));
  });

  it("keeps None out of the effects grid but keeps stored ids intact", () => {
    expect(effectTiles("all").some((t) => t.id === "none")).toBe(false);
    expect(effectTiles("interior").map((t) => t.id)).toContain("virtual_staging");
  });

  it("snapshots and restores a scene so Cancel is lossless", () => {
    const s = scene({ look: "punch", look_amount: 70 });
    const snap = fxSnap(s);
    expect(fxDirty(s, snap)).toBe(false);
    s.look = "goldenhour";
    s.vfx = "virtual_staging";
    expect(fxDirty(s, snap)).toBe(true);
    fxRestore(s, snap);
    expect(s.look).toBe("punch");
    expect(s.vfx).toBe("none");
    expect(fxDirty(s, snap)).toBe(false);
  });

  it("shows intensity only for graded scenes and disclosure only for generated ones", () => {
    expect(supportsIntensity(scene({ look: "punch" }))).toBe(true);
    expect(supportsIntensity(scene())).toBe(false);
    expect(needsDisclosure(scene({ vfx: "virtual_staging", vfx_gen: "virtual_staging" }))).toBe(true);
    expect(needsDisclosure(scene({ look: "punch" }))).toBe(false);
  });

  it("prices paid effects per scene and only bills scenes that change", () => {
    const src = scene({ vfx: "virtual_staging", vfx_gen: "virtual_staging" });
    expect(sceneEffectCredits(src)).toBe(6);
    expect(sceneEffectCredits(scene({ look: "punch" }))).toBe(0);

    const scenes = [src, scene(), scene()];
    expect(applyAllPlan(scenes, src)).toMatchObject({ total: 3, targets: 2, perScene: 6, credits: 12 });

    const partly = [src, scene({ vfx: "virtual_staging", vfx_gen: "virtual_staging" }), scene()];
    expect(applyAllPlan(partly, src).credits).toBe(6);

    const free = scene({ look: "punch" });
    expect(applyAllPlan([free, scene()], free).credits).toBe(0);
  });

  it("names intensity steps", () => {
    expect(intensityWord(35)).toBe("Subtle");
    expect(intensityWord(70)).toBe("Balanced");
    expect(intensityWord(100)).toBe("Strong");
  });
});
