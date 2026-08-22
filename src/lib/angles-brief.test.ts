import { describe, expect, it } from "vitest";
import {
  CREDITS_PER_ANGLE,
  INFERENCE_DISCLOSURE,
  angleCredits,
  angleMeta,
  anglePrompt,
  buildAngleBrief,
  buildRuns,
  customCameraDirective,
  emptyContinuity,
  failedResults,
  normalizeConsistency,
  normalizeCustomCamera,
  reorderResults,
  renameResult,
  restoreFromAngleMeta,
  scoreIssues,
  summarizeConsistency,
  toggleVideoSelection,
  videoSequence,
  type AngleResult,
  type AngleSettings,
} from "@/lib/angles-brief";

const base: AngleSettings = {
  sourceKind: "generated",
  hasSource: true,
  selected: [],
  customCameras: [],
  outputSet: "single",
  continuity: { ...emptyContinuity(), summary: "A square living room with two windows." },
  signals: ["prior_prompt"],
  roomType: "Living Room",
  styleName: "Warm Minimal",
};

describe("angle selection and cost", () => {
  it("does not generate anything from selection alone", () => {
    const brief = buildAngleBrief({ ...base, selected: [] });
    expect(brief.valid).toBe(false);
    expect(brief.runs).toHaveLength(0);
    expect(brief.credits).toBe(0);
    expect(brief.missing.join(" ")).toMatch(/at least one camera angle/i);
  });

  it("charges one credit per requested angle", () => {
    const brief = buildAngleBrief({ ...base, selected: ["slight_left", "wider", "doorway"] });
    expect(brief.runs).toHaveLength(3);
    expect(brief.credits).toBe(3 * CREDITS_PER_ANGLE);
    expect(brief.costSentence).toContain("3 angles");
  });

  it("one requested angle produces exactly one run", () => {
    const brief = buildAngleBrief({ ...base, selected: ["closer"] });
    expect(brief.runs).toHaveLength(1);
    expect(brief.credits).toBe(1);
    expect(brief.payload.total_angles).toBe(1);
  });

  it("three requested angles produce three coordinated records in one set", () => {
    const brief = buildAngleBrief({ ...base, outputSet: "three", selected: [] });
    expect(brief.runs).toHaveLength(3);
    const metas = brief.runs.map((run, i) =>
      angleMeta({ payload: brief.payload, run, index: i, sourceVersion: "v1" }),
    );
    expect(new Set(metas.map((m) => m.angle_set_id)).size).toBe(1);
    expect(metas.map((m) => m.angle_index)).toEqual([0, 1, 2]);
    expect(metas.every((m) => m.angle_total === 3)).toBe(true);
  });

  it("counts custom cameras alongside presets", () => {
    const brief = buildAngleBrief({
      ...base,
      selected: ["slight_left"],
      customCameras: [normalizeCustomCamera({ direction: "right", rotation: 45, dolly: -3 })],
    });
    expect(brief.runs).toHaveLength(2);
    expect(brief.credits).toBe(2);
    expect(brief.runs[1]!.label).toContain("45");
  });

  it("dedupes presets and keeps output-set order", () => {
    const runs = buildRuns({
      selected: ["wider", "wider", "slight_left"],
      customCameras: [],
      outputSet: "listing",
    });
    expect(runs.map((r) => r.preset)).toEqual(["doorway", "eye_level_center", "wider", "closer"]);
  });

  it("prices angles linearly", () => {
    expect(angleCredits(0)).toBe(0);
    expect(angleCredits(4)).toBe(4);
  });
});

describe("camera instructions", () => {
  it("sends the selected camera instruction to the backend payload", () => {
    const brief = buildAngleBrief({ ...base, selected: ["opposite_corner"] });
    expect(brief.runs[0]!.directive).toMatch(/opposite corner/i);
    const prompt = anglePrompt(brief.payload, brief.runs[0]!, false);
    expect(prompt).toContain("CAMERA MOVE:");
    expect(prompt).toMatch(/opposite corner/i);
  });

  it("builds a custom directive from every custom field", () => {
    const cam = normalizeCustomCamera({ direction: "right", rotation: 40, dolly: 2, height: 6, fov: 90 });
    const d = customCameraDirective(cam);
    expect(d).toMatch(/40 degrees to the right/);
    expect(d).toMatch(/2 feet forward/);
    expect(d).toMatch(/6 feet/);
    expect(d).toMatch(/90 degree/);
  });

  it("clamps nonsense custom values", () => {
    const cam = normalizeCustomCamera({ rotation: 900, dolly: -99, height: 0, fov: 5 } as any);
    expect(cam.rotation).toBe(180);
    expect(cam.dolly).toBe(-12);
    expect(cam.height).toBe(1);
    expect(cam.fov).toBe(20);
  });

  it("locks continuity in every prompt", () => {
    const brief = buildAngleBrief({ ...base, selected: ["wider"] });
    const prompt = anglePrompt(brief.payload, brief.runs[0]!, true);
    expect(prompt).toContain("CONTINUITY LOCK");
    expect(prompt).toMatch(/already approved view of the same room/i);
    expect(prompt).toMatch(/not a redesign/i);
  });
});

describe("inference disclosure", () => {
  it("discloses inferred areas for photographs", () => {
    const brief = buildAngleBrief({ ...base, sourceKind: "photograph", selected: ["doorway"] });
    expect(brief.disclosure).toBe(INFERENCE_DISCLOSURE);
    expect(brief.payload.disclosure).toBe(INFERENCE_DISCLOSURE);
    expect(brief.warnings).toContain(INFERENCE_DISCLOSURE);
  });

  it("does not disclose inference for structured sources", () => {
    const brief = buildAngleBrief({ ...base, sourceKind: "sketch_render", selected: ["doorway"] });
    expect(brief.disclosure).toBeNull();
  });

  it("carries the disclosure onto each saved record", () => {
    const brief = buildAngleBrief({ ...base, sourceKind: "photograph", selected: ["wider"] });
    const meta = angleMeta({ payload: brief.payload, run: brief.runs[0]!, index: 0, sourceVersion: null });
    expect(meta.inferred_disclosure).toBe(INFERENCE_DISCLOSURE);
  });
});

describe("consistency scoring", () => {
  it("scores a clean view at 100 and passes it", () => {
    const s = normalizeConsistency({ issues: [] }, { id: "a", label: "Slight Left" });
    expect(s.score).toBe(100);
    expect(s.passed).toBe(true);
  });

  it("penalises major issues harder than minor ones", () => {
    expect(scoreIssues([{ id: "window_moved", severity: "major", detail: "x" }])).toBe(82);
    expect(scoreIssues([{ id: "window_moved", severity: "minor", detail: "x" }])).toBe(94);
  });

  it("flags the failing angles only", () => {
    const good = normalizeConsistency({ issues: [] }, { id: "a", label: "A" });
    const bad = normalizeConsistency(
      {
        issues: [
          { id: "window_moved", severity: "major", detail: "A window moved." },
          { id: "material_changed", severity: "major", detail: "The floor changed." },
        ],
      },
      { id: "b", label: "B" },
    );
    const report = summarizeConsistency([good, bad], INFERENCE_DISCLOSURE);
    expect(report.failing).toEqual([]);
    expect(bad.score).toBe(64);
    const worse = normalizeConsistency(
      {
        issues: [
          { id: "window_moved", severity: "major", detail: "1" },
          { id: "door_changed", severity: "major", detail: "2" },
          { id: "room_shape_drift", severity: "major", detail: "3" },
        ],
      },
      { id: "c", label: "C" },
    );
    expect(summarizeConsistency([good, worse]).failing).toEqual(["c"]);
  });

  it("ignores unknown check ids from the model", () => {
    const s = normalizeConsistency(
      { issues: [{ id: "vibes_off", severity: "major", detail: "hmm" }] },
      { id: "a", label: "A" },
    );
    expect(s.issues).toHaveLength(0);
  });
});

describe("retrying one angle", () => {
  const results: AngleResult[] = [
    { runId: "a", label: "A", image: "data:image/png;base64,x", path: "p", error: null, score: 92, issues: [], order: 0, videoSelected: false, preset: "slight_left", hotspots: [] },
    { runId: "b", label: "B", image: null, path: null, error: "failed", score: null, issues: [], order: 1, videoSelected: false, preset: "wider", hotspots: [] },
    { runId: "c", label: "C", image: "data:image/png;base64,y", path: "q", error: null, score: 40, issues: [], order: 2, videoSelected: false, preset: "doorway", hotspots: [] },
  ];

  it("identifies only the failed or drifting angles", () => {
    expect(failedResults(results).map((r) => r.runId)).toEqual(["b", "c"]);
  });

  it("regenerates one angle without rebuilding the set", () => {
    const brief = buildAngleBrief({
      ...base,
      setId: "angleset-fixed",
      runs: [
        {
          id: "b",
          preset: "wider",
          label: "Wider View",
          directive: "Step the camera back",
          camera: null,
          showsUnseen: true,
        },
      ],
      selected: ["slight_left", "wider", "doorway"],
    });
    expect(brief.runs).toHaveLength(1);
    expect(brief.credits).toBe(1);
    expect(brief.payload.set_id).toBe("angleset-fixed");
  });
});

describe("contact sheet operations", () => {
  const list: AngleResult[] = [0, 1, 2].map((i) => ({
    runId: "r" + i,
    label: "Angle " + i,
    image: "data:image/png;base64,x",
    path: null,
    error: null,
    score: 90,
    issues: [],
    order: i,
    videoSelected: false,
    preset: "slight_left",
    hotspots: [],
  }));

  it("reorders angles and renumbers them", () => {
    const moved = reorderResults(list, "r2", -1);
    expect(moved.map((r) => r.runId)).toEqual(["r0", "r2", "r1"]);
    expect(moved.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it("renames one angle", () => {
    expect(renameResult(list, "r1", "Doorway Hero")[1]!.label).toBe("Doorway Hero");
  });

  it("selects angles for video in display order", () => {
    let next = toggleVideoSelection(list, "r2");
    next = toggleVideoSelection(next, "r0");
    expect(videoSequence(next).map((r) => r.runId)).toEqual(["r0", "r2"]);
  });
});

describe("persistence", () => {
  it("stores the camera, set, source version and continuity on each record", () => {
    const brief = buildAngleBrief({ ...base, selected: ["eye_level_center"] });
    const meta = angleMeta({
      payload: brief.payload,
      run: brief.runs[0]!,
      index: 0,
      sourceVersion: "renders/v9.png",
      score: normalizeConsistency({ issues: [] }, { id: brief.runs[0]!.id, label: "x" }),
      model: "google/gemini-2.5-flash-image",
    });
    expect(meta.tool).toBe("Angles");
    expect(meta.source_version).toBe("renders/v9.png");
    expect(meta.camera_instruction).toBe(brief.runs[0]!.directive);
    expect(meta.quality_score).toBe(100);
    expect(meta.continuity.summary).toContain("living room");
  });

  it("restores the panel from a saved record", () => {
    const brief = buildAngleBrief({ ...base, selected: ["doorway"] });
    const meta = angleMeta({ payload: brief.payload, run: brief.runs[0]!, index: 0, sourceVersion: null });
    const restored = restoreFromAngleMeta(meta);
    expect(restored?.setId).toBe(brief.payload.set_id);
    expect(restored?.selected).toEqual(["doorway"]);
    expect(restoreFromAngleMeta({ tool: "Sketch" })).toBeNull();
  });
});
