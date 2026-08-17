import { describe, expect, it } from "vitest";
import { assignKind, filterMedia, propertyBuckets, propertyOptions } from "@/lib/media-view";

const items = [
  { id: "a", refId: "u1", type: "uploaded_image", status: "ready", title: "Front", propertyId: "p1", property: "12 Oak" },
  { id: "b", refId: "v1", type: "generated_video", status: "draft", title: "Tour", propertyId: "p1", property: "12 Oak" },
  { id: "c", refId: "u2", type: "uploaded_image", status: "ready", title: "Loose Shot", propertyId: null, property: null },
  { id: "d", refId: "x1", type: "generated_image", status: "archived", title: "Old", propertyId: "p1", property: "12 Oak" },
];

describe("media view model", () => {
  it("maps records to the canonical row that owns the property link", () => {
    expect(assignKind(items[0])).toBe("upload");
    expect(assignKind(items[1])).toBe("video");
    expect(assignKind(items[3])).toBeNull();
    expect(assignKind({ type: "uploaded_image", job: {} })).toBeNull();
  });

  it("counts properties and the unassigned bucket without archived rows", () => {
    const { properties, unassigned } = propertyOptions(items, [{ id: "p1", address: "12 Oak" }]);
    expect(properties).toEqual([{ id: "p1", label: "12 Oak", count: 2 }]);
    expect(unassigned).toBe(1);
  });

  it("filters by property, including unassigned", () => {
    expect(filterMedia(items, { property: "p1" }).map((m) => m.id)).toEqual(["a", "b"]);
    expect(filterMedia(items, { property: "none" }).map((m) => m.id)).toEqual(["c"]);
    expect(filterMedia(items, {}).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("buckets one property's work by tab", () => {
    const b = propertyBuckets(items, "p1");
    expect(b.photos.map((m) => m.id)).toEqual(["a"]);
    expect(b.videos.map((m) => m.id)).toEqual(["b"]);
    expect(b.drafts.map((m) => m.id)).toEqual(["b"]);
    expect(propertyBuckets(items, null).all.map((m: any) => m.id)).toEqual(["c"]);
  });
});
