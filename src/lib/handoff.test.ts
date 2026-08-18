import { beforeEach, describe, expect, it } from "vitest";

import { clearHandoff, consumeHandoff, makeHandoff, peekHandoff, setHandoff } from "./handoff";

beforeEach(() => clearHandoff());

describe("makeHandoff", () => {
  it("drops transient blob urls", () => {
    const h = makeHandoff({
      target: "design",
      assets: [{ path: "blob:http://x/1" }, { path: "u/1.jpg" }],
    });
    expect(h?.assets.map((a) => a.path)).toEqual(["u/1.jpg"]);
  });
  it("refuses an empty payload", () => {
    expect(makeHandoff({ target: "design", assets: [] })).toBeNull();
  });
  it("accepts a draft resume with no assets", () => {
    expect(makeHandoff({ target: "video", draftId: "d1" })?.draftId).toBe("d1");
  });
  it("carries property context", () => {
    const h = makeHandoff({
      target: "design",
      origin: "property",
      propertyId: "p1",
      propertyAddress: "12 Oak St",
      assets: [{ path: "u/1.jpg", room: "Kitchen" }],
    });
    expect(h?.propertyId).toBe("p1");
    expect(h?.assets[0]?.room).toBe("Kitchen");
  });
});

describe("consumeHandoff", () => {
  it("only fires once", () => {
    setHandoff({ target: "design", assets: [{ path: "u/1.jpg" }] });
    expect(consumeHandoff("design")?.assets.length).toBe(1);
    expect(consumeHandoff("design")).toBeNull();
  });
  it("ignores a handoff meant for the other builder", () => {
    setHandoff({ target: "video", assets: [{ path: "u/1.jpg" }] });
    expect(peekHandoff("design")).toBeNull();
    expect(peekHandoff("video")).not.toBeNull();
  });
});

describe("batch launches", () => {
  it("carries the batched property and its rooms", () => {
    const h = setHandoff({
      target: "video",
      origin: "batch",
      propertyId: "p9",
      propertyAddress: "44 Pine Ave",
      assets: [
        { path: "u/a.jpg", room: "Kitchen", id: "r1" },
        { path: "u/b.jpg", room: "Living Room", id: "r2" },
      ],
    });
    expect(h?.origin).toBe("batch");
    expect(h?.propertyAddress).toBe("44 Pine Ave");
    expect(h?.assets.map((a) => a.id)).toEqual(["r1", "r2"]);
  });
});
