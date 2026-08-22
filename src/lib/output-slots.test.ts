import { describe, expect, it } from "vitest";
import {
  createOutputSet,
  orderedSlots,
  markGenerating,
  markImage,
  markSaved,
  markFailed,
  setActive,
  activeSlot,
  activeSummary,
  statusLine,
  historyCount,
  slotLabel,
  slotAt,
  slotBadge,
  saveRoomState,
  persistableSlots,
} from "@/lib/output-slots";
import { resolveRoom } from "@/lib/concept-batch";

const two = () => createOutputSet({ count: 2, kind: "concept", roomType: "Kitchen" });

describe("output slots", () => {
  it("creates exactly two slots for two requested concepts", () => {
    const set = two();
    expect(set.slots).toHaveLength(2);
    expect(orderedSlots(set).map((s) => slotLabel(set, s))).toEqual(["Concept 1", "Concept 2"]);
    expect(set.slots[0]!.status).toBe("generating");
    expect(set.slots[1]!.status).toBe("queued");
  });

  it("keeps order 1 then 2 regardless of completion order", () => {
    const set = two();
    markImage(set, 1, "img-2");
    markSaved(set, 1, { path: "p2", versionId: "v2" });
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1", versionId: "v1" });
    expect(orderedSlots(set).map((s) => s.image)).toEqual(["img-1", "img-2"]);
    expect(orderedSlots(set).map((s) => s.outputIndex)).toEqual([0, 1]);
  });

  it("keeps canvas, selection and summary on the same active id", () => {
    const set = two();
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1" });
    markImage(set, 1, "img-2");
    markSaved(set, 1, { path: "p2" });
    expect(activeSlot(set)!.outputIndex).toBe(0);
    expect(activeSummary(set)).toBe("Concept 1 of 2");
    setActive(set, set.slots[1]!.outputId);
    expect(activeSlot(set)!.image).toBe("img-2");
    expect(activeSummary(set)).toBe("Concept 2 of 2");
  });

  it("uses generating/saving language, never uploading", () => {
    const set = two();
    expect(statusLine(set)).toBe("Generating concept 1 of 2…");
    markImage(set, 0, "img-1");
    expect(statusLine(set)).toBe("Saving concept 1 of 2…");
    markSaved(set, 0, { path: "p1" });
    markGenerating(set, 1);
    expect(statusLine(set)).toBe("Generating concept 2 of 2…");
    markImage(set, 1, "img-2");
    markSaved(set, 1, { path: "p2" });
    expect(statusLine(set)).toBe("2 concepts saved");
    expect(statusLine(set)).not.toMatch(/upload/i);
  });

  it("reports one status line only, never a stack", () => {
    const set = two();
    markImage(set, 0, "img-1");
    markGenerating(set, 1);
    const line = statusLine(set);
    expect(typeof line).toBe("string");
    expect(line.split("\n")).toHaveLength(1);
  });

  it("counts the batch honestly in Version History", () => {
    const set = two();
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1" });
    markGenerating(set, 1);
    expect(historyCount(set)).toBe("2 concepts · 1 saved · 1 generating");
    expect(historyCount(set)).not.toBe("1 version");
  });

  it("carries one authoritative kitchen room type", () => {
    const inferred = resolveRoom(null, "a bright modern kitchen with an island");
    const set = createOutputSet({
      count: 2,
      roomType: inferred.room,
      roomSource: inferred.roomSource,
    });
    expect(set.roomType).toBe("Kitchen");
    expect(set.roomSource).toBe("inferred");
  });

  it("enables Save Room only after durable persistence", () => {
    const set = two();
    expect(saveRoomState(set).enabled).toBe(false);
    expect(saveRoomState(set).label).toBe("Saving concepts…");
    expect(saveRoomState(set).tooltip).toBe("Available after both concepts finish saving.");
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1" });
    markImage(set, 1, "img-2");
    expect(saveRoomState(set).enabled).toBe(false);
    markSaved(set, 1, { path: "p2" });
    const s = saveRoomState(set);
    expect(s.enabled).toBe(true);
    expect(s.label).toBe("Save Room");
  });

  it("saves the room with every durable concept, not just the visible one", () => {
    const set = two();
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1", versionId: "v1" });
    markImage(set, 1, "img-2");
    markSaved(set, 1, { path: "p2", versionId: "v2" });
    setActive(set, set.slots[1]!.outputId);
    expect(persistableSlots(set).map((s) => s.path)).toEqual(["p1", "p2"]);
  });

  it("keeps concept 1 when concept 2 fails and still allows saving the room", () => {
    const set = two();
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1", versionId: "v1" });
    markFailed(set, 1, "Generation failed");
    expect(orderedSlots(set)[0]!.image).toBe("img-1");
    expect(orderedSlots(set)[0]!.status).toBe("saved");
    expect(saveRoomState(set).enabled).toBe(true);
    expect(statusLine(set)).toBe("1 of 2 concepts saved · retry the rest");
    expect(persistableSlots(set)).toHaveLength(1);
  });

  it("never discards a saved image if a later failure lands on it", () => {
    const set = two();
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1" });
    markFailed(set, 0, "late failure");
    expect(orderedSlots(set)[0]!.status).toBe("saved");
  });

  it("restores both concepts and the active selection from a serialized set", () => {
    const set = two();
    markImage(set, 0, "img-1");
    markSaved(set, 0, { path: "p1", versionId: "v1" });
    markImage(set, 1, "img-2");
    markSaved(set, 1, { path: "p2", versionId: "v2" });
    setActive(set, set.slots[1]!.outputId);
    const restored = JSON.parse(JSON.stringify(set)) as typeof set;
    expect(orderedSlots(restored).map((s) => s.path)).toEqual(["p1", "p2"]);
    expect(activeSlot(restored)!.outputIndex).toBe(1);
    expect(activeSummary(restored)).toBe("Concept 2 of 2");
  });
});

describe("multi-output canvas contract", () => {
  it("creates every requested slot immediately, in numerical order", () => {
    const set = createOutputSet({ count: 2, roomType: "Kitchen", roomSource: "inferred" });
    expect(set.slots.length).toBe(2);
    expect(orderedSlots(set).map((s) => s.outputIndex)).toEqual([0, 1]);
    expect(slotBadge(set, slotAt(set, 0)!)).toBe("Generating");
    expect(slotBadge(set, slotAt(set, 1)!)).toBe("Queued");
    expect(set.roomType).toBe("Kitchen");
  });

  it("keeps order when the second concept finishes first", () => {
    const set = createOutputSet({ count: 2 });
    markImage(set, 1, "b");
    markSaved(set, 1, { path: "p1" });
    markImage(set, 0, "a");
    markSaved(set, 0, { path: "p0" });
    expect(persistableSlots(set).map((s) => s.path)).toEqual(["p0", "p1"]);
    expect(orderedSlots(set).map((s) => s.image)).toEqual(["a", "b"]);
  });

  it("never says a concept is uploading", () => {
    const set = createOutputSet({ count: 2 });
    const lines = [statusLine(set)];
    markImage(set, 0, "a");
    lines.push(statusLine(set));
    markSaved(set, 0, { path: "p" });
    lines.push(statusLine(set), saveRoomState(set).label, saveRoomState(set).tooltip);
    lines.forEach((l) => expect(l.toLowerCase()).not.toContain("upload"));
    expect(lines[0]).toContain("Generating concept 1 of 2");
  });

  it("gates Save Room until durable saves finish, then enables it", () => {
    const set = createOutputSet({ count: 2 });
    expect(saveRoomState(set).enabled).toBe(false);
    markImage(set, 0, "a");
    expect(saveRoomState(set).enabled).toBe(false);
    markSaved(set, 0, { path: "p0" });
    markImage(set, 1, "b");
    expect(saveRoomState(set).enabled).toBe(false);
    markSaved(set, 1, { path: "p1" });
    expect(saveRoomState(set).enabled).toBe(true);
    expect(historyCount(set)).toBe("2 concepts · 2 saved");
  });

  it("enables Save Room when one output failed but another saved", () => {
    const set = createOutputSet({ count: 2 });
    markImage(set, 0, "a");
    markSaved(set, 0, { path: "p0" });
    markFailed(set, 1, "Generation failed");
    expect(saveRoomState(set).enabled).toBe(true);
    expect(historyCount(set)).toBe("2 concepts · 1 saved · 1 failed");
    expect(statusLine(set)).toContain("retry");
  });

  it("keeps the active concept addressed by id", () => {
    const set = createOutputSet({ count: 2 });
    markImage(set, 0, "a");
    markImage(set, 1, "b");
    setActive(set, slotAt(set, 1)!.outputId);
    expect(activeSlot(set)!.outputIndex).toBe(1);
    expect(activeSummary(set)).toBe("Concept 2 of 2");
    markSaved(set, 0, { path: "p0" });
    expect(activeSlot(set)!.outputIndex).toBe(1);
  });

  it("a failure never discards an image that already exists", () => {
    const set = createOutputSet({ count: 1 });
    markImage(set, 0, "a");
    markFailed(set, 0, "Could not save that concept");
    expect(slotAt(set, 0)!.image).toBe("a");
  });
});
