/**
 * REAL DESIGNS — the one renderer that bakes a disclosure into exported pixels.
 *
 * Preview and export call the same function with the same settings, so the
 * badge in the preview is the badge in the file. The clean master is never
 * touched: this always returns a new image.
 */

import {
  captionFor,
  contrastColors,
  normalizeSettings,
  overlayLayout,
  type DisclosureSettings,
} from "@/lib/disclosure";

const FONT = '600 %spx "DM Sans", system-ui, -apple-system, sans-serif';

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That Image Could Not Be Loaded."));
    img.src = src;
  });
}

/** Average brightness (0..1) of the region the badge will cover. */
export function sampleLuma(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  try {
    const sx = Math.max(0, Math.round(x));
    const sy = Math.max(0, Math.round(y));
    const sw = Math.max(1, Math.round(w));
    const sh = Math.max(1, Math.round(h));
    const data = ctx.getImageData(sx, sy, sw, sh).data;
    let sum = 0;
    let n = 0;
    /* Sample every 16th pixel: plenty for a contrast decision. */
    for (let i = 0; i < data.length; i += 64) {
      sum +=
        (0.2126 * (data[i] || 0) + 0.7152 * (data[i + 1] || 0) + 0.0722 * (data[i + 2] || 0)) / 255;
      n++;
    }
    return n ? sum / n : 0.5;
  } catch {
    return 0.5;
  }
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex || "").trim());
  let r = 0;
  let g = 0;
  let b = 0;
  if (m) {
    const v = m[1] as string;
    const full = v.length === 3 ? v.replace(/./g, (ch) => ch + ch) : v;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * Draw the disclosure badge onto an existing canvas in place.
 * Returns the caption drawn, or null when nothing was drawn.
 */
export function drawDisclosure(
  canvas: HTMLCanvasElement,
  settingsIn: DisclosureSettings,
  logo?: HTMLImageElement | null,
): string | null {
  const settings = normalizeSettings({
    ...settingsIn,
    ...(logo ? {} : settingsIn.style === "logo" ? { style: "translucent" as const } : {}),
  });
  const caption = captionFor(settings);
  if (!caption) return null;
  const c = canvas.getContext("2d");
  if (!c) return null;

  const long = Math.max(canvas.width, canvas.height) || 1;
  const probe = Math.max(11, Math.round(long * settings.fontScale));
  c.save();
  c.font = FONT.replace("%s", String(probe));
  const textWidthRatio = c.measureText(caption).width / probe;
  const box = overlayLayout({
    imageW: canvas.width,
    imageH: canvas.height,
    textWidthRatio,
    settings,
  });
  const luma = sampleLuma(c, box.x, box.y, box.w, box.h);
  const colors = contrastColors(settings, luma);

  if (colors.bgOpacity > 0) {
    c.fillStyle = hexToRgba(colors.bgColor, colors.bgOpacity);
    roundRect(c, box.x, box.y, box.w, box.h, box.radius);
    c.fill();
  }
  if (box.logo && logo) {
    try {
      const ratio = (logo.naturalWidth || 1) / (logo.naturalHeight || 1);
      const h = box.logo.size;
      const w = Math.max(1, Math.round(h * ratio));
      c.drawImage(logo, box.logo.x, box.logo.y, w, h);
    } catch {
      /* a broken logo never blocks the disclosure */
    }
  }
  c.font = FONT.replace("%s", String(box.fontSize));
  c.textBaseline = "middle";
  if (colors.bgOpacity === 0) {
    /* Text-only badges get a soft shadow so they survive busy photographs. */
    c.shadowColor = "rgba(0,0,0,.55)";
    c.shadowBlur = Math.round(box.fontSize * 0.5);
  }
  c.fillStyle = colors.textColor;
  c.fillText(caption, box.textX, box.textY);
  c.restore();
  return caption;
}

export type BakeOptions = {
  maxEdge?: number;
  quality?: number;
  /** Preloaded company logo, when the style asks for one. */
  logo?: HTMLImageElement | null;
};

/** Copy an image, size it, bake the disclosure and return a JPEG data URL. */
export async function bakeDisclosure(
  src: string,
  settings: DisclosureSettings,
  opts: BakeOptions = {},
): Promise<{ dataUrl: string; caption: string | null; width: number; height: number }> {
  const img = await loadImageEl(src);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const maxEdge = opts.maxEdge || 0;
  const k = maxEdge && Math.max(iw, ih) > maxEdge ? maxEdge / Math.max(iw, ih) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(iw * k));
  canvas.height = Math.max(1, Math.round(ih * k));
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Rendering Is Unavailable In This Browser.");
  c.imageSmoothingQuality = "high";
  c.drawImage(img, 0, 0, canvas.width, canvas.height);
  let logo: HTMLImageElement | null = opts.logo ?? null;
  if (!logo && settings.style === "logo" && settings.logoUrl) {
    logo = await loadImageEl(settings.logoUrl).catch(() => null);
  }
  const caption = drawDisclosure(canvas, settings, logo);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", opts.quality ?? 0.92),
    caption,
    width: canvas.width,
    height: canvas.height,
  };
}

/** Small, fast render used by the export sheet's live preview. */
export function previewDisclosure(src: string, settings: DisclosureSettings): Promise<string> {
  return bakeDisclosure(src, settings, { maxEdge: 900, quality: 0.85 }).then((r) => r.dataUrl);
}
