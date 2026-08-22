/**
 * The canonical masking engine for the REAL DESIGNS Canvas.
 *
 * Every targeted operation — Object Edit, Materials, Declutter, and later
 * Privacy Blur, Window Balance, Sky, Lawn and Redesign Keep/Replace/Remove —
 * points at part of a photograph and says "change this, leave the rest". That
 * is one problem, so it has one implementation.
 *
 * This module owns:
 *  - the normalized state model (strokes as polylines, detected regions,
 *    selection and protection, inversion, visibility, opacity),
 *  - the geometry that turns state into concrete edit and protect areas,
 *  - the single painter that draws a mask into any 2D context,
 *  - the rasterizer that produces a real full-resolution binary mask for the
 *    backend, not only the translucent overlay the browser shows,
 *  - serialization that refuses a mask drawn on a different source.
 *
 * @/lib/selection-mask stays as the per-tool vocabulary adapter (Declutter says
 * Remove/Keep, Materials says Include/Exclude, Object Edit says Add/Erase/
 * Protect). It maps those names onto the two canonical intents and hands the
 * geometry to this engine. No tool rasterizes or paints a mask itself.
 */

import {
  clamp01,
  type Box,
  type MaskStroke,
  type Region,
  type SelectionIntent,
} from "@/lib/selection-mask";

/* ------------------------------------------------------------- model */

export type NormalizedPoint = { x: number; y: number };

/** What a stroke does. Tools translate their own labels into these. */
export type BrushMode = "add" | "erase" | "protect";

/** One brush path, normalized to the source frame (0..1 on both axes). */
export type BrushStroke = {
  id: string;
  mode: BrushMode;
  points: NormalizedPoint[];
  /** Brush diameter as a fraction of the short edge. */
  size: number;
  /** Soft edge as a fraction of the short edge. */
  feather: number;
};

export type DetectedRegion = {
  id: string;
  label: string;
  confidence: number;
  box?: Box;
  polygon?: NormalizedPoint[];
  maskPath?: string;
};

export type MaskState = {
  sourceAssetId: string;
  sourceVersionId: string;
  strokes: BrushStroke[];
  redo: BrushStroke[];
  selectedRegions: string[];
  protectedRegions: string[];
  inverted: boolean;
  visible: boolean;
  opacity: number;
  /** Positive grows the edit area, negative contracts it, in image fraction. */
  grow: number;
  feather: number;
};

export const MASK_FORMAT_VERSION = 2;
export const MAX_MASK_STROKES = 400;
export const MIN_BRUSH_SIZE = 0.005;
export const MAX_BRUSH_SIZE = 0.4;

/** Colors are shared so the preview, the review image and the mask agree. */
export const MASK_EDIT_FILL = "rgba(255,0,170,0.34)";
export const MASK_EDIT_LINE = "rgba(255,0,170,0.95)";
export const MASK_PROTECT_LINE = "rgba(0,200,120,0.9)";

let seq = 0;
function strokeId(): string {
  seq += 1;
  return "s" + Date.now().toString(36) + seq.toString(36);
}

export function createMaskState(source?: { assetId?: string; versionId?: string }): MaskState {
  return {
    sourceAssetId: source?.assetId || "",
    sourceVersionId: source?.versionId || "",
    strokes: [],
    redo: [],
    selectedRegions: [],
    protectedRegions: [],
    inverted: false,
    visible: true,
    opacity: 0.55,
    grow: 0,
    feather: 0.01,
  };
}

function clampSize(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return MIN_BRUSH_SIZE;
  return Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, n));
}

export function beginStroke(
  state: MaskState,
  mode: BrushMode,
  point: NormalizedPoint,
  opts?: { size?: number; feather?: number },
): MaskState {
  const stroke: BrushStroke = {
    id: strokeId(),
    mode,
    points: [{ x: clamp01(point.x), y: clamp01(point.y) }],
    size: clampSize(opts?.size ?? 0.05),
    feather: Math.max(0, Math.min(0.06, Number(opts?.feather ?? state.feather) || 0)),
  };
  return { ...state, strokes: state.strokes.concat([stroke]).slice(-MAX_MASK_STROKES), redo: [] };
}

/** Adds a point to the open stroke. Sub-pixel jitter is dropped, not stored. */
export function extendStroke(state: MaskState, point: NormalizedPoint): MaskState {
  if (!state.strokes.length) return state;
  const strokes = state.strokes.slice();
  const last = strokes[strokes.length - 1] as BrushStroke;
  const p = { x: clamp01(point.x), y: clamp01(point.y) };
  const prev = last.points[last.points.length - 1] as NormalizedPoint;
  if (Math.abs(prev.x - p.x) < 0.002 && Math.abs(prev.y - p.y) < 0.002) return state;
  strokes[strokes.length - 1] = { ...last, points: last.points.concat([p]) };
  return { ...state, strokes };
}

export function undoStroke(state: MaskState): MaskState {
  if (!state.strokes.length) return state;
  const strokes = state.strokes.slice();
  const last = strokes.pop() as BrushStroke;
  return { ...state, strokes, redo: state.redo.concat([last]) };
}

export function redoStroke(state: MaskState): MaskState {
  if (!state.redo.length) return state;
  const redo = state.redo.slice();
  const back = redo.pop() as BrushStroke;
  return { ...state, strokes: state.strokes.concat([back]), redo };
}

export function clearStrokes(state: MaskState): MaskState {
  return { ...state, strokes: [], redo: [] };
}

export function toggleSelectedRegion(state: MaskState, id: string): MaskState {
  const on = state.selectedRegions.includes(id);
  return {
    ...state,
    selectedRegions: on ? state.selectedRegions.filter((x) => x !== id) : state.selectedRegions.concat([id]),
    protectedRegions: state.protectedRegions.filter((x) => x !== id),
  };
}

export function toggleProtectedRegion(state: MaskState, id: string): MaskState {
  const on = state.protectedRegions.includes(id);
  return {
    ...state,
    protectedRegions: on ? state.protectedRegions.filter((x) => x !== id) : state.protectedRegions.concat([id]),
    selectedRegions: state.selectedRegions.filter((x) => x !== id),
  };
}

export function setInverted(state: MaskState, on: boolean): MaskState {
  return { ...state, inverted: !!on };
}

export function setVisible(state: MaskState, on: boolean): MaskState {
  return { ...state, visible: !!on };
}

export function setOpacity(state: MaskState, value: number): MaskState {
  return { ...state, opacity: Math.max(0.1, Math.min(1, Number(value) || 0.55)) };
}

/* --------------------------------------------------------- geometry */

/** The circles a polyline stroke actually covers, in normalized space. */
export function strokeDabs(stroke: BrushStroke): Array<{ x: number; y: number; r: number }> {
  const r = stroke.size;
  const out: Array<{ x: number; y: number; r: number }> = [];
  const pts = stroke.points;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i] as NormalizedPoint;
    out.push({ x: p.x, y: p.y, r });
    const next = pts[i + 1];
    if (!next) continue;
    /* Interpolate so a fast drag is a continuous band, not dotted circles. */
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.min(64, Math.floor(dist / Math.max(r / 2, 0.004)));
    for (let s = 1; s <= steps; s += 1) {
      out.push({ x: p.x + (dx * s) / (steps + 1), y: p.y + (dy * s) / (steps + 1), r });
    }
  }
  return out;
}

/** The bounding box of any region shape, whichever form it arrived in. */
export function regionBox(region: DetectedRegion): Box {
  if (region.box) return region.box;
  const poly = region.polygon || [];
  if (!poly.length) return { x: 0, y: 0, w: 1, h: 1 };
  const xs = poly.map((p) => clamp01(p.x));
  const ys = poly.map((p) => clamp01(p.y));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(0.005, Math.max(...xs) - x), h: Math.max(0.005, Math.max(...ys) - y) };
}

/** Fraction of the frame the edit area covers — the honest "how big is this". */
export function maskCoverage(paint: MaskPaint): number {
  let area = 0;
  paint.edit.forEach((r) => {
    area += r.box.w * r.box.h;
  });
  paint.editStrokes.forEach((s) => {
    area += Math.PI * s.r * s.r;
  });
  return Math.min(1, area);
}

export function isMaskEmpty(paint: MaskPaint): boolean {
  return !paint.edit.length && !paint.editStrokes.length;
}

/** A mask only belongs to the image it was drawn on. */
export function isMaskStale(state: MaskState, assetId: string, versionId: string): boolean {
  if (!state.sourceAssetId && !state.sourceVersionId) return false;
  return state.sourceAssetId !== assetId || state.sourceVersionId !== versionId;
}

/* ------------------------------------------------------ paint model */

export type Dab = { x: number; y: number; r: number };

/**
 * The resolved thing every renderer draws: what may change, what must not, and
 * the brush work on both sides. Tools build this from their own vocabulary via
 * `paintFromLegacy`, so the preview, the review image and the backend mask are
 * always the same geometry.
 */
export type MaskPaint = {
  edit: Region[];
  protect: Region[];
  editStrokes: Dab[];
  protectStrokes: Dab[];
  feather: number;
  opacity: number;
};

/** Builds the paint model from a tool's dab-based mask and resolved regions. */
export function paintFromLegacy<K extends string>(input: {
  edit: Region[];
  protect: Region[];
  strokes: Array<MaskStroke<K>>;
  intent: (kind: K) => SelectionIntent;
  feather?: number;
  opacity?: number;
}): MaskPaint {
  return {
    edit: input.edit.map((r) => ({ label: r.label, box: { ...r.box } })),
    protect: input.protect.map((r) => ({ label: r.label, box: { ...r.box } })),
    editStrokes: input.strokes.filter((s) => input.intent(s.kind) === "include").map((s) => ({ x: s.x, y: s.y, r: s.r })),
    protectStrokes: input.strokes.filter((s) => input.intent(s.kind) === "exclude").map((s) => ({ x: s.x, y: s.y, r: s.r })),
    feather: Math.max(0, Number(input.feather) || 0),
    opacity: Math.max(0.1, Math.min(1, Number(input.opacity) || 1)),
  };
}

/** Builds the paint model from canonical state and its detected regions. */
export function paintFromState(state: MaskState, regions: DetectedRegion[]): MaskPaint {
  const byId = new Map(regions.map((r) => [r.id, r]));
  const asRegion = (id: string): Region | null => {
    const r = byId.get(id);
    return r ? { label: r.label, box: regionBox(r) } : null;
  };
  const selected = state.selectedRegions.map(asRegion).filter(Boolean) as Region[];
  const guarded = state.protectedRegions.map(asRegion).filter(Boolean) as Region[];
  const dabs = (mode: BrushMode | BrushMode[]) => {
    const list = Array.isArray(mode) ? mode : [mode];
    return state.strokes.filter((s) => list.includes(s.mode)).flatMap(strokeDabs);
  };
  return {
    edit: state.inverted ? guarded : selected,
    protect: state.inverted ? selected : guarded,
    editStrokes: dabs("add"),
    protectStrokes: dabs(["protect", "erase"]),
    feather: state.feather,
    opacity: state.visible ? state.opacity : 0,
  };
}

/* --------------------------------------------------------- rendering */

type Ctx2D = {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  arc: (x: number, y: number, r: number, a: number, b: number) => void;
  fill: () => void;
  stroke: () => void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
};

/**
 * The one painter. `style` picks the fidelity:
 *  - "overlay": translucent magenta target, green protection outlines (panel)
 *  - "review":  opaque magenta target over the photo (what the user approves)
 *  - "binary":  white target on black — the real mask sent to the backend
 */
export function paintMaskLayer(
  ctx: Ctx2D,
  W: number,
  H: number,
  paint: MaskPaint,
  style: "overlay" | "review" | "binary" = "overlay",
) {
  const line = Math.max(2, Math.round(W / 320));
  if (style === "binary") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
  }
  if (style === "overlay" && paint.opacity <= 0) return;

  const editFill =
    style === "binary" ? "#ffffff" : style === "review" ? "rgba(255,0,170,0.72)" : MASK_EDIT_FILL;
  const protectFill = "#000000";

  paint.edit.forEach((r) => {
    ctx.fillStyle = editFill;
    ctx.fillRect(r.box.x * W, r.box.y * H, r.box.w * W, r.box.h * H);
    if (style === "overlay") {
      ctx.strokeStyle = MASK_EDIT_LINE;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.box.x * W, r.box.y * H, r.box.w * W, r.box.h * H);
    }
  });

  paint.editStrokes.forEach((s) => {
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r * Math.min(W, H), 0, Math.PI * 2);
    ctx.fillStyle = editFill;
    ctx.fill();
  });

  /* Protection is subtractive in the binary mask and advisory in the previews. */
  paint.protect.forEach((r) => {
    if (style === "binary") {
      ctx.fillStyle = protectFill;
      ctx.fillRect(r.box.x * W, r.box.y * H, r.box.w * W, r.box.h * H);
      return;
    }
    ctx.strokeStyle = style === "review" ? "rgba(0,220,130,0.95)" : MASK_PROTECT_LINE;
    ctx.lineWidth = style === "review" ? line : 2;
    ctx.strokeRect(r.box.x * W, r.box.y * H, r.box.w * W, r.box.h * H);
  });

  paint.protectStrokes.forEach((s) => {
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r * Math.min(W, H), 0, Math.PI * 2);
    if (style === "binary") {
      ctx.fillStyle = protectFill;
      ctx.fill();
      return;
    }
    if (style === "review") {
      ctx.strokeStyle = "rgba(0,220,130,0.95)";
      ctx.lineWidth = line;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = "rgba(0,200,120,0.32)";
    ctx.fill();
  });
}

/* -------------------------------------------------------- rasterizer */

export type MaskAssets = {
  /** The source photo with the mask burnt over it, for review and the model. */
  overlay: string | null;
  /** A real binary mask at the source resolution: white edits, black protects. */
  mask: string | null;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    } catch (_) {
      resolve(null);
    }
  });
}

/** Hard ceiling so a huge original cannot blow the tab up during export. */
export const MAX_MASK_EDGE = 4096;

/**
 * Renders both assets from one geometry: the review overlay and the real
 * full-resolution binary mask. The mask is produced at the source pixel size
 * (capped only by MAX_MASK_EDGE), never at the small panel preview size.
 */
export async function renderMaskAssets(
  src: string,
  paint: MaskPaint,
  opts?: { overlayMaxW?: number },
): Promise<MaskAssets> {
  const img = await loadImage(src);
  if (!img || typeof document === "undefined") return { overlay: null, mask: null, width: 0, height: 0 };
  const natW = img.naturalWidth || img.width || 0;
  const natH = img.naturalHeight || img.height || 0;
  if (!natW || !natH) return { overlay: null, mask: null, width: 0, height: 0 };

  const cap = Math.min(1, MAX_MASK_EDGE / Math.max(natW, natH));
  const MW = Math.max(16, Math.round(natW * cap));
  const MH = Math.max(16, Math.round(natH * cap));

  let mask: string | null = null;
  try {
    const mc = document.createElement("canvas");
    mc.width = MW;
    mc.height = MH;
    const mctx = mc.getContext("2d");
    if (mctx) {
      paintMaskLayer(mctx as unknown as Ctx2D, MW, MH, paint, "binary");
      mask = mc.toDataURL("image/png");
    }
  } catch (_) {
    mask = null;
  }

  let overlay: string | null = null;
  try {
    const maxW = opts?.overlayMaxW ?? 1600;
    const scale = Math.min(1, maxW / natW);
    const W = Math.max(16, Math.round(natW * scale));
    const H = Math.max(16, Math.round(natH * scale));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, W, H);
      paintMaskLayer(ctx as unknown as Ctx2D, W, H, paint, "review");
      overlay = c.toDataURL("image/jpeg", 0.9);
    }
  } catch (_) {
    overlay = null;
  }

  return { overlay, mask, width: MW, height: MH };
}

/* ------------------------------------------------------ serialization */

export type SerializedMask = {
  v: number;
  sourceAssetId: string;
  sourceVersionId: string;
  strokes: BrushStroke[];
  selectedRegions: string[];
  protectedRegions: string[];
  inverted: boolean;
  visible: boolean;
  opacity: number;
  grow: number;
  feather: number;
};

export function serializeMask(state: MaskState): SerializedMask {
  return {
    v: MASK_FORMAT_VERSION,
    sourceAssetId: state.sourceAssetId,
    sourceVersionId: state.sourceVersionId,
    strokes: state.strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })),
    selectedRegions: state.selectedRegions.slice(),
    protectedRegions: state.protectedRegions.slice(),
    inverted: state.inverted,
    visible: state.visible,
    opacity: state.opacity,
    grow: state.grow,
    feather: state.feather,
  };
}

/**
 * Rehydrates a saved mask. Version 1 stored round dabs; those upgrade to
 * single-point polylines rather than being thrown away.
 */
export function deserializeMask(raw: unknown): MaskState {
  const base = createMaskState();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  const strokes: BrushStroke[] = Array.isArray(d["strokes"])
    ? (d["strokes"] as unknown[])
        .map((s) => {
          const o = (s || {}) as Record<string, unknown>;
          if (Array.isArray(o["points"])) {
            return {
              id: String(o["id"] || strokeId()),
              mode: (["add", "erase", "protect"].includes(String(o["mode"])) ? o["mode"] : "add") as BrushMode,
              points: (o["points"] as unknown[]).map((p) => {
                const q = (p || {}) as Record<string, unknown>;
                return { x: clamp01(q["x"]), y: clamp01(q["y"]) };
              }),
              size: clampSize(o["size"]),
              feather: Math.max(0, Math.min(0.06, Number(o["feather"]) || 0)),
            };
          }
          /* legacy dab */
          return {
            id: strokeId(),
            mode: (String(o["kind"]) === "add" || String(o["kind"]) === "include" || String(o["kind"]) === "remove"
              ? "add"
              : "protect") as BrushMode,
            points: [{ x: clamp01(o["x"]), y: clamp01(o["y"]) }],
            size: clampSize(o["r"]),
            feather: 0,
          };
        })
        .filter((s) => s.points.length > 0)
        .slice(-MAX_MASK_STROKES)
    : [];
  return {
    ...base,
    sourceAssetId: String(d["sourceAssetId"] || ""),
    sourceVersionId: String(d["sourceVersionId"] || ""),
    strokes,
    selectedRegions: Array.isArray(d["selectedRegions"]) ? (d["selectedRegions"] as string[]).map(String) : [],
    protectedRegions: Array.isArray(d["protectedRegions"]) ? (d["protectedRegions"] as string[]).map(String) : [],
    inverted: d["inverted"] === true,
    visible: d["visible"] !== false,
    opacity: Math.max(0.1, Math.min(1, Number(d["opacity"]) || 0.55)),
    grow: Math.max(-0.08, Math.min(0.08, Number(d["grow"]) || 0)),
    feather: Math.max(0, Math.min(0.06, Number(d["feather"]) || 0.01)),
  };
}

/* --------------------------------------------------- painting surface */

export type PaintSurfaceOpts<K extends string> = {
  /** Current brush name in the tool's own vocabulary. */
  brush: () => K;
  /** Brush radius as a fraction of the frame. */
  size: () => number;
  /** Called with each dab so the tool can push it into its own mask state. */
  onDab: (dab: MaskStroke<K>) => void;
  /** Called after each dab so the panel repaints. */
  onPaint: () => void;
  /** Called once when the pointer is released. */
  onDone: () => void;
};

/**
 * The single brush binding. Object Edit, Materials and Declutter all attach the
 * same pointer behaviour to their preview canvas: press to start, drag to
 * continue, release to commit. The Canvas stage itself is untouched.
 */
export function bindMaskPainting<K extends string>(wrap: HTMLElement, opts: PaintSurfaceOpts<K>) {
  let painting = false;
  const dabAt = (ev: PointerEvent) => {
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    opts.onDab({
      x: (ev.clientX - rect.left) / rect.width,
      y: (ev.clientY - rect.top) / rect.height,
      r: opts.size(),
      kind: opts.brush(),
    } as MaskStroke<K>);
    opts.onPaint();
  };
  wrap.addEventListener("pointerdown", (ev) => {
    painting = true;
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    dabAt(ev);
    ev.preventDefault();
  });
  wrap.addEventListener("pointermove", (ev) => {
    if (painting) dabAt(ev);
  });
  const stop = () => {
    if (!painting) return;
    painting = false;
    opts.onDone();
  };
  wrap.addEventListener("pointerup", stop);
  wrap.addEventListener("pointerleave", stop);
}
