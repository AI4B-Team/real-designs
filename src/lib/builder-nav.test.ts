import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PHOTO_FLOW,
  PHOTO_RAIL,
  VIDEO_FLOW,
  VIDEO_RAIL,
  backFromPhotoStep,
  backFromVideoStep,
  isAddPhotosStep,
  normalizePhotoStep,
  normalizeVideoStep,
  START_OVER_COPY,
} from "./builder-nav";
import { initialWizardStep } from "./video-upload-intake";
import { restoreStep } from "./builder-step";

const staging = readFileSync("src/content/rd-staging.ts", "utf8");
const reveal = readFileSync("src/content/rd-reveal.ts", "utf8");

describe("shared builder navigation contract", () => {
  it("photo design rail is Rooms, Design, Review — no Add Photos", () => {
    expect(PHOTO_RAIL.map((s) => s.label)).toEqual(["Rooms", "Design", "Review"]);
    expect(PHOTO_FLOW).toEqual(["review", "design", "final"]);
  });

  it("video rail is Scenes, Titles, Audio, Brand, Review — no Add Photos", () => {
    expect(VIDEO_RAIL.map((s) => s.label)).toEqual(["Scenes", "Titles", "Audio", "Brand", "Review"]);
    expect(VIDEO_FLOW).toEqual([2, 5, 6, 4, 7]);
  });

  it("Studio -> Rooms -> Back -> Studio", () => {
    expect(backFromPhotoStep("review")).toEqual({ exit: true });
  });

  it("Studio -> Scenes -> Back -> Studio", () => {
    expect(backFromVideoStep(2)).toEqual({ exit: true });
  });

  it("later steps step back one builder step", () => {
    expect(backFromPhotoStep("design")).toEqual({ exit: false, step: "review" });
    expect(backFromPhotoStep("final")).toEqual({ exit: false, step: "design" });
    expect(backFromVideoStep(5)).toEqual({ exit: false, step: 2 });
    expect(backFromVideoStep(6)).toEqual({ exit: false, step: 5 });
    expect(backFromVideoStep(4)).toEqual({ exit: false, step: 6 });
    expect(backFromVideoStep(7)).toEqual({ exit: false, step: 4 });
  });

  it("legacy Add Photos steps resolve to the first builder step", () => {
    expect(isAddPhotosStep("add")).toBe(true);
    expect(isAddPhotosStep(1)).toBe(true);
    expect(normalizePhotoStep("add")).toBe("review");
    expect(normalizeVideoStep(1)).toBe(2);
    expect(normalizeVideoStep(3)).toBe(2);
    expect(backFromVideoStep(1)).toEqual({ exit: true });
    expect(backFromPhotoStep("add")).toEqual({ exit: true });
  });
});

describe("builders bypass the duplicate Add Photos route", () => {
  it("video wizards always open on Scenes", () => {
    expect(initialWizardStep({}, [])).toBe(2);
    expect(initialWizardStep({}, [{ id: "a" }])).toBe(2);
    expect(initialWizardStep({ propertyId: "p1" }, [])).toBe(2);
    expect(initialWizardStep({ step: 5 }, [])).toBe(5);
  });

  it("video render normalises any stale step and has no step-1 body", () => {
    expect(reveal).toContain("S.wizard.step = normalizeVideoStep(S.wizard.step)");
    expect(reveal).not.toContain("if (w.step === 1) body = stepPhotos();");
    expect(reveal).not.toContain('["photos", "Add Photos", "image", 1]');
  });

  it("photo builder opens on Rooms and never renders an internal Add Photos page", () => {
    expect(staging).toContain('S.step = "review"');
    expect(staging).not.toContain("<h2>Add Photos</h2>");
  });

  it("a saved draft still restores its real step", () => {
    const keys = ["a", "b"];
    expect(restoreStep({ builder_step: "design", keys, activeKey: "a" })).toEqual({
      step: "design",
      activeKey: "a",
    });
    /* Drafts saved on the removed Add step reopen on Rooms once normalised. */
    expect(normalizePhotoStep(restoreStep({ builder_step: "add", keys }).step)).toBe("review");
  });
});

describe("exit affordances", () => {
  it("both builders offer Save & Exit and Start Over in the overflow menu", () => {
    expect(reveal).toMatch(/rv-headmore[\s\S]*rvExitBuilder[\s\S]*rvStartOver/);
    expect(staging).toMatch(/rv-headmore[\s\S]*rdsClose[\s\S]*rdsStartOver/);
  });

  it("Start Over confirms with the agreed copy and keeps photos in Media", () => {
    const modal = readFileSync("src/lib/builder-exit.ts", "utf8");
    expect(modal).toContain("Your current draft settings will be cleared. Uploaded photos will remain in Media.");
    expect(START_OVER_COPY).toContain("Uploaded photos will remain in Media");
  });

  it("Save & Exit flushes the draft before returning to Studio", () => {
    expect(reveal).toMatch(/async function exitBuilder[\s\S]*wizSaver\.flush\(\)/);
    expect(staging).toMatch(/async function saveExit[\s\S]*saver\.flush\(\)/);
  });

  it("browser Back from the first builder step saves and returns to Studio", () => {
    expect(reveal).toMatch(/onExit: \(\) => \{[\s\S]*exitBuilder\(w\)/);
    expect(staging).toMatch(/onExit: \(\) => \{[\s\S]*saveExit\(\)/);
  });

  it("Add Photos on Rooms and Scenes appends to the current draft", () => {
    expect(staging).toContain('if (picked.length) addFiles(picked);');
    expect(reveal).toContain('on("#rvHeadFile", "change"');
  });
});
