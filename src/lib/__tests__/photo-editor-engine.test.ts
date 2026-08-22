import { describe, expect, it } from "vitest";
import {
  applyDehaze,
  applyDenoise,
  applyLens,
  applySharpen,
  detailOf,
  needsPixelPass,
  type Pixels,
} from "@/lib/photo-pixels";
import {
  CROP_PRESETS,
  classifyEdits,
  cropPreset,
  disclosureText,
  exportFileName,
  exportPreset,
  exportSize,
  mergeBundle,
  qualityReview,
  type AdjustmentBundle,
} from "@/lib/photo-editor-presets";

function ramp(w = 8, h = 8): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    const v = (i * 7) % 256;
    data[i * 4] = v;
    data[i * 4 + 1] = 255 - v;
    data[i * 4 + 2] = 128;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("photo-pixels", () => {
  it("only asks for a pixel pass when a detail control is engaged", () => {
    expect(needsPixelPass({ exposure: 40 } as any)).toBe(false);
    expect(needsPixelPass({ sharpen: 20 })).toBe(true);
    expect(needsPixelPass({ lens: -12 })).toBe(true);
  });

  it("picks only the pixel-pass controls out of a full adjustment map", () => {
    expect(detailOf({ exposure: 30, sharpen: 10, lens: 5 })).toEqual({
      sharpen: 10,
      denoise: 0,
      clarity: 0,
      dehaze: 0,
      lens: 5,
    });
  });

  it("changes real pixels for sharpen, denoise, dehaze and lens", () => {
    for (const run of [
      (p: Pixels) => applySharpen(p, 60),
      (p: Pixels) => applyDenoise(p, 60),
      (p: Pixels) => applyDehaze(p, 60),
      (p: Pixels) => applyLens(p, 60),
    ]) {
      const p = ramp();
      const before = Array.from(p.data);
      run(p);
      expect(Array.from(p.data)).not.toEqual(before);
    }
  });

  it("is a no-op at zero, so an untouched control never alters the file", () => {
    const p = ramp();
    const before = Array.from(p.data);
    applySharpen(p, 0);
    applyDenoise(p, 0);
    applyDehaze(p, 0);
    applyLens(p, 0);
    expect(Array.from(p.data)).toEqual(before);
  });

  it("keeps every channel inside range", () => {
    const p = ramp();
    applySharpen(p, 100);
    applyDehaze(p, 100);
    expect(Array.from(p.data).every((v) => v >= 0 && v <= 255)).toBe(true);
  });
});

describe("crop and export presets", () => {
  it("offers Free, Original and the MLS presets", () => {
    const ids = CROP_PRESETS.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining(["free", "original", "1:1", "4:3", "3:2", "16:9", "9:16"]),
    );
    expect(CROP_PRESETS.some((r) => r.group === "mls")).toBe(true);
    expect(cropPreset("4:3")?.v).toBeCloseTo(4 / 3);
    expect(cropPreset("free")?.v).toBeNull();
  });

  it("resizes on the long edge and never upscales", () => {
    expect(exportSize(4000, 3000, 1024)).toEqual({ w: 1024, h: 768 });
    expect(exportSize(800, 600, 1024)).toEqual({ w: 800, h: 600 });
    expect(exportSize(800, 600, 0)).toEqual({ w: 800, h: 600 });
  });

  it("names downloads from the preset", () => {
    expect(exportPreset("mls").maxEdge).toBe(1024);
    expect(exportFileName("Living Room", "mls", 2)).toBe("living-room-v2-mls.jpg");
  });
});

describe("disclosure classification", () => {
  it("escalates to the strongest applicable label", () => {
    expect(classifyEdits({ aiOps: [], hasAdjustments: false })).toBe("Original");
    expect(classifyEdits({ aiOps: [], hasAdjustments: true })).toBe("Enhanced");
    expect(classifyEdits({ aiOps: ["window_balance"], hasAdjustments: true })).toBe("Enhanced");
    expect(classifyEdits({ aiOps: ["window_balance", "sky"], hasAdjustments: true })).toBe(
      "Digitally Altered",
    );
  });

  it("never captions an untouched original", () => {
    expect(disclosureText("Original")).toBeNull();
    expect(disclosureText("Digitally Altered")).toBe("Digitally Altered");
  });
});

describe("quality review", () => {
  it("warns about clipping and over-pushed edits", () => {
    const out = qualityReview({
      stats: { clippedHighlights: 0.09, clippedShadows: 0.05 } as any,
      adj: { exposure: 80, saturation: 60, vibrance: 60 },
      cropArea: 0.1,
      exportWidth: 800,
    });
    const text = out.map((r) => r.message).join(" | ");
    expect(text).toContain("Highlights");
    expect(text).toContain("Shadows");
    expect(text).toContain("Exposure");
    expect(out.some((r) => r.level === "info")).toBe(true);
  });

  it("stays quiet on a clean edit", () => {
    expect(
      qualityReview({
        stats: { clippedHighlights: 0, clippedShadows: 0 } as any,
        adj: { exposure: 8 },
      }),
    ).toEqual([]);
  });
});

describe("adjustment clipboard", () => {
  const bundle: AdjustmentBundle = {
    adj: { exposure: 12 },
    straighten: 3,
    vertical: 4,
    horizontal: 5,
    flipH: true,
    flipV: false,
    rotation: 90,
    crop: { x: 0, y: 0, w: 0.5, h: 0.5, ratio: "1:1" },
  };

  it("pastes light and colour without touching geometry or crop by default", () => {
    const out = mergeBundle({ adj: {}, straighten: 0, crop: null, rotation: 0 }, bundle);
    expect(out.adj).toEqual({ exposure: 12 });
    expect(out.straighten).toBe(0);
    expect(out.crop).toBeNull();
  });

  it("brings geometry and crop when asked", () => {
    const out = mergeBundle({ adj: {}, straighten: 0, crop: null, rotation: 0 }, bundle, {
      includeGeometry: true,
      includeCrop: true,
    });
    expect(out.straighten).toBe(3);
    expect(out.rotation).toBe(90);
    expect(out.crop).toEqual(bundle.crop);
  });
});
