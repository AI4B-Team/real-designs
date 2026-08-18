/* Regression: a saved video project with eight selected scenes from mixed
   sources must render eight cards, never "8 of 0 selected". */
import { describe, expect, it } from "vitest";
import { adoptSavedScenes } from "./scene-adopt";
import { reconcileScenes } from "./scene-dedupe";

const savedScene = (i: number, extra: Record<string, any> = {}) => ({
  key: `scene-${i}`,
  path: `photos/p${i}.jpg`,
  room: i % 3 === 0 ? "" : "Kitchen",
  kind: "Original",
  scene_type: "original",
  ...extra,
});

describe("adoptSavedScenes", () => {
  it("hydrates eight saved scenes from mixed sources into eight grid cards", () => {
    const w: any = {
      /* Only two of the eight photos are still exposed by the live loaders. */
      available: [
        { key: "m-1", path: "photos/p1.jpg", room: "Kitchen" },
        { key: "u-2", path: "photos/p2.jpg", room: "Unsorted" },
      ],
      gridOrder: ["m-1", "u-2"],
      scenes: [
        savedScene(1),
        savedScene(2),
        savedScene(3, { kind: "Design", scene_type: "design", compare: "photos/b3.jpg" }),
        savedScene(4, { room: "Zen Nook" }),
        savedScene(5, { room: "" }),
        savedScene(6),
        savedScene(7, { path: "" }),
        savedScene(8),
      ],
    };
    adoptSavedScenes(w);

    const ordered = w.gridOrder.map((k: string) => w.available.find((a: any) => a.key === k));
    expect(ordered.filter(Boolean)).toHaveLength(8);

    const selectedKeys = new Set(w.scenes.map((s: any) => s.key));
    const selectedCount = ordered.filter((a: any) => selectedKeys.has(a.key)).length;
    expect(`${selectedCount} of ${ordered.length} selected`).toBe("8 of 8 selected");

    /* Existing assets adopt the saved identity instead of duplicating a card. */
    expect(new Set(w.gridOrder).size).toBe(8);
    expect(w.available.find((a: any) => a.path === "photos/p1.jpg").key).toBe("scene-1");
    /* A scene with no preview still renders. */
    expect(w.available.some((a: any) => a.key === "scene-7")).toBe(true);
    /* A missing or custom room type never removes a card. */
    expect(w.available.find((a: any) => a.key === "scene-4").room).toBe("Zen Nook");
    expect(w.available.find((a: any) => a.key === "scene-5").room).toBe("Unsorted");
  });

  it("keeps every scene after reconciliation, so counts share one array", () => {
    const w: any = { available: [], gridOrder: [], scenes: [savedScene(1), savedScene(2)] };
    adoptSavedScenes(w);
    const scenes = reconcileScenes(w.scenes, w.available, w.gridOrder);
    expect(scenes).toHaveLength(2);
    expect(w.available).toHaveLength(2);
  });

  it("is idempotent across re-hydration", () => {
    const w: any = { available: [], gridOrder: [], scenes: [savedScene(1)] };
    adoptSavedScenes(w);
    adoptSavedScenes(w);
    expect(w.available).toHaveLength(1);
    expect(w.gridOrder).toEqual(["scene-1"]);
  });
});
