import { describe, expect, it } from "vitest";
import {
  dedupeScenes,
  mergeScenes,
  reconcileScenes,
  selectAllIds,
  toggleId,
  uniqueIds,
} from "./scene-dedupe";

const scene = (key: string, extra: Record<string, any> = {}): Record<string, any> => ({
  key,
  room: "Kitchen",
  duration: 3,
  ...extra,
});
const grid = ["u-1", "u-2", "u-3", "u-4", "u-5", "u-6", "u-7", "u-8"];
const available = grid.map((key) => ({ key }));
const eight = grid.map((k) => scene(k));

describe("scene identity and dedupe", () => {
  it("drops duplicate incoming asset ids", () => {
    expect(uniqueIds(["a", "b", "a", null, "b"])).toEqual(["a", "b"]);
  });

  it("keeps the first scene and its settings", () => {
    const out = dedupeScenes([
      scene("u-1", { caption: "Kept", motion: "pan" }),
      scene("u-1", { caption: "Dropped" }),
      scene("u-2"),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!["caption"]).toBe("Kept");
    expect(out[0]!["motion"]).toBe("pan");
  });

  it("prefers the database asset id over the grid key", () => {
    const out = dedupeScenes([scene("m-a", { asset_id: "A" }), scene("row-1", { asset_id: "A" })]);
    expect(out).toHaveLength(1);
  });

  it("allows a deliberately duplicated scene with its own role", () => {
    const out = dedupeScenes([
      scene("m-a", { asset_id: "A" }),
      scene("m-a", { asset_id: "A", scene_role: "dup-1" }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("ingestion boundaries", () => {
  it("merging the same eight photos twice keeps eight scenes", () => {
    expect(mergeScenes(eight, eight)).toHaveLength(8);
  });

  it("double submission adds nothing the second time", () => {
    const incoming = [scene("u-9")];
    const once = mergeScenes(eight, incoming);
    const twice = mergeScenes(once, incoming);
    expect(once).toHaveLength(9);
    expect(twice).toHaveLength(9);
  });

  it("a repeated Strict Mode effect is idempotent", () => {
    let scenes: any[] = [];
    const init = () => {
      scenes = mergeScenes(scenes, eight);
    };
    init();
    init();
    expect(scenes).toHaveLength(8);
  });

  it("adding one new photo yields nine, not sixteen", () => {
    const out = mergeScenes(mergeScenes(eight, eight), [scene("u-9")]);
    expect(out).toHaveLength(9);
  });
});

describe("draft rehydration", () => {
  it("drops scenes whose asset is gone from the grid", () => {
    const stale = eight.concat([scene("u-dead-1"), scene("u-dead-2")]);
    expect(reconcileScenes(stale, available, grid)).toHaveLength(8);
  });

  it("keeps database-keyed scenes while assets are still loading", () => {
    const fromDb = [scene("6f0f1f2e-0000-4000-8000-000000000001", { asset_id: "A" })];
    expect(reconcileScenes(fromDb, [], [])).toHaveLength(1);
    expect(reconcileScenes(fromDb, available, grid)).toHaveLength(1);
  });

  it("reopening an existing project does not double the scenes", () => {
    const hydrated = reconcileScenes(mergeScenes(eight, eight), available, grid);
    expect(hydrated).toHaveLength(8);
    expect(hydrated.map((s) => s["key"])).toEqual(grid);
  });

  it("orders by the grid and preserves settings", () => {
    const shuffled = [scene("u-3", { caption: "C" }), scene("u-1"), scene("u-2")];
    const out = reconcileScenes(shuffled, available, grid);
    expect(out.map((s) => s["key"])).toEqual(["u-1", "u-2", "u-3"]);
    expect(out[2]!["caption"]).toBe("C");
  });
});

describe("selection", () => {
  it("toggles an already selected id off without duplicating", () => {
    const sel = selectAllIds(grid);
    const off = toggleId(sel, "u-3");
    expect(off.has("u-3")).toBe(false);
    expect(toggleId(off, "u-3").size).toBe(8);
  });

  it("Select All replaces an existing selection instead of appending", () => {
    const sel = selectAllIds(["u-1", "u-1", "u-2"]);
    expect([...selectAllIds([...sel, ...grid])]).toHaveLength(8);
  });
});
