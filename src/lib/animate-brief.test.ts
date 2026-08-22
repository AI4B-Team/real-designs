import { describe, expect, it } from "vitest";
import {
  ASPECT_OPTIONS,
  DURATION_OPTIONS,
  MORPH_THRESHOLD,
  buildAnimateBrief,
  clipCredits,
  defaultSettings,
  idempotencyKey,
  isActive,
  nearestDuration,
  negativePrompt,
  reducedMotion,
  sourceReady,
  statusLine,
  summarizeMotionCheck,
  supportsAspect,
  supportsDuration,
  type ClipSource,
} from "@/lib/animate-brief";

const source: ClipSource = {
  kind: "version",
  path: "u1/rooms/design-v3.jpg",
  label: "Warm Minimal V3",
  thumbUrl: null,
  versionId: "v3",
};

describe("provider capability detection", () => {
  it("disables formats the provider cannot render", () => {
    expect(supportsAspect("16:9")).toBe(true);
    expect(supportsAspect("9:16")).toBe(true);
    expect(supportsAspect("1:1")).toBe(false);
    const square = ASPECT_OPTIONS.find((a) => a.id === "1:1")!;
    expect(square.supported).toBe(false);
    expect(square.reason).toMatch(/16:9 or 9:16/);
  });

  it("only offers lengths the provider accepts", () => {
    expect(supportsDuration(8)).toBe(true);
    expect(supportsDuration(5)).toBe(false);
    expect(DURATION_OPTIONS.find((d) => d.seconds === 5)!.supported).toBe(false);
    expect(nearestDuration(5)).toBe(4);
    expect(nearestDuration(7)).toBe(6);
  });
});

describe("source accuracy", () => {
  it("refuses to start from an unsaved source", () => {
    expect(sourceReady(null)).toBe(false);
    expect(sourceReady({ ...source, path: null })).toBe(false);
    expect(sourceReady(source)).toBe(true);
    const brief = buildAnimateBrief({ settings: defaultSettings(), source: null });
    expect(brief.valid).toBe(false);
    expect(brief.missing.join(" ")).toMatch(/saved image/i);
  });

  it("carries the exact source version into the payload", () => {
    const brief = buildAnimateBrief({ settings: defaultSettings(), source });
    expect(brief.payload.source_path).toBe(source.path);
    expect(brief.payload.source_label).toBe("Warm Minimal V3");
    expect(brief.payload.source_kind).toBe("version");
    expect(brief.jobs[0]!.source_path).toBe(source.path);
  });
});

describe("settings reach the provider", () => {
  it("puts format, length and motion in the payload", () => {
    const brief = buildAnimateBrief({
      settings: { ...defaultSettings(), aspect: "9:16", seconds: 6, motionId: "pan_left" },
      source,
    });
    expect(brief.valid).toBe(true);
    expect(brief.payload.aspect).toBe("9:16");
    expect(brief.payload.seconds).toBe(6);
    expect(brief.payload.motion).toBe("pan_left");
    expect(brief.payload.prompt).toMatch(/pans smoothly to the left/i);
  });

  it("rejects unsupported combinations before charging", () => {
    const brief = buildAnimateBrief({
      settings: { ...defaultSettings(), aspect: "1:1", seconds: 5 },
      source,
    });
    expect(brief.valid).toBe(false);
    expect(brief.missing.length).toBe(2);
  });

  it("requires text for a custom camera move", () => {
    const brief = buildAnimateBrief({
      settings: { ...defaultSettings(), motionId: "custom", customPrompt: "  " },
      source,
    });
    expect(brief.valid).toBe(false);
    expect(brief.missing.join(" ")).toMatch(/custom clip/i);
  });
});

describe("quality rules", () => {
  it("bans people, text and shake unless intentional", () => {
    const neg = negativePrompt({ motionId: "dolly_in" });
    expect(neg).toMatch(/people/);
    expect(neg).toMatch(/camera shake/);
    expect(neg).toMatch(/text/);
    expect(negativePrompt({ motionId: "handheld" })).not.toMatch(/camera shake/);
    expect(negativePrompt({ motionId: "dolly_in", allowPeople: true })).not.toMatch(/people/);
  });

  it("locks the architecture in the prompt", () => {
    const brief = buildAnimateBrief({ settings: defaultSettings(), source });
    expect(brief.payload.prompt).toMatch(/fixed geometry/i);
    expect(brief.payload.prompt).toMatch(/stay exactly as shown/i);
  });
});

describe("clip kinds", () => {
  it("needs the original for a before / after reveal", () => {
    const a = buildAnimateBrief({
      settings: { ...defaultSettings(), clipKind: "before_after" },
      source,
    });
    expect(a.valid).toBe(false);
    const b = buildAnimateBrief({
      settings: { ...defaultSettings(), clipKind: "before_after" },
      source,
      originalPath: "u1/rooms/original.jpg",
    });
    expect(b.valid).toBe(true);
    expect(b.jobs[0]!.source_path).toBe("u1/rooms/original.jpg");
    expect(b.jobs[0]!.frame_path).toBe(source.path);
  });

  it("renders one job per angle and charges each", () => {
    const brief = buildAnimateBrief({
      settings: { ...defaultSettings(), clipKind: "angle_sequence" },
      source: {
        kind: "angle_set",
        path: null,
        label: "Living Room Angles",
        thumbUrl: null,
        members: [
          { path: "u1/a1.jpg", label: "Wide" },
          { path: "u1/a2.jpg", label: "Corner" },
        ],
      },
    });
    expect(brief.valid).toBe(true);
    expect(brief.jobs).toHaveLength(2);
    expect(brief.credits).toBe(clipCredits(2));
    expect(brief.credits).toBe(80);
  });
});

describe("credits", () => {
  it("charges 40 per clip", () => {
    expect(buildAnimateBrief({ settings: defaultSettings(), source }).credits).toBe(40);
  });
});

describe("duplicate prevention", () => {
  it("gives identical settings the same key and different settings a different one", () => {
    const a = buildAnimateBrief({ settings: defaultSettings(), source }).payload;
    const b = buildAnimateBrief({
      settings: { ...defaultSettings(), seconds: 4 },
      source,
    }).payload;
    expect(idempotencyKey(a, source.path!)).toBe(idempotencyKey(a, source.path!));
    expect(idempotencyKey(a, source.path!)).not.toBe(idempotencyKey(b, source.path!));
    expect(idempotencyKey(a, source.path!)).not.toBe(idempotencyKey(a, "other.jpg"));
    expect(idempotencyKey(a, source.path!, "retry-1")).not.toBe(idempotencyKey(a, source.path!));
  });
});

describe("morphing warning", () => {
  it("flags a drifting clip and advises reduced motion", () => {
    const bad = summarizeMotionCheck({ score: 52, issues: ["The sofa changes shape"] });
    expect(bad.morphing).toBe(true);
    expect(bad.advice).toMatch(/reduced motion/i);
    const good = summarizeMotionCheck({ score: 94, issues: [] });
    expect(good.morphing).toBe(false);
    expect(good.score).toBeGreaterThanOrEqual(MORPH_THRESHOLD);
  });

  it("halves travel on an automatic reduced-motion retry", () => {
    const retry = reducedMotion({ ...defaultSettings(), strength: 80, speed: 60, motionId: "handheld" });
    expect(retry.strength).toBe(40);
    expect(retry.motionId).toBe("slow_push");
    expect(retry.lockArchitecture).toBe(true);
  });
});

describe("honest status", () => {
  it("reports the provider state, never invented progress", () => {
    expect(isActive({ status: "in_progress" })).toBe(true);
    expect(isActive({ status: "completed" })).toBe(false);
    expect(statusLine({ status: "queued" })).toMatch(/queued/i);
    expect(statusLine({ status: "in_progress", progress: 0 })).toMatch(/one to three minutes/i);
    expect(statusLine({ status: "in_progress", progress: 45 })).toMatch(/45% reported by the provider/);
    expect(statusLine({ status: "failed", error: "Provider timeout" })).toBe("Provider timeout");
  });
});
