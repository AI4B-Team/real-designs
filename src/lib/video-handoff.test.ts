import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeVideoAssets,
  publishVideoHandoff,
  peekVideoHandoff,
  consumeVideoHandoff,
  clearVideoHandoff,
  videoBuilderSeed,
  startVideoFromCanvas,
} from "./video-handoff";

beforeEach(() => clearVideoHandoff());

describe("normalizeVideoAssets", () => {
  it("accepts media rows, versions and property photos", () => {
    const out = normalizeVideoAssets([
      { id: "m1", storage_path: "a/1.jpg", title: "Kitchen", room_group: "Kitchen" },
      { version_id: "v1", path: "a/2.jpg", name: "Living" },
      { path: "a/3.jpg", property_id: "p1" },
    ]);
    expect(out.map((a) => a.storagePath)).toEqual(["a/1.jpg", "a/2.jpg", "a/3.jpg"]);
    expect(out[1]!.sourceType).toBe("generated-version");
    expect(out[2]!.propertyId).toBe("p1");
    expect(out.map((a) => a.sortOrder)).toEqual([0, 1, 2]);
  });

  it("drops blob urls and duplicates", () => {
    const out = normalizeVideoAssets([
      { path: "blob:x" },
      { path: "a/1.jpg" },
      { path: "a/1.jpg" },
      {},
    ]);
    expect(out).toHaveLength(1);
  });
});

describe("handoff persistence", () => {
  it("publishes, peeks and consumes once", () => {
    const h = publishVideoHandoff({ origin: "media", assets: [{ path: "a/1.jpg" }] });
    expect(h?.assets).toHaveLength(1);
    expect(peekVideoHandoff()?.handoffId).toBe(h!.handoffId);
    expect(consumeVideoHandoff()?.handoffId).toBe(h!.handoffId);
    expect(peekVideoHandoff()).toBeNull();
  });

  it("refuses an empty selection", () => {
    expect(publishVideoHandoff({ origin: "media", assets: [{ path: "blob:x" }] })).toBeNull();
  });

  it("seeds the builder with assets and property", () => {
    const h = publishVideoHandoff({
      origin: "property",
      propertyId: "p1",
      propertyAddress: "12 Main St",
      assets: [{ path: "a/1.jpg" }],
    })!;
    const seed = videoBuilderSeed(h, { duration: 8 });
    expect(seed.assets).toHaveLength(1);
    expect(seed.propertyId).toBe("p1");
    expect(seed.propertyAddress).toBe("12 Main St");
    expect((seed as Record<string, any>)["duration"]).toBe(8);
  });

  it("rejects an unsaved canvas result", () => {
    expect(startVideoFromCanvas({ path: "blob:abc" }).ok).toBe(false);
    expect(startVideoFromCanvas({ path: "" }).ok).toBe(false);
    const r = startVideoFromCanvas({ path: "a/1.jpg", room: "Kitchen" });
    expect(r.ok).toBe(true);
  });
});
