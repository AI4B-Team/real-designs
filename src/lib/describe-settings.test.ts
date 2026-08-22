import { describe, expect, it } from "vitest";
import * as DS from "./describe-settings";

const base: DS.SettingsState = {
  prompt: "A calm kitchen with oak cabinets",
  refCount: 0,
  space: "Interior",
  roomId: "i-kitchen",
  roomLabel: "Kitchen",
  styleId: "warm-minimal",
  styleLabel: "Warm Minimal",
  level: "Subtle",
  ratio: "1:1",
  options: 2,
  moodId: DS.DEFAULT_MOOD_ID,
};

describe("rooms", () => {
  it("offers four cards and always includes the selection", () => {
    const picked = DS.quickAreas("Interior").slice(-1)[0]!;
    const cards = DS.quickAreas("Interior", picked.id);
    expect(cards).toHaveLength(4);
    expect(cards[0]!.id).toBe(picked.id);
  });

  it("switches the pool with the space", () => {
    expect(DS.quickAreas("Garden").every((a) => a.space === "garden")).toBe(true);
  });

  it("infers the room from the description", () => {
    expect(DS.inferAreaFromPrompt("a bright kitchen with marble", "Interior")?.label).toBe(
      "Kitchen",
    );
    expect(DS.inferAreaFromPrompt("nothing specific here", "Interior")).toBeNull();
  });

  it("searches by label", () => {
    expect(DS.searchAreas("Interior", "bed").length).toBeGreaterThan(0);
    expect(DS.searchAreas("Interior", "zzz")).toHaveLength(0);
  });
});

describe("styles", () => {
  it("offers four space-aware cards including the selection", () => {
    const cards = DS.quickStyleCards("Interior", "warm-minimal");
    expect(cards).toHaveLength(4);
    expect(cards[0]!.id).toBe("warm-minimal");
  });

  it("never returns duplicates", () => {
    const ids = DS.quickStyleCards("Exterior").map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("mood", () => {
  it("keeps mood applicable to the space", () => {
    expect(DS.ensureMood("warm-cozy", "Interior")).toBe("warm-cozy");
    expect(DS.ensureMood("warm-cozy", "Garden")).toBe(DS.DEFAULT_MOOD_ID);
  });
});

describe("prompt editor", () => {
  it("stays compact then grows and stops", () => {
    expect(DS.promptHeight(10)).toBe(DS.PROMPT_MIN_H);
    expect(DS.promptHeight(150)).toBe(150);
    expect(DS.promptHeight(999)).toBe(DS.PROMPT_MAX_H);
  });

  it("shows the character count only near the limit", () => {
    expect(DS.showCharCount(20)).toBe(false);
    expect(DS.showCharCount(DS.PROMPT_LIMIT - 5)).toBe(true);
  });
});

describe("references", () => {
  it("reorders without losing items", () => {
    expect(DS.reorder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(DS.reorder(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("labels roles", () => {
    expect(DS.refRoleLabel("color")).toBe("Color Palette");
  });
});

describe("summary and validation", () => {
  it("summarizes every visible choice", () => {
    expect(DS.generationSummary(base)).toBe("Kitchen · Warm Minimal · Subtle · 1:1 · 2 images");
  });

  it("asks for one thing at a time", () => {
    expect(DS.nextRequirement({ ...base, prompt: "" })).toBe(
      "Add a description or reference image.",
    );
    expect(DS.nextRequirement({ ...base, prompt: "", refCount: 1, roomId: null })).toBe(
      "Select a room or area.",
    );
    expect(DS.nextRequirement({ ...base, styleId: null })).toBe("Select a design style.");
    expect(DS.nextRequirement(base)).toBeNull();
  });

  it("flags selections that stop making sense after a space change", () => {
    const lost = DS.incompatibleAfterSpace(
      { roomLabel: "Kitchen", styleId: base.styleId },
      "Garden",
    );
    expect(lost).toContain("Kitchen");
  });
});
