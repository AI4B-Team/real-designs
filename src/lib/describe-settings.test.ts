import { describe, expect, it } from "vitest";
import * as DS from "@/lib/describe-settings";

describe("describe design settings", () => {
  it("puts the room named in the description first", () => {
    const inferred = DS.inferAreaFromPrompt("A bright modern luxury kitchen", "Interior");
    expect(inferred?.id).toBe("i-kitchen");
    const cards = DS.quickAreas("Interior", null, 4, {
      inferredId: inferred?.id ?? null,
      recents: [],
    });
    expect(cards[0]?.id).toBe("i-kitchen");
    expect(cards).toHaveLength(4);
  });

  it("prefers recent rooms over generic ones", () => {
    const cards = DS.quickAreas("Interior", null, 4, { recents: ["i-bathroom"] });
    expect(cards[0]?.id).toBe("i-bathroom");
  });

  it("reads the longest style name from the description", () => {
    const rec = DS.inferStyleFromPrompt("modern luxury kitchen with stone", "Interior");
    expect(rec?.id).toBe("modern-luxury");
  });

  it("shows the inferred style among the four cards", () => {
    const cards = DS.quickStyleCards("Interior", null, 4, "modern-luxury");
    expect(cards.some((c) => c.id === "modern-luxury")).toBe(true);
  });

  it("keeps the footer summary short", () => {
    const s: DS.SettingsState = {
      prompt: "x",
      refCount: 0,
      space: "Interior",
      roomId: "i-kitchen",
      roomLabel: "Kitchen",
      styleId: "modern-luxury",
      styleLabel: "Modern Luxury",
      level: "Balanced",
      ratio: "16:9",
      options: 1,
      moodId: DS.DEFAULT_MOOD_ID,
    };
    expect(DS.compactSummary(s)).toBe("Kitchen \u00b7 Modern Luxury \u00b7 Balanced \u00b7 16:9");
    expect(DS.compactSummary({ ...s, moodId: "natural-daylight" })).toBe(
      "Kitchen \u00b7 Modern Luxury \u00b7 Balanced \u00b7 16:9 \u00b7 Natural Daylight",
    );
    expect(DS.nextRequirement(s)).toBeNull();
    expect(DS.nextRequirement({ ...s, roomId: null, styleId: null })).toBe(
      "Select a room and design style",
    );
    expect(DS.DEFAULT_MOOD_ID).toBe("auto");
    expect(DS.moodLabel("natural-daylight")).toBe("Natural Daylight");
    expect(DS.nextRequirementTarget({ ...s, styleId: null })).toBe("style");
  });

  it("grows the prompt editor from a comfortable resting height", () => {
    expect(DS.promptHeight(40)).toBe(144);
    expect(DS.promptHeight(9999)).toBe(320);
  });
});
