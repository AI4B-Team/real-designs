/**
 * One painter for Property Markup.
 *
 * The overlay the user draws on, the preview shown before export and the
 * flattened pixels in the downloaded file all come out of `drawMarkup`. That is
 * the only way "export matches preview" can be true rather than hoped for.
 */

import {
  MARKUP_DISCLOSURE_TEXT,
  clampLabelBox,
  dashPattern,
  labelAnchor,
  markupType,
  scaledFontSize,
  scaledStroke,
  toPixels,
  visibleLayers,
  type MarkupDoc,
  type MarkupLayer,
  type Point,
} from "@/lib/markup";

export type DrawOptions = {
  /** Draw vertex handles and the draft rubber band: editor only. */
  interactive?: boolean;
  selectedId?: string | null;
  /** Unfinished polygon being clicked out, plus the live pointer position. */
  draft?: { type: string; points: Point[]; pointer?: Point | null; color?: string } | null;
  /** Burn "Approximate Boundary" into the frame. */
  visibleDisclosure?: boolean;
};

function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const v = parseInt(m[1] as string, 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

function path(ctx: CanvasRenderingContext2D, pts: Point[], W: number, H: number, close: boolean) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = toPixels(p, W, H);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  if (close) ctx.closePath();
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(a - Math.PI / 7), to.y - size * Math.sin(a - Math.PI / 7));
  ctx.lineTo(to.x - size * Math.cos(a + Math.PI / 7), to.y - size * Math.sin(a + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

/** Draw one label chip, clamped so it can never leave the exported frame. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  layer: MarkupLayer,
  W: number,
  H: number,
): { x: number; y: number; w: number; h: number } | null {
  const text = layer.shape === "marker" ? `${layer.number ?? 1}${layer.label ? ` · ${layer.label}` : ""}` : layer.label;
  if (!text) return null;
  const fs = scaledFontSize(layer.style.fontSize, W);
  ctx.font = `600 ${fs}px "DM Sans", system-ui, sans-serif`;
  const padX = Math.round(fs * 0.55);
  const padY = Math.round(fs * 0.34);
  const tw = ctx.measureText(text).width;
  const anchor = toPixels(labelAnchor(layer), W, H);
  const box = clampLabelBox(
    {
      x: anchor.x - (tw + padX * 2) / 2,
      y: anchor.y - (fs + padY * 2) / 2,
      w: tw + padX * 2,
      h: fs + padY * 2,
    },
    W,
    H,
    Math.round(W * 0.005),
  );
  if (layer.style.labelBackground) {
    ctx.fillStyle = rgba(layer.style.labelBg, 0.82);
    const r = Math.min(box.h / 2, fs * 0.5);
    ctx.beginPath();
    ctx.moveTo(box.x + r, box.y);
    ctx.lineTo(box.x + box.w - r, box.y);
    ctx.quadraticCurveTo(box.x + box.w, box.y, box.x + box.w, box.y + r);
    ctx.lineTo(box.x + box.w, box.y + box.h - r);
    ctx.quadraticCurveTo(box.x + box.w, box.y + box.h, box.x + box.w - r, box.y + box.h);
    ctx.lineTo(box.x + r, box.y + box.h);
    ctx.quadraticCurveTo(box.x, box.y + box.h, box.x, box.y + box.h - r);
    ctx.lineTo(box.x, box.y + r);
    ctx.quadraticCurveTo(box.x, box.y, box.x + r, box.y);
    ctx.closePath();
    ctx.fill();
  } else {
    /* Without a plate the text still has to survive a bright photograph. */
    ctx.shadowColor = "rgba(0,0,0,.75)";
    ctx.shadowBlur = Math.max(2, fs * 0.25);
  }
  ctx.fillStyle = layer.style.labelColor;
  ctx.textBaseline = "middle";
  ctx.fillText(text, box.x + padX, box.y + box.h / 2);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  return box;
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  layer: MarkupLayer,
  W: number,
  H: number,
  o: DrawOptions,
) {
  const pts = layer.points;
  if (!pts.length) return;
  const width = scaledStroke(layer.style.strokeWidth, W);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = layer.style.stroke;
  ctx.setLineDash(dashPattern(layer.style.dash, W).map((d) => d));

  if (layer.shape === "polygon") {
    path(ctx, pts, W, H, true);
    if (layer.style.fillOpacity > 0) {
      ctx.fillStyle = rgba(layer.style.fill, layer.style.fillOpacity);
      ctx.fill();
    }
    ctx.stroke();
  } else if (layer.shape === "line" || layer.shape === "arrow") {
    path(ctx, pts, W, H, false);
    ctx.stroke();
    if (layer.shape === "arrow" && layer.style.arrowHead !== "none") {
      ctx.setLineDash([]);
      ctx.fillStyle = layer.style.stroke;
      const size = width * 3.4;
      const a = toPixels(pts[pts.length - 2] || pts[0]!, W, H);
      const b = toPixels(pts[pts.length - 1]!, W, H);
      arrowHead(ctx, a, b, size);
      if (layer.style.arrowHead === "both") {
        const c = toPixels(pts[1] || pts[0]!, W, H);
        arrowHead(ctx, c, toPixels(pts[0]!, W, H), size);
      }
    }
  } else if (layer.shape === "marker") {
    const p = toPixels(pts[0]!, W, H);
    const r = Math.max(10, scaledFontSize(layer.style.fontSize, W) * 0.95);
    ctx.setLineDash([]);
    ctx.fillStyle = layer.style.stroke;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, width * 0.5);
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${Math.round(r * 1.1)}px "DM Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(layer.number ?? 1), p.x, p.y + r * 0.04);
    ctx.textAlign = "left";
  }
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  if (layer.shape === "marker") {
    /* The number is already inside the pin; only the short label sits beside it. */
    if (layer.label) {
      const chip = { ...layer, number: undefined as unknown as number };
      drawLabel(ctx, { ...chip, label: layer.label, labelOffset: layer.labelOffset ?? { x: 0.035, y: 0 } }, W, H);
    }
  } else {
    drawLabel(ctx, layer, W, H);
  }
  ctx.restore();

  if (o.interactive) {
    const selected = o.selectedId === layer.id;
    ctx.save();
    pts.forEach((p) => {
      const q = toPixels(p, W, H);
      const r = selected ? Math.max(5, W * 0.007) : Math.max(3.5, W * 0.005);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#FFFFFF" : "rgba(255,255,255,.85)";
      ctx.fill();
      ctx.lineWidth = Math.max(1, W * 0.0018);
      ctx.strokeStyle = layer.style.stroke;
      ctx.stroke();
    });
    ctx.restore();
  }
}

/** Paint a whole markup document into any 2D context at any resolution. */
export function drawMarkup(
  ctx: CanvasRenderingContext2D,
  doc: MarkupDoc,
  W: number,
  H: number,
  o: DrawOptions = {},
): void {
  for (const layer of visibleLayers(doc)) drawOne(ctx, layer, W, H, o);

  if (o.draft && o.draft.points.length) {
    const color = o.draft.color || "#CC0000";
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = scaledStroke(3, W);
    ctx.setLineDash([W * 0.008, W * 0.006]);
    const live = o.draft.pointer ? [...o.draft.points, o.draft.pointer] : o.draft.points;
    path(ctx, live, W, H, false);
    ctx.stroke();
    ctx.setLineDash([]);
    o.draft.points.forEach((p, i) => {
      const q = toPixels(p, W, H);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(4, W * (i === 0 ? 0.008 : 0.005)), 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? color : "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, W * 0.002);
      ctx.stroke();
    });
    ctx.restore();
  }

  if (o.visibleDisclosure ?? doc.visibleDisclosure) {
    const fs = scaledFontSize(15, W);
    ctx.save();
    ctx.font = `600 ${fs}px "DM Sans", system-ui, sans-serif`;
    const tw = ctx.measureText(MARKUP_DISCLOSURE_TEXT).width;
    const pad = Math.round(fs * 0.5);
    const box = clampLabelBox(
      { x: W - tw - pad * 2 - fs, y: fs * 0.8, w: tw + pad * 2, h: fs * 1.9 },
      W,
      H,
      Math.round(W * 0.01),
    );
    ctx.fillStyle = "rgba(10,10,10,.72)";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(MARKUP_DISCLOSURE_TEXT, box.x + pad, box.y + box.h / 2);
    ctx.restore();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("That photo could not be loaded."));
    img.src = src;
  });
}

/**
 * Flatten markup into exported pixels. The source data URL is never mutated:
 * the clean master stays exactly as it was, this returns a new image.
 */
export async function flattenMarkup(
  src: string,
  doc: MarkupDoc,
  opts: { quality?: number } = {},
): Promise<string> {
  if (!doc.layers.some((l) => l.visible)) return src;
  const img = await loadImage(src);
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth || img.width;
  cv.height = img.naturalHeight || img.height;
  const ctx = cv.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  drawMarkup(ctx, doc, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", opts.quality ?? 0.94);
}

export { rgba as markupRgba };

/** Markup names its own type so a type spec is never duplicated in the UI. */
export const layerTypeLabel = (l: MarkupLayer) => markupType(l.type).label;
