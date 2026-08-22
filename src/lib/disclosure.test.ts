import { describe, expect, it } from "vitest";
import {
  applyBrandKit,
  buildExportAudit,
  captionFor,
  classifyVersion,
  COMPLIANCE_NOTE,
  contrastColors,
  DEFAULT_DISCLOSURE_SETTINGS,
  disclosureCreditCost,
  noDisclosureWarning,
  normalizeSettings,
  overlayLayout,
  planBatchExport,
  publicExportMetadata,
  recommendDisclosure,
  videoDisclosurePlan,
  type DisclosureSettings,
} from "@/lib/disclosure";

const base: DisclosureSettings = { ...DEFAULT_DISCLOSURE_SETTINGS };

describe("1. classification follows the actual operation", () => {
  it("derives from what was applied, not from what the user remembers", () => {
    expect(classifyVersion({})).toBe("Original");
    expect(classifyVersion({ operations: ["crop"], hasAdjustments: true })).toBe("Enhanced");
    expect(classifyVersion({ operations: ["privacy_blur"] })).toBe("Digitally Altered");
    expect(classifyVersion({ operations: ["object_edit"] })).toBe("Digitally Altered");
    expect(classifyVersion({ operations: ["stage"] })).toBe("Virtually Staged");
    expect(classifyVersion({ operations: ["redesign"] })).toBe("Proposed Design");
    expect(classifyVersion({ operations: ["sketch"] })).toBe("AI-Generated Concept");
    expect(classifyVersion({ operations: ["renovation"] })).toBe("Renovation Visualization");
    expect(classifyVersion({ operations: ["markup"] })).toBe("Property Markup");
  });

  it("keeps the strongest classification when operations combine", () => {
    expect(classifyVersion({ operations: ["crop", "stage"], hasAdjustments: true })).toBe(
      "Virtually Staged",
    );
  });
});

describe("2 & 3. recommendations", () => {
  it("recommends the staged disclosure for a staged image", () => {
    const r = recommendDisclosure({ classification: "Virtually Staged" });
    expect(r.id).toBe("staged");
    expect(r.text).toBe("Virtually Staged");
    expect(r.required).toBe(true);
  });

  it("never suggests a staged disclosure for an original", () => {
    const r = recommendDisclosure({ classification: "Original" });
    expect(r.id).toBe("none");
    expect(r.text).toBe("");
  });

  it("warns when a materially altered image is exported with no disclosure", () => {
    expect(noDisclosureWarning("Virtually Staged", "none")).toContain("Virtually Staged");
    expect(noDisclosureWarning("Original", "none")).toBeNull();
    expect(noDisclosureWarning("Enhanced", "none")).toBeNull();
    expect(noDisclosureWarning("Digitally Altered", "altered")).toBeNull();
  });

  it("honours a configured MLS ruleset without claiming compliance", () => {
    const r = recommendDisclosure({
      classification: "Enhanced",
      mls: { id: "stellar", label: "Stellar MLS", requireOnEnhanced: true },
    });
    expect(r.id).toBe("enhanced");
    expect(r.note).toBe(COMPLIANCE_NOTE);
  });
});

describe("4 & 5. clean master, settings and Brand Kit", () => {
  it("keeps disclosure out of the stored version: it is caption-only state", () => {
    const s = normalizeSettings({ ...base, id: "staged" });
    expect(captionFor(s)).toBe("Virtually Staged");
    /* Nothing in settings can point at, or overwrite, the master file. */
    expect(Object.keys(s)).not.toContain("masterPath");
  });

  it("applies the Brand Kit and never leaves a missing-logo placeholder", () => {
    const s = applyBrandKit({ ...base, style: "logo" }, { company: "Cross Realty", color: "#123456" });
    expect(s.companyName).toBe("Cross Realty");
    expect(s.bgColor).toBe("#123456");
    expect(s.style).toBe("translucent");
    const withLogo = applyBrandKit(
      { ...base, style: "logo" },
      { company: "Cross Realty", logoUrl: "data:image/png;base64,xxx" },
    );
    expect(withLogo.style).toBe("logo");
    expect(captionFor(withLogo)).toContain("Cross Realty");
  });
});

describe("6. position, contrast and geometry match the preview", () => {
  it("places the badge at the requested corner with the requested margin", () => {
    const s = normalizeSettings({ ...base, position: "top-right", margin: 0.02, fontScale: 0.03 });
    const box = overlayLayout({ imageW: 2000, imageH: 1000, textWidthRatio: 8, settings: s });
    expect(box.y).toBe(40);
    expect(box.x + box.w).toBe(2000 - 40);
    const bottomLeft = overlayLayout({
      imageW: 2000,
      imageH: 1000,
      textWidthRatio: 8,
      settings: { ...s, position: "bottom-left" },
    });
    expect(bottomLeft.x).toBe(40);
    expect(bottomLeft.y + bottomLeft.h).toBe(1000 - 40);
  });

  it("scales identically for preview and export sizes", () => {
    const small = overlayLayout({ imageW: 1000, imageH: 500, textWidthRatio: 8, settings: base });
    const large = overlayLayout({ imageW: 2000, imageH: 1000, textWidthRatio: 8, settings: base });
    expect(large.fontSize).toBeCloseTo(small.fontSize * 2, 0);
    expect(large.x).toBeCloseTo(small.x * 2, 0);
  });

  it("protects legibility on both light and dark images", () => {
    const light = contrastColors(base, 0.9);
    const dark = contrastColors(base, 0.1);
    expect(light.bgOpacity).toBeGreaterThanOrEqual(0.55);
    expect(light.bgColor).toBe("#000000");
    expect(dark.textColor).toBe("#FFFFFF");
    const off = contrastColors({ ...base, autoContrast: false, bgOpacity: 0.2 }, 0.9);
    expect(off.bgOpacity).toBe(0.2);
  });
});

describe("7. batch exports classify photos independently", () => {
  const items = [
    { id: "a", name: "Living Room", src: "a.jpg", operations: ["stage"] },
    { id: "b", name: "Kitchen Original", src: "b.jpg", operations: [] },
    { id: "c", name: "Facade", src: "c.jpg", operations: ["crop"], hasAdjustments: true },
  ];

  it("gives each photo its own classification and disclosure", () => {
    const plan = planBatchExport({ items, base });
    expect(plan.map((p) => p.classification)).toEqual(["Virtually Staged", "Original", "Enhanced"]);
    expect(plan.map((p) => p.settings.id)).toEqual(["staged", "none", "enhanced"]);
    expect(plan[1]?.caption).toBeNull();
    expect(plan.every((p) => !p.exception)).toBe(true);
  });

  it("surfaces exceptions when one disclosure is forced across the batch", () => {
    const plan = planBatchExport({ items, base, forceId: "staged" });
    const original = plan.find((p) => p.classification === "Original");
    expect(original?.exception).toContain("Original Photograph");
  });
});

describe("9, 11 & 12. cost, compliance copy and audit metadata", () => {
  it("changing the disclosure is free", () => {
    expect(disclosureCreditCost()).toBe(0);
  });

  it("never claims universal MLS compliance", () => {
    expect(COMPLIANCE_NOTE).toMatch(/vary by listing service/i);
    expect(COMPLIANCE_NOTE).not.toMatch(/compliant|guarantee/i);
  });

  it("records the exported version and hides generation prompts", () => {
    const audit = buildExportAudit({
      classification: "Virtually Staged",
      settings: normalizeSettings({ ...base, id: "staged" }),
      preset: "mls",
      scope: "room",
      userId: "user-1",
      assetId: "asset-9",
      versionId: "version-4",
      at: new Date("2026-08-22T10:00:00Z"),
    });
    expect(audit).toMatchObject({
      classification: "Virtually Staged",
      disclosure_id: "staged",
      disclosure_text: "Virtually Staged",
      export_preset: "mls",
      scope: "room",
      exported_by: "user-1",
      asset_id: "asset-9",
      version_id: "version-4",
      exported_at: "2026-08-22T10:00:00.000Z",
    });
    const shared = publicExportMetadata({ ...audit, prompt: "secret", brief: "secret" });
    expect(shared["prompt"]).toBeUndefined();
    expect(shared["brief"]).toBeUndefined();
    expect(shared["classification"]).toBe("Virtually Staged");
  });
});

describe("10. video disclosure placement", () => {
  it("holds the caption for the whole clip when persistent", () => {
    expect(videoDisclosurePlan({ duration: 30, placement: "persistent" })).toEqual([
      { start: 0, end: 30 },
    ]);
  });

  it("shows an opening and closing card for long enough to read", () => {
    const plan = videoDisclosurePlan({ duration: 30, placement: "bookend" });
    expect(plan).toHaveLength(2);
    expect(plan[0]?.end).toBeGreaterThanOrEqual(3);
    expect(plan[1]?.end).toBe(30);
  });

  it("falls back to persistent when the clip is too short to bookend", () => {
    expect(videoDisclosurePlan({ duration: 5, placement: "bookend" })).toEqual([
      { start: 0, end: 5 },
    ]);
  });
});
