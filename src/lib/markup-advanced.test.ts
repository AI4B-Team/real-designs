import { describe, expect, it } from "vitest";
import {
  canMeasure,
  createLayer,
  emptyDoc,
  exportLayers,
  layerMeasurement,
  markupExportManifest,
  parseMarkup,
  refreshMeasurements,
  serializeMarkup,
} from "@/lib/markup";
import { calibrateScale } from "@/lib/markup-measure";
import { calloutLabel, calloutLink, emptyCallout } from "@/lib/markup-callouts";
import { PARCEL_WARNING, buildOverlay, validateParcelResponse } from "@/lib/parcel";

const cal = () => {
  const out = calibrateScale({
    a: { x: 0.1, y: 0.5 },
    b: { x: 0.6, y: 0.5 },
    realLength: 50,
    unit: "ft",
    imageWidth: 2000,
    imageHeight: 1500,
  });
  if (!out.ok) throw new Error(out.error);
  return out.calibration;
};

describe("advanced markup", () => {
  it("refuses to measure before the photograph has a scale", () => {
    const doc = emptyDoc("a1", null);
    const layer = createLayer("distance", [
      { x: 0.1, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ]);
    expect(canMeasure(doc)).toBe(false);
    const out = layerMeasurement(layer, doc);
    expect(out?.measurements).toEqual([]);
    expect(out?.message).toMatch(/Calibrate Scale/i);
  });

  it("labels every calculated value as approximate once calibrated", () => {
    const base = emptyDoc("a1", null);
    const layer = createLayer("distance", [
      { x: 0.1, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ]);
    const doc = refreshMeasurements({ ...base, scale: cal(), layers: [layer] });
    const text = doc.layers[0]!.measurementText || "";
    expect(text).toContain("≈");
    expect(text).toContain("ft");
  });

  it("keeps callouts structured and links them to their module", () => {
    const meta = { ...emptyCallout("product"), productName: "Pendant Light", price: 240, productId: "p1" } as any;
    expect(calloutLabel(meta)).toContain("Pendant Light");
    expect(calloutLink(meta)).toEqual({ module: "products", id: "p1" });
  });

  it("survives a save and reload with scale, callouts and parcel intact", () => {
    const doc = {
      ...emptyDoc("a1", null),
      scale: cal(),
      layers: [{ ...createLayer("renovation", [{ x: 0.4, y: 0.4 }]), meta: emptyCallout("renovation") }],
    };
    const back = parseMarkup(serializeMarkup(doc), "a1");
    expect(back.scale?.unitsPerPixel).toBeCloseTo(doc.scale.unitsPerPixel);
    expect(back.layers[0]?.meta?.kind).toBe("renovation");
  });

  it("exports only the layers a scope export is allowed to show", () => {
    const doc = {
      ...emptyDoc("a1", null),
      layers: [
        createLayer("renovation", [{ x: 0.2, y: 0.2 }]),
        createLayer("boundary", [
          { x: 0.1, y: 0.1 },
          { x: 0.4, y: 0.1 },
          { x: 0.4, y: 0.4 },
        ]),
      ],
    };
    expect(exportLayers(doc, "clean").length).toBe(0);
    expect(exportLayers(doc, "contractor_scope").map((l) => l.type)).toEqual(["renovation"]);
    const manifest = markupExportManifest(doc, "image");
    expect(manifest.is_survey).toBe(false);
    expect(manifest.editable_document).toBeTruthy();
    expect(manifest.warnings.join(" ")).toMatch(/not a survey/i);
  });

  it("never accepts parcel geometry without provider provenance", () => {
    expect(validateParcelResponse({ geometry: { ring: [[0, 0], [1, 0], [1, 1]] } }).ok).toBe(false);
    const good = validateParcelResponse({
      provider: "County GIS",
      parcel_id: "02-01",
      retrieved_at: new Date().toISOString(),
      address: "1 Ocean Drive",
      geometry: { ring: [[-80.1, 25.7], [-80.09, 25.7], [-80.09, 25.71]] },
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    const overlay = buildOverlay(good.record, { kind: "none" });
    expect(overlay.confidence).toBe("unaligned");
    expect(PARCEL_WARNING.toLowerCase()).toContain("not a survey");
  });
});
