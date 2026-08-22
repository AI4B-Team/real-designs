/**
 * The single selection and mask foundation for REAL DESIGNS.
 *
 * Object Edit, Materials and Declutter all let a user point at part of a photo
 * and say "change this, leave everything else". That is one problem, so it has
 * one implementation. This module owns the geometry: normalized boxes, brush
 * strokes, undo and redo history, edge expansion and feathering, inversion, and
 * the region maths that decides what the backend is told to edit and what it is
 * told to protect.
 *
 * Every tool keeps its own vocabulary — Declutter says Remove and Keep,
 * Materials says Include and Exclude, Object Edit says Add, Erase and Protect —
 * by mapping its stroke names onto the two canonical intents below. Nothing
 * about the maths is re-implemented per tool.
 */

export type Box = { x: number; y: number; w: number; h: number };

/** What a stroke does, regardless of what a tool calls it in its UI. */
export type SelectionIntent = "include" | "exclude";

/** One brush dab, normalized to the source frame (0..1 on both axes). */
export type MaskStroke<K extends string = string> = {
  x: number;
  y: number;
  r: number;
  kind: K;
};

export type MaskState<K extends string = string> = {
  strokes: Array<MaskStroke<K>>;
  /** Strokes popped by Undo, ready for Redo. */
  redo: Array<MaskStroke<K>>;
  /** Positive grows the edit mask, negative contracts it, in image fraction. */
  grow: number;
  /** Soft edge in image fraction. */
  feather: number;
  invert: boolean;
};

/** A brush history has to end somewhere or a long session grows unbounded. */
export const MAX_STROKES = 400;

export const MIN_BRUSH = 0.005;
export const MAX_BRUSH = 0.4;
export const MAX_GROW = 0.08;
export const MAX_FEATHER = 0.06;

export function clamp01(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function emptyMask<K extends string = string>(): MaskState<K> {
  return { strokes: [], redo: [], grow: 0, feather: 0.01, invert: false };
}

/** Normalizes a dab so an out-of-frame drag or a wild radius cannot poison the mask. */
export function clampStroke<K extends string>(stroke: MaskStroke<K>): MaskStroke<K> {
  return {
    ...stroke,
    x: clamp01(stroke.x),
    y: clamp01(stroke.y),
    r: Math.max(MIN_BRUSH, Math.min(MAX_BRUSH, Number(stroke.r) || MIN_BRUSH)),
  };
}

export function pushStroke<K extends string>(mask: MaskState<K>, stroke: MaskStroke<K>): MaskState<K> {
  return {
    ...mask,
    strokes: mask.strokes.concat([clampStroke(stroke)]).slice(-MAX_STROKES),
    redo: [],
  };
}

export function undoStroke<K extends string>(mask: MaskState<K>): MaskState<K> {
  if (!mask.strokes.length) return mask;
  const strokes = mask.strokes.slice();
  const last = strokes.pop() as MaskStroke<K>;
  return { ...mask, strokes, redo: mask.redo.concat([last]) };
}

export function redoStroke<K extends string>(mask: MaskState<K>): MaskState<K> {
  if (!mask.redo.length) return mask;
  const redo = mask.redo.slice();
  const back = redo.pop() as MaskStroke<K>;
  return { ...mask, strokes: mask.strokes.concat([back]), redo };
}

export function clearStrokes<K extends string>(mask: MaskState<K>): MaskState<K> {
  return { ...mask, strokes: [], redo: [] };
}

export function growMask<K extends string>(mask: MaskState<K>, delta: number): MaskState<K> {
  const grow = Math.max(-MAX_GROW, Math.min(MAX_GROW, Number((mask.grow + delta).toFixed(4))));
  return { ...mask, grow };
}

export function setFeather<K extends string>(mask: MaskState<K>, value: number): MaskState<K> {
  return { ...mask, feather: Math.max(0, Math.min(MAX_FEATHER, Number(value) || 0)) };
}

export function invertMask<K extends string>(mask: MaskState<K>): MaskState<K> {
  return { ...mask, invert: !mask.invert };
}

/** Grows or shrinks a box by a fraction of the frame, staying inside it. */
export function padBox(box: Box, pad: number): Box {
  const x = Math.max(0, Math.min(1, box.x - pad));
  const y = Math.max(0, Math.min(1, box.y - pad));
  return {
    x,
    y,
    w: Math.max(0.005, Math.min(1 - x, box.w + pad * 2)),
    h: Math.max(0.005, Math.min(1 - y, box.h + pad * 2)),
  };
}

/** True when a dab lands inside a detected object's box. */
export function strokeCoversBox(stroke: MaskStroke, box: Box): boolean {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return Math.abs(stroke.x - cx) <= box.w / 2 + stroke.r && Math.abs(stroke.y - cy) <= box.h / 2 + stroke.r;
}

export function boxSentence(box: Box): string {
  const pc = (n: number) => Math.round(n * 100) + "%";
  return pc(box.x) + "," + pc(box.y) + " to " + pc(box.x + box.w) + "," + pc(box.y + box.h);
}

/* ------------------------------------------------------------- regions */

export type Region = { label: string; box: Box };

export type Regions<K extends string = string> = {
  /** Areas the model may change. */
  edit: Region[];
  /** Areas the model must leave untouched. */
  protect: Region[];
  strokes: Array<MaskStroke<K>>;
  hasEdit: boolean;
};

export type RegionInput<K extends string> = {
  /** Objects or surfaces the user chose to change. */
  selected: Region[];
  /** Everything the tool knows about that must survive the edit. */
  protectedRegions: Region[];
  mask: MaskState<K>;
  /** Which stroke names mean "edit here". */
  intent: (kind: K) => SelectionIntent;
};

/**
 * The exact geometry the backend receives.
 *
 * Expansion, inversion and protective strokes are resolved here so the overlay
 * the user sees and the coordinates the server is told are the same numbers.
 * Protection always wins: a region the user shielded is subtracted from the
 * edit list even when the same object was detected as a target.
 */
export function buildRegions<K extends string>(input: RegionInput<K>): Regions<K> {
  const { mask, intent } = input;
  const excludeStrokes = mask.strokes.filter((s) => intent(s.kind) === "exclude");
  const includeStrokes = mask.strokes.filter((s) => intent(s.kind) === "include");

  const edit = input.selected
    .filter((r) => !excludeStrokes.some((s) => strokeCoversBox(s, r.box)))
    .map((r) => ({ label: r.label, box: padBox(r.box, mask.grow) }));
  const protect = input.protectedRegions.map((r) => ({ label: r.label, box: { ...r.box } }));

  const finalEdit = mask.invert ? protect.map((r) => ({ ...r })) : edit;
  const finalProtect = mask.invert ? edit.map((r) => ({ ...r })) : protect;

  return {
    edit: finalEdit,
    protect: finalProtect,
    strokes: mask.strokes.slice(),
    hasEdit: finalEdit.length > 0 || includeStrokes.length > 0,
  };
}

/** Human summary of a selection, shared by every tool's panel header. */
export function summarizeRegions<K extends string>(
  regions: Regions<K>,
  mask: MaskState<K>,
  intent: (kind: K) => SelectionIntent,
): string {
  const brushed = regions.strokes.filter((s) => intent(s.kind) === "include").length;
  const shielded = regions.strokes.filter((s) => intent(s.kind) === "exclude").length;
  const bits: string[] = [];
  if (regions.edit.length) bits.push(regions.edit.map((r) => r.label).join(", "));
  if (brushed) bits.push(brushed + " brushed " + (brushed === 1 ? "area" : "areas"));
  if (!bits.length) return "Nothing selected yet";
  const extra: string[] = [];
  if (regions.protect.length || shielded) extra.push(regions.protect.length + shielded + " protected");
  if (mask.invert) extra.push("inverted");
  if (mask.grow) extra.push((mask.grow > 0 ? "expanded" : "contracted") + " edge");
  return bits.join(" \u00b7 ") + (extra.length ? " (" + extra.join(", ") + ")" : "");
}

/* -------------------------------------------------------- mask support */

/**
 * Honest statement of what the current image provider can do.
 *
 * The Gemini image endpoint takes no separate mask channel, so precision comes
 * from a rendered mask overlay plus explicit normalized coordinates. Users are
 * told this before paying; a mask is never collected and then ignored.
 */
export function maskSupport(subject: string, refinement: string) {
  return {
    native: false,
    label: "Mask-Guided",
    note:
      "This provider does not accept a separate mask layer, so " +
      subject +
      " is sent as a rendered mask overlay with exact coordinates and hard instructions to change only " +
      "those regions. Precision is very good but not pixel-exact — " +
      refinement,
  } as const;
}

/** Coordinate lines every tool's prompt uses to describe its regions. */
export function regionLines(regions: Region[]): string {
  return regions.map((r) => "- " + r.label + " [" + boxSentence(r.box) + "]").join("\n");
}

export function strokeLines<K extends string>(
  strokes: Array<MaskStroke<K>>,
  intent: (kind: K) => SelectionIntent,
  want: SelectionIntent,
): string {
  return strokes
    .filter((s) => intent(s.kind) === want)
    .map(
      (s) =>
        "- circle at " +
        Math.round(s.x * 100) +
        "%," +
        Math.round(s.y * 100) +
        "% radius " +
        Math.round(s.r * 100) +
        "%",
    )
    .join("\n");
}
