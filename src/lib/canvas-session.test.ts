import { describe, expect, it } from "vitest";
import * as CS from "./canvas-session";

const two = () => CS.createSession({ count: 2, kind: "concept", roomType: "Living Room" });

describe("canvas session", () => {
  it("creates every slot up front in numerical order", () => {
    const s = two();
    expect(s.outputs.map((o) => o.outputIndex)).toEqual([0, 1]);
    expect(CS.outputLabel(s, s.outputs[0]!)).toBe("Concept 1");
    expect(CS.outputLabel(s, s.outputs[1]!)).toBe("Concept 2");
    expect(s.activeOutputId).toBe(s.outputs[0]!.outputId);
    expect(s.generationStatus).toBe("generating");
  });

  it("never lets a later result reorder or steal the active output", () => {
    const s = two();
    CS.markImage(s, 1, "b.png");
    expect(CS.activeOutput(s)?.outputIndex).toBe(1);
    CS.markImage(s, 0, "a.png");
    expect(CS.orderedOutputs(s).map((o) => o.displayUrl)).toEqual(["a.png", "b.png"]);
    CS.setActive(s, s.outputs[0]!.outputId);
    CS.markSaved(s, 1, { path: "p1" });
    expect(CS.activeOutput(s)?.outputIndex).toBe(0);
  });

  it("uses accurate status language and exactly one line", () => {
    const s = two();
    expect(CS.statusLine(s)).toBe("Generating concept 1 of 2\u2026");
    CS.markImage(s, 0, "a.png");
    expect(CS.statusLine(s)).toBe("Saving concept 1 of 2\u2026");
    CS.markSaved(s, 0, { path: "p0" });
    CS.markGenerating(s, 1);
    expect(CS.statusLine(s)).toBe("Generating concept 2 of 2\u2026");
    CS.markImage(s, 1, "b.png");
    expect(CS.statusLine(s)).toBe("Saving concept 2 of 2\u2026");
    CS.markSaved(s, 1, { path: "p1" });
    expect(CS.statusLine(s)).toBe("2 concepts saved");
    expect(CS.statusLine(s)).not.toMatch(/upload/i);
  });

  it("assigns version numbers in permanent output order", () => {
    const s = two();
    CS.markImage(s, 1, "b.png");
    CS.markSaved(s, 1, { path: "p1" });
    CS.markImage(s, 0, "a.png");
    CS.markSaved(s, 0, { path: "p0" });
    expect(CS.orderedOutputs(s).map((o) => o.versionNo)).toEqual([1, 2]);
    expect(CS.outputBadge(s, CS.outputAt(s, 0)!)).toBe("Saved \u00b7 V1");
  });

  it("derives generation status", () => {
    const s = two();
    CS.markImage(s, 0, "a.png");
    CS.markSaved(s, 0, { path: "p0" });
    CS.markFailed(s, 1, "Generation failed");
    expect(s.generationStatus).toBe("partially_complete");
    expect(CS.statusLine(s)).toBe("1 of 2 concepts saved \u00b7 retry the rest");
  });

  it("keeps failures from discarding an existing image", () => {
    const s = two();
    CS.markImage(s, 0, "a.png");
    CS.markFailed(s, 0, "Could not save");
    expect(CS.outputAt(s, 0)?.displayUrl).toBe("a.png");
    expect(CS.outputAt(s, 0)?.retryable).toBe(true);
  });

  it("gates Save Room on durable saves only", () => {
    const s = two();
    expect(CS.saveRoomState(s).enabled).toBe(false);
    CS.markImage(s, 0, "a.png");
    CS.markSaved(s, 0, { path: "p0" });
    CS.markFailed(s, 1, "failed");
    const gate = CS.saveRoomState(s);
    expect(gate.enabled).toBe(true);
    expect(gate.label).toBe("Save Room");
    CS.setRoomSave(s, "saving");
    expect(CS.saveRoomState(s).enabled).toBe(false);
    CS.setRoomSave(s, "saved", "room-1");
    expect(CS.saveRoomState(s).label).toBe("Room Saved");
  });

  it("keeps one authoritative room type", () => {
    const s = two();
    expect(s.roomTypeName).toBe("Living Room");
    CS.setRoomType(s, "Kitchen", { id: "kitchen" });
    expect(s.roomTypeId).toBe("kitchen");
    expect(s.roomTypeName).toBe("Kitchen");
  });

  it("attaches every durable output in order", () => {
    const s = two();
    CS.markImage(s, 1, "b.png");
    CS.markSaved(s, 1, { path: "p1", versionId: "v1" });
    CS.markImage(s, 0, "a.png");
    CS.markSaved(s, 0, { path: "p0", versionId: "v0" });
    expect(CS.persistableOutputs(s).map((o) => o.resultStoragePath)).toEqual(["p0", "p1"]);
  });

  it("blocks actions until the active output has an image", () => {
    const s = two();
    expect(CS.actionState(s).enabled).toBe(false);
    CS.markImage(s, 0, "a.png");
    expect(CS.actionState(s).enabled).toBe(true);
    expect(CS.actionState(s).outputId).toBe(s.outputs[0]!.outputId);
  });

  it("summarizes history for the version header", () => {
    const s = two();
    CS.markImage(s, 0, "a.png");
    CS.markSaved(s, 0, { path: "p0" });
    expect(CS.historyCount(s)).toBe("2 concepts \u00b7 1 saved \u00b7 1 generating");
  });
});
