import { describe, expect, it } from "vitest";
import {
  ANIMATE_CREDITS_PER_CLIP,
  ANIMATE_OPTIONS,
  EFFECT_OPTIONS,
  LOOK_OPTIONS,
  MOTION_OPTIONS,
  animatePrompt,
  capabilityLevel,
  clipStatusLabel,
  clipUsable,
  costPerScene,
  effectsForCategory,
  quote,
  sceneDisclosures,
} from "@/lib/scene-enhancement";

describe("capability model", () => {
  it("keeps the three levels separate and complete", () => {
    expect(MOTION_OPTIONS).toHaveLength(12);
    expect(LOOK_OPTIONS).toHaveLength(10);
    expect(ANIMATE_OPTIONS).toHaveLength(17);
    expect(new Set(EFFECT_OPTIONS.map((e) => e.id)).size).toBe(EFFECT_OPTIONS.length);
  });

  it("never charges for motion or looks", () => {
    MOTION_OPTIONS.forEach((m) => expect(costPerScene("motion", m.id)).toBe(0));
    LOOK_OPTIONS.forEach((l) => expect(l.credits).toBe(0));
  });

  it("prices every AI clip and no effect at clip prices", () => {
    ANIMATE_OPTIONS.forEach((a) =>
      expect(costPerScene("animate", a.id)).toBe(ANIMATE_CREDITS_PER_CLIP),
    );
    EFFECT_OPTIONS.forEach((e) => expect(e.credits).toBeLessThan(ANIMATE_CREDITS_PER_CLIP));
  });

  it("reports the level actually in use", () => {
    expect(capabilityLevel({ motion: "push" })).toBe("motion");
    expect(capabilityLevel({ motion: "push", effect: "none" })).toBe("motion");
    expect(capabilityLevel({ effect: "light_leak" })).toBe("effect");
    expect(capabilityLevel({ effect: "light_leak", animate: "dolly_in" })).toBe("animate");
    expect(capabilityLevel({ animate: "not_a_real_option" })).toBe("motion");
  });

  it("always offers None in a category listing", () => {
    expect(effectsForCategory("lighting").some((e) => e.id === "none")).toBe(true);
    expect(effectsForCategory("all")).toEqual(EFFECT_OPTIONS);
  });
});

describe("animate prompts", () => {
  it("guards architecture and excludes people unless lifestyle is chosen", () => {
    const p = animatePrompt("enter_room", { room: "kitchen" });
    expect(p).toMatch(/do not add, remove or move walls/i);
    expect(p).toMatch(/No people/i);
    expect(p).toMatch(/kitchen/);
    expect(animatePrompt("lifestyle")).not.toMatch(/No people/i);
  });

  it("refuses an unknown option instead of inventing one", () => {
    expect(() => animatePrompt("teleport")).toThrow();
  });
});

describe("cost quotes", () => {
  it("shows scenes, cost per scene, total and remaining balance", () => {
    const q = quote(
      [
        { label: "Motion", kind: "motion", id: "push", scenes: 12 },
        { label: "Fireplace Glow", kind: "effect", id: "fireplace_glow", scenes: 3 },
        { label: "AI Animate", kind: "animate", id: "dolly_in", scenes: 2 },
      ],
      200,
    );
    expect(q.lines[0]!.total).toBe(0);
    expect(q.lines[1]!.perScene).toBe(2);
    expect(q.lines[2]!.total).toBe(80);
    expect(q.total).toBe(86);
    expect(q.remaining).toBe(114);
    expect(q.affordable).toBe(true);
  });

  it("flags a quote the balance cannot cover", () => {
    expect(
      quote([{ label: "AI Animate", kind: "animate", id: "dolly_in", scenes: 3 }], 40).affordable,
    ).toBe(false);
  });
});

describe("disclosure", () => {
  it("labels simulated movement, not drone footage", () => {
    expect(sceneDisclosures({ motion: "push" })).toEqual(["simulated_motion"]);
    expect(sceneDisclosures({ motion: "static" })).toEqual([]);
    expect(sceneDisclosures({ animate: "aerial_reveal" })).toEqual([
      "simulated_aerial",
      "ai_video",
    ]);
  });

  it("records every real modification of a scene", () => {
    const d = sceneDisclosures({ staged: true, effect: "fireplace_glow", animate: "lifestyle" });
    expect(d).toContain("staged");
    expect(d).toContain("altered");
    expect(d).toContain("lifestyle");
    expect(d).toContain("ai_video");
  });
});

describe("clip jobs", () => {
  it("only lets a stored, completed clip into a render", () => {
    expect(clipUsable({ status: "completed", storage_path: "u/c.mp4" })).toBe(true);
    expect(clipUsable({ status: "completed", storage_path: null })).toBe(false);
    expect(clipUsable({ status: "processing", storage_path: "u/c.mp4" })).toBe(false);
    expect(clipUsable(null)).toBe(false);
  });

  it("reports honest status text", () => {
    expect(clipStatusLabel("processing", 0.4)).toBe("Processing 40%");
    expect(clipStatusLabel("processing")).toBe("Processing");
    expect(clipStatusLabel("failed")).toBe("Failed");
  });
});
