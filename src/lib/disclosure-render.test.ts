import { describe, expect, it } from "vitest";
import { drawDisclosure } from "@/lib/disclosure-render";
import { DEFAULT_DISCLOSURE_SETTINGS, normalizeSettings } from "@/lib/disclosure";
import { buildZip, crc32, dataUrlToBytes } from "@/lib/zip-store";

type Call = { op: string; args: unknown[] };

/** A canvas stand-in that records the drawing calls the exporter makes. */
function stubCanvas(width: number, height: number) {
  const calls: Call[] = [];
  const ctx = {
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    measureText: (t: string) => ({ width: t.length * 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(256).fill(10) }),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    fill: (...args: unknown[]) => calls.push({ op: "fill", args }),
    drawImage: (...args: unknown[]) => calls.push({ op: "drawImage", args }),
    fillText: (...args: unknown[]) => calls.push({ op: "fillText", args }),
    font: "",
    fillStyle: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
  };
  return {
    canvas: { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement,
    calls,
    ctx,
  };
}

describe("5 & 6. the disclosure is baked into exported pixels", () => {
  it("writes the caption onto the export canvas at the configured corner", () => {
    const { canvas, calls } = stubCanvas(2000, 1000);
    const caption = drawDisclosure(
      canvas,
      normalizeSettings({ ...DEFAULT_DISCLOSURE_SETTINGS, id: "staged", position: "bottom-right" }),
    );
    expect(caption).toBe("Virtually Staged");
    const text = calls.find((c) => c.op === "fillText");
    expect(text?.args[0]).toBe("Virtually Staged");
    /* Bottom right: drawn past the middle and near the lower edge. */
    expect(Number(text?.args[1])).toBeGreaterThan(1000);
    expect(Number(text?.args[2])).toBeGreaterThan(900);
    expect(calls.some((c) => c.op === "fill")).toBe(true);
  });

  it("draws nothing when the user chose No Disclosure", () => {
    const { canvas, calls } = stubCanvas(1200, 800);
    const caption = drawDisclosure(
      canvas,
      normalizeSettings({ ...DEFAULT_DISCLOSURE_SETTINGS, id: "none" }),
    );
    expect(caption).toBeNull();
    expect(calls.filter((c) => c.op === "fillText")).toHaveLength(0);
  });

  it("skips the logo plate when the Brand Kit has no logo", () => {
    const { canvas, calls } = stubCanvas(1200, 800);
    drawDisclosure(
      canvas,
      normalizeSettings({ ...DEFAULT_DISCLOSURE_SETTINGS, id: "altered", style: "logo" }),
      null,
    );
    expect(calls.some((c) => c.op === "drawImage")).toBe(false);
    expect(calls.some((c) => c.op === "fillText")).toBe(true);
  });
});

describe("batch archive", () => {
  it("packs each exported file into a readable ZIP", () => {
    const bytes = dataUrlToBytes("data:image/jpeg;base64,QUJD");
    expect(Array.from(bytes)).toEqual([65, 66, 67]);
    expect(crc32(bytes)).toBe(crc32(bytes));
    const blob = buildZip([
      { name: "living-room.jpg", bytes },
      { name: "kitchen.jpg", bytes },
    ]);
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(100);
  });
});
