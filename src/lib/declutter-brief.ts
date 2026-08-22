/**
 * The Declutter brief.
 *
 * One pure, DOM-free module owns everything that must be true BEFORE a credit
 * is spent on a cleanup: the declutter mode, what may and may never be
 * removed, the detection list, the removal and protection masks, the prompt
 * the model receives, the credit cost, the modification classification and the
 * post-generation checks.
 *
 * The panel, the generation handler and the server prompt all read these
 * definitions, so every rule here is unit-testable.
 */

import {
  boxSentence,
  buildRegions,
  emptyMask as coreEmptyMask,
  pushStroke as corePushStroke,
  redoStroke as coreRedoStroke,
  undoStroke as coreUndoStroke,
  maskSupport,
  strokeCoversBox,
  type MaskState as CoreMaskState,
  type MaskStroke as CoreMaskStroke,
  type SelectionIntent,
} from "@/lib/selection-mask";

/* ---------------------------------------------------------------- modes */

export type DeclutterModeId =
  | "auto"
  | "select"
  | "surfaces"
  | "personal"
  | "empty_room";

export type DeclutterMode = {
  id: DeclutterModeId;
  label: string;
  blurb: string;
  /** True when the mode is allowed to delete real furniture. */
  removesFurniture: boolean;
  /** True when the mode needs its own typed confirmation. */
  needsConfirm: boolean;
  directive: string;
};

export const DECLUTTER_MODES: DeclutterMode[] = [
  {
    id: "auto",
    label: "Auto Declutter",
    blurb: "Clean up obvious clutter and leave the room itself untouched.",
    removesFurniture: false,
    needsConfirm: false,
    directive:
      "Remove only loose clutter and personal items. Every piece of furniture, every appliance, every " +
      "permanent fixture and every architectural element stays exactly as photographed.",
  },
  {
    id: "select",
    label: "Select Items To Remove",
    blurb: "You choose each object that goes. Nothing else is touched.",
    removesFurniture: false,
    needsConfirm: false,
    directive:
      "Remove only the specific objects listed and marked below. Anything not listed stays exactly as photographed.",
  },
  {
    id: "surfaces",
    label: "Clear Surfaces",
    blurb: "Clear countertops, tables, shelves and floors of loose items.",
    removesFurniture: false,
    needsConfirm: false,
    directive:
      "Clear the loose items resting on countertops, tables, desks, shelves, nightstands and open floor. " +
      "The surfaces, the furniture holding them and the finishes underneath stay exactly as photographed.",
  },
  {
    id: "personal",
    label: "Remove Personal Items",
    blurb: "Remove photographs, names, documents and toiletries for privacy.",
    removesFurniture: false,
    needsConfirm: false,
    directive:
      "Remove personally identifying items: framed photographs of people, visible names, documents, mail, " +
      "certificates, religious items, medication and toiletries. Furniture and finishes stay exactly as photographed.",
  },
  {
    id: "empty_room",
    label: "Empty Room",
    blurb: "Removes the furniture too. Only for a true empty-room shot.",
    removesFurniture: true,
    needsConfirm: true,
    directive:
      "Remove the loose furniture, décor and clutter and rebuild the floor, wall and baseboard surfaces they hid, " +
      "using the real materials already visible in the photograph. Built-ins, cabinetry, appliances, plumbing and " +
      "lighting fixtures, doors, windows and every architectural element stay exactly as photographed.",
  },
];

export const DEFAULT_DECLUTTER_MODE: DeclutterModeId = "auto";

export function declutterMode(id?: string | null): DeclutterMode {
  const key = String(id || "").trim().toLowerCase();
  return DECLUTTER_MODES.find((m) => m.id === key) || DECLUTTER_MODES[0]!;
}

/** The typed word Empty Room needs before it may run. */
export const EMPTY_ROOM_CONFIRM = "EMPTY";

export const EMPTY_ROOM_WARNING =
  "Empty Room deletes the furniture and décor in this photo, not just the clutter. " +
  "Use it only when you want a true empty-room shot.";

/* ------------------------------------------------------ protected things */

/** Never removed by any mode except Empty Room, and never by Auto. */
export const PROTECTED_CLASSES = [
  "major furniture",
  "appliances",
  "permanent fixtures",
  "cabinetry",
  "built-ins",
  "doors",
  "windows",
  "architectural features",
] as const;

const PROTECTED_WORDS = [
  "sofa", "couch", "sectional", "armchair", "chair", "stool", "bench", "bed", "mattress",
  "headboard", "dresser", "wardrobe", "nightstand", "table", "desk", "bookcase", "bookshelf",
  "cabinet", "cabinetry", "cupboard", "island", "vanity", "built-in", "builtin", "shelving unit",
  "refrigerator", "fridge", "oven", "range", "cooktop", "microwave", "dishwasher", "washer",
  "dryer", "hood", "water heater", "furnace", "radiator", "appliance",
  "sink", "faucet", "toilet", "bathtub", "tub", "shower", "fireplace", "mantel",
  "door", "window", "stair", "railing", "column", "beam", "ceiling fan", "chandelier",
  "light fixture", "sconce", "outlet", "switch", "vent", "baseboard", "molding", "moulding",
  "countertop", "backsplash", "floor", "wall", "ceiling", "rug", "carpet", "curtain", "blind",
] as const;

/** True when a label names something a cleanup must never delete. */
export function isProtectedLabel(label: string): boolean {
  const t = String(label || "").toLowerCase();
  if (!t.trim()) return false;
  return PROTECTED_WORDS.some((w) => t === w || t.includes(w));
}

/* ----------------------------------------------------------- categories */

export type ClutterCategoryId =
  | "cords"
  | "boxes"
  | "trash"
  | "laundry"
  | "counter_items"
  | "cleaning"
  | "photos"
  | "toiletries"
  | "papers"
  | "storage"
  | "toys"
  | "pet";

export type ClutterCategory = {
  id: ClutterCategoryId;
  label: string;
  hint: string;
  /** Counts as a privacy item. */
  personal: boolean;
  /** Counts as something resting on a surface. */
  surface: boolean;
};

export const CLUTTER_CATEGORIES: ClutterCategory[] = [
  { id: "cords", label: "Cords And Cables", hint: "visible power cords, chargers, cable runs", personal: false, surface: false },
  { id: "boxes", label: "Boxes", hint: "cardboard boxes, packing crates", personal: false, surface: false },
  { id: "trash", label: "Trash", hint: "rubbish, bins, bags, debris", personal: false, surface: false },
  { id: "laundry", label: "Laundry", hint: "clothing, towels, hampers, shoes", personal: true, surface: true },
  { id: "counter_items", label: "Small Countertop Items", hint: "small appliances, jars, bottles, dishes, clutter on counters", personal: false, surface: true },
  { id: "cleaning", label: "Cleaning Supplies", hint: "mops, brooms, sprays, buckets, vacuum", personal: false, surface: false },
  { id: "photos", label: "Personal Photographs", hint: "framed photos of people, portraits, name plaques", personal: true, surface: true },
  { id: "toiletries", label: "Toiletries", hint: "toothbrushes, soaps, shampoo, medication, razors", personal: true, surface: true },
  { id: "papers", label: "Papers And Mail", hint: "paperwork, mail, magazines, sticky notes", personal: true, surface: true },
  { id: "storage", label: "Temporary Storage", hint: "bins, stacked totes, piles of stored belongings", personal: false, surface: false },
  { id: "toys", label: "Toys", hint: "children's toys, play mats, games", personal: false, surface: true },
  { id: "pet", label: "Pet Items", hint: "pet beds, bowls, crates, litter trays", personal: false, surface: false },
];

export const CATEGORY_IDS = CLUTTER_CATEGORIES.map((c) => c.id);

export function category(id?: string | null): ClutterCategory | null {
  const key = String(id || "").trim().toLowerCase();
  return CLUTTER_CATEGORIES.find((c) => c.id === key) || null;
}

export function categoryLabel(id?: string | null): string {
  return category(id)?.label || "Other Clutter";
}

/** The categories a mode pre-selects when detections arrive. */
export function modeCategories(id: DeclutterModeId): ClutterCategoryId[] {
  if (id === "personal") return CLUTTER_CATEGORIES.filter((c) => c.personal).map((c) => c.id);
  if (id === "surfaces") return CLUTTER_CATEGORIES.filter((c) => c.surface).map((c) => c.id);
  if (id === "select") return [];
  return CATEGORY_IDS.slice();
}

/* ------------------------------------------------------------ detection */

export type Box = { x: number; y: number; w: number; h: number };

export type Detection = {
  id: string;
  label: string;
  category: ClutterCategoryId | "other";
  /** Normalized 0..1 box in the source frame. */
  box: Box;
  confidence: number;
  personal: boolean;
  /** True when the detector believes this is furniture or a fixture. */
  protectedItem: boolean;
  decision: "remove" | "keep";
};

function clamp01(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function normBox(raw: unknown): Box {
  const b = (raw || {}) as Record<string, unknown>;
  const x = clamp01(b["x"]);
  const y = clamp01(b["y"]);
  const w = Math.min(1 - x, Math.max(0.01, clamp01(b["w"])));
  const h = Math.min(1 - y, Math.max(0.01, clamp01(b["h"])));
  return { x, y, w, h };
}

/** Turns the raw detector answer into the list the panel can trust. */
export function normalizeDetections(raw: unknown): Detection[] {
  const src = (raw || {}) as Record<string, unknown>;
  const list = Array.isArray(src["items"]) ? (src["items"] as unknown[]) : [];
  const out: Detection[] = [];
  list.slice(0, 40).forEach((entry, i) => {
    const e = (entry || {}) as Record<string, unknown>;
    const label = String(e["label"] || "").trim().slice(0, 60);
    if (!label) return;
    const cat = category(String(e["category"] || ""));
    const prot = Boolean(e["furniture"]) || isProtectedLabel(label);
    out.push({
      id: "d" + (i + 1),
      label,
      category: cat ? cat.id : "other",
      box: normBox(e["box"]),
      confidence: clamp01(e["confidence"] ?? 0.6),
      personal: cat ? cat.personal : Boolean(e["personal"]),
      protectedItem: prot,
      decision: "keep",
    });
  });
  return out;
}

export type RoomRead = {
  roomType: string | null;
  summary: string | null;
  surfaces: string[];
};

export function normalizeRoomRead(raw: unknown): RoomRead {
  const src = (raw || {}) as Record<string, unknown>;
  const surfaces = Array.isArray(src["surfaces"]) ? (src["surfaces"] as unknown[]) : [];
  return {
    roomType: src["room_type"] ? String(src["room_type"]).slice(0, 60) : null,
    summary: src["summary"] ? String(src["summary"]).slice(0, 300) : null,
    surfaces: surfaces.map((s) => String(s || "").slice(0, 80)).filter(Boolean).slice(0, 10),
  };
}

/**
 * Applies a mode's default selection to a detection list.
 *
 * Auto and the focused modes never pre-select furniture, appliances, fixtures
 * or anything the user has already marked Keep.
 */
export function applyModeSelection(
  detections: Detection[],
  modeId: DeclutterModeId,
  keepLocked: string[] = [],
): Detection[] {
  const mode = declutterMode(modeId);
  const locked = new Set(keepLocked.map((k) => String(k).toLowerCase()));
  const cats = new Set<string>(modeCategories(mode.id));
  return detections.map((d) => {
    const isLocked = locked.has(d.id.toLowerCase()) || locked.has(d.label.toLowerCase());
    if (isLocked) return { ...d, decision: "keep" as const };
    if (mode.id === "empty_room") return { ...d, decision: "remove" as const };
    if (mode.id === "select") return { ...d, decision: "keep" as const };
    if (d.protectedItem) return { ...d, decision: "keep" as const };
    return { ...d, decision: cats.has(d.category) ? ("remove" as const) : ("keep" as const) };
  });
}

/* ---------------------------------------------------------------- masks */

/*
 * Declutter shares the one mask foundation in @/lib/selection-mask with Object
 * Edit and Materials. Only the vocabulary — Remove and Keep — belongs here.
 */

export type StrokeKind = "remove" | "keep";

/** One brush dab, normalized to the source frame. */
export type MaskStroke = CoreMaskStroke<StrokeKind>;

export type MaskState = CoreMaskState<StrokeKind>;

export function strokeIntent(kind: StrokeKind): SelectionIntent {
  return kind === "remove" ? "include" : "exclude";
}

export function emptyMask(): MaskState {
  return coreEmptyMask<StrokeKind>();
}

export function pushStroke(mask: MaskState, stroke: MaskStroke): MaskState {
  return corePushStroke(mask, stroke);
}

export function undoStroke(mask: MaskState): MaskState {
  return coreUndoStroke(mask);
}

export function redoStroke(mask: MaskState): MaskState {
  return coreRedoStroke(mask);
}

export type MaskRegions = {
  remove: Array<{ label: string; box: Box }>;
  keep: Array<{ label: string; box: Box }>;
  strokes: MaskStroke[];
  /** True when there is at least one region to remove. */
  hasRemoval: boolean;
};

/**
 * The regions that reach the backend.
 *
 * Keep always wins: a region the user protected is subtracted from the removal
 * list even when the same object was detected as clutter. That subtraction is
 * done by the shared engine, so it behaves identically in every tool.
 */
export function maskRegions(detections: Detection[], mask: MaskState): MaskRegions {
  const regions = buildRegions<StrokeKind>({
    selected: detections
      .filter((d) => d.decision === "remove")
      .map((d) => ({ label: d.label, box: d.box })),
    protectedRegions: detections
      .filter((d) => d.decision === "keep")
      .map((d) => ({ label: d.label, box: d.box })),
    mask,
    intent: strokeIntent,
  });
  return {
    remove: regions.edit,
    keep: regions.protect,
    strokes: regions.strokes,
    hasRemoval: regions.hasEdit,
  };
}

export { strokeCoversBox, boxSentence };


/* --------------------------------------------------- provider capability */

/**
 * Honest statement of what the current image provider can do.
 *
 * The Gemini image endpoint takes no separate mask channel, so precision comes
 * from a rendered mask overlay plus explicit normalized coordinates. The user
 * is told this before paying; the mask is never collected and then ignored.
 */
export const MASK_SUPPORT = maskSupport(
  "your selection",
  "check the result and use a tighter mask if anything else moved.",
);

/* ---------------------------------------------------------------- costs */

export const DECLUTTER_CREDIT = 1;

export function declutterCredits(results: number): number {
  return Math.max(1, Math.min(4, Math.round(results || 1))) * DECLUTTER_CREDIT;
}

export function declutterCostSentence(results: number): string {
  const n = Math.max(1, Math.min(4, Math.round(results || 1)));
  const c = declutterCredits(n);
  return (
    n +
    (n === 1 ? " result" : " results") +
    " · " +
    c +
    (c === 1 ? " credit" : " credits") +
    ". Detecting and selecting items is free — you are only charged when you confirm."
  );
}

/* ------------------------------------------------------- classification */

export type DeclutterClassification = "Decluttered" | "Item Removal" | "Virtually Emptied";

export function classificationFor(modeId: DeclutterModeId): DeclutterClassification {
  if (modeId === "empty_room") return "Virtually Emptied";
  if (modeId === "select") return "Item Removal";
  return "Decluttered";
}

export const DECLUTTER_DISCLOSURE =
  "This photograph has been digitally decluttered. Objects have been removed; the property, its finishes and its fixtures are unchanged.";

export const EMPTIED_DISCLOSURE =
  "This photograph has been digitally emptied. Furniture and belongings shown in the original have been removed digitally.";

export function disclosureFor(modeId: DeclutterModeId): string {
  return modeId === "empty_room" ? EMPTIED_DISCLOSURE : DECLUTTER_DISCLOSURE;
}

/* --------------------------------------------------------------- checks */

export const QUALITY_CHECKS = [
  { id: "furniture_lost", question: "Has any furniture that was not marked for removal disappeared or changed shape?" },
  { id: "architecture_drift", question: "Have walls, windows, doors, ceiling or room proportions moved or changed?" },
  { id: "fixture_missing", question: "Is any appliance, cabinet, built-in, plumbing or lighting fixture missing or altered?" },
  { id: "surface_distortion", question: "Is any floor, wall or countertop surface smeared, warped or blurred where an object was removed?" },
  { id: "repeated_texture", question: "Is a texture obviously cloned or tiled where an object used to be?" },
  { id: "accidental_redesign", question: "Have finishes, paint colors, materials or styling been changed rather than only cleaned?" },
  { id: "leftover_clutter", question: "Is an object that was marked for removal still present?" },
] as const;

export type QualityIssue = { id: string; severity: "minor" | "major"; detail: string };

export type QualityReport = { issues: QualityIssue[]; rejected: boolean; headline: string };

const CHECK_IDS = new Set(QUALITY_CHECKS.map((c) => c.id as string));

export function normalizeQuality(raw: unknown): QualityReport {
  const src = (raw || {}) as Record<string, unknown>;
  const list = Array.isArray(src["issues"]) ? (src["issues"] as unknown[]) : [];
  const issues: QualityIssue[] = [];
  list.slice(0, 8).forEach((entry) => {
    const e = (entry || {}) as Record<string, unknown>;
    const id = String(e["id"] || "").trim();
    if (!CHECK_IDS.has(id)) return;
    issues.push({
      id,
      severity: e["severity"] === "major" ? "major" : "minor",
      detail: String(e["detail"] || "").slice(0, 200) || id,
    });
  });
  const major = issues.filter((i) => i.severity === "major");
  const rejected =
    major.length >= 2 ||
    major.some((i) => i.id === "architecture_drift" || i.id === "furniture_lost" || i.id === "accidental_redesign");
  return {
    issues,
    rejected,
    headline: !issues.length
      ? "Quality checks passed."
      : rejected
        ? "This cleanup changed more than it should have."
        : issues.length + " thing" + (issues.length > 1 ? "s" : "") + " to check on this result.",
  };
}

/* ---------------------------------------------------------------- brief */

export type DeclutterSettings = {
  mode: DeclutterModeId | string;
  roomType: string | null;
  detections: Detection[];
  mask: MaskState;
  notes: string | null;
  results: number;
  /** Typed confirmation for Empty Room. */
  emptyConfirm?: string | null;
  roomRead?: RoomRead | null;
};

export type DeclutterPayload = {
  mode: DeclutterModeId;
  room_type: string;
  remove: Array<{ label: string; box: Box }>;
  keep: Array<{ label: string; box: Box }>;
  strokes: MaskStroke[];
  categories: string[];
  notes: string | null;
  room_summary: string | null;
  surfaces: string[];
  mask_native: boolean;
};

export type DeclutterRun = { id: string; label: string; directive: string };

export type DeclutterBrief = {
  valid: boolean;
  missing: string[];
  warnings: string[];
  runs: DeclutterRun[];
  credits: number;
  costSentence: string;
  lines: Array<{ k: string; v: string }>;
  classification: DeclutterClassification;
  disclosure: string;
  maskNote: string;
  payload: DeclutterPayload;
};

export function buildRuns(count: number): DeclutterRun[] {
  const n = Math.max(1, Math.min(4, Math.round(count || 1)));
  const out: DeclutterRun[] = [{ id: "primary", label: "Clean Result", directive: "" }];
  const extras: DeclutterRun[] = [
    { id: "tighter", label: "Tighter Cleanup", directive: "Be conservative: remove only what is clearly inside the removal regions." },
    { id: "fuller", label: "Fuller Cleanup", directive: "Also remove any small loose object of the same kind immediately adjacent to a removal region." },
    { id: "alt_fill", label: "Alternate Fill", directive: "Rebuild the vacated surfaces with a different but equally plausible continuation of the same real material." },
  ];
  return out.concat(extras.slice(0, n - 1));
}

export type DeclutterBriefInput = DeclutterSettings & { hasSource: boolean };

export function buildDeclutterBrief(input: DeclutterBriefInput): DeclutterBrief {
  const mode = declutterMode(input.mode);
  const detections = input.detections || [];
  const mask = input.mask || emptyMask();
  const regions = maskRegions(detections, mask);
  const runs = buildRuns(input.results);
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
  const read = input.roomRead || null;

  const missing: string[] = [];
  if (!input.hasSource) missing.push("Add A Photo");
  if (mode.id !== "empty_room" && !regions.hasRemoval)
    missing.push("Select At Least One Item To Remove");
  if (mode.needsConfirm && String(input.emptyConfirm || "").trim().toUpperCase() !== EMPTY_ROOM_CONFIRM)
    missing.push("Confirm Empty Room");

  const warnings: string[] = [];
  const protectedRemovals = detections.filter((d) => d.decision === "remove" && d.protectedItem);
  if (mode.id !== "empty_room" && protectedRemovals.length)
    warnings.push(
      'You marked "' +
        protectedRemovals.map((d) => d.label).join('", "') +
        '" for removal. That is furniture or a fixture, not clutter — removing it changes the room.',
    );
  if (mode.id === "empty_room") warnings.push(EMPTY_ROOM_WARNING);
  if (!MASK_SUPPORT.native) warnings.push(MASK_SUPPORT.note);
  if (!detections.length && regions.hasRemoval)
    warnings.push("No items were detected, so only your brushed regions will be cleaned.");

  const categories = Array.from(
    new Set(detections.filter((d) => d.decision === "remove").map((d) => d.category)),
  ).filter((c) => c !== "other");

  const lines: Array<{ k: string; v: string }> = [
    { k: "Tool", v: "Declutter" },
    { k: "Mode", v: mode.label + " — " + mode.blurb },
    { k: "Room", v: input.roomType || read?.roomType || "Not Set" },
    {
      k: "Removing",
      v: regions.remove.length
        ? regions.remove.map((r) => r.label).join(", ")
        : mode.id === "empty_room"
          ? "All loose furniture, décor and clutter"
          : "Brushed regions only",
    },
    {
      k: "Protected",
      v:
        (regions.keep.length ? regions.keep.map((r) => r.label).join(", ") + " · " : "") +
        PROTECTED_CLASSES.join(", "),
    },
    { k: "Selection", v: MASK_SUPPORT.label + " · " + regions.remove.length + " boxes, " + regions.strokes.length + " brush marks" },
    { k: "Results", v: runs.map((r) => r.label).join(", ") },
    { k: "Classification", v: classificationFor(mode.id) },
  ];
  if (notes) lines.push({ k: "Your Instructions", v: notes });

  return {
    valid: missing.length === 0,
    missing,
    warnings,
    runs,
    credits: declutterCredits(runs.length),
    costSentence: declutterCostSentence(runs.length),
    lines,
    classification: classificationFor(mode.id),
    disclosure: disclosureFor(mode.id),
    maskNote: MASK_SUPPORT.note,
    payload: {
      mode: mode.id,
      room_type: input.roomType || read?.roomType || "room",
      remove: regions.remove,
      keep: regions.keep,
      strokes: regions.strokes,
      categories,
      notes,
      room_summary: read?.summary || null,
      surfaces: read?.surfaces || [],
      mask_native: MASK_SUPPORT.native,
    },
  };
}

/* --------------------------------------------------------------- prompt */

const BASE_RULES =
  "This is a real estate photograph. You are performing a targeted object removal, not a redesign.\n" +
  "Absolute rules:\n" +
  "- Keep the same camera angle, focal length, perspective, framing, exposure and white balance.\n" +
  "- Never move, resize, restyle or recolor anything: walls, ceilings, floors, paint, tile, countertops, " +
  "cabinetry, built-ins, appliances, plumbing and lighting fixtures, doors, windows, trim and architectural features.\n" +
  "- Never add furniture, décor, plants, art or any new object. Nothing new appears in the photograph.\n" +
  "- Fill each removed area by continuing the real surface that is genuinely behind and around it, matching its " +
  "material, grain direction, grout lines, seams, shadows and lighting. Do not clone a visibly repeating patch.\n" +
  "- Leave every pixel outside the removal regions untouched.\n" +
  "- No text, no watermarks, no labels, no people.";

export function declutterPrompt(payload: DeclutterPayload, run?: DeclutterRun | null): string {
  const mode = declutterMode(payload.mode);
  const lines: string[] = [BASE_RULES, "", "Task: " + mode.directive];
  if (payload.room_summary) lines.push("The room: " + payload.room_summary);
  if (payload.surfaces.length)
    lines.push("Surfaces to continue when filling: " + payload.surfaces.join("; ") + ".");

  if (!payload.mask_native) {
    lines.push(
      "",
      "A second image is attached: the same photograph with the removal regions filled in magenta and the " +
        "protected regions outlined in green. Treat the magenta regions as the only editable area and the green " +
        "regions as untouchable. Return the cleaned photograph itself, never the overlay.",
    );
  }

  if (payload.remove.length) {
    lines.push("", "Remove exactly these objects, each given as a normalized region of the frame:");
    payload.remove.forEach((r) => lines.push("- " + r.label + " at " + boxSentence(r.box)));
  }
  const removeStrokes = payload.strokes.filter((s) => s.kind === "remove");
  if (removeStrokes.length)
    lines.push(
      "- plus the hand-marked regions painted in magenta on the overlay (" + removeStrokes.length + " marks).",
    );

  if (payload.keep.length) {
    lines.push("", "These objects are protected and must stay pixel-identical:");
    payload.keep.forEach((r) => lines.push("- " + r.label + " at " + boxSentence(r.box)));
  }
  lines.push(
    "Also protected, always: " + PROTECTED_CLASSES.join(", ") + ".",
  );

  if (payload.categories.length)
    lines.push(
      "",
      "The removal list is clutter of these kinds: " +
        payload.categories.map((c) => categoryLabel(c)).join(", ") +
        ".",
    );
  if (payload.notes) lines.push("", "The user also asks: " + payload.notes);
  if (run?.directive) lines.push("", "For this variation: " + run.directive);
  return lines.join("\n");
}

/* ---------------------------------------------------------- persistence */

/** Everything a saved version must carry so the work can be reopened later. */
export type DeclutterMeta = {
  tool: "Declutter";
  mode: DeclutterModeId;
  classification: DeclutterClassification;
  source_version: string | null;
  removal_mask: Array<{ label: string; box: Box }>;
  protected_regions: Array<{ label: string; box: Box }>;
  strokes: MaskStroke[];
  detections: Array<{ id: string; label: string; category: string; decision: string; box: Box }>;
  instructions: string | null;
  mask_native: boolean;
  model: string;
  run: string;
  at: string;
};

export function declutterMeta(input: {
  payload: DeclutterPayload;
  detections: Detection[];
  sourceVersion: string | null;
  run: string;
  model?: string;
}): DeclutterMeta {
  return {
    tool: "Declutter",
    mode: input.payload.mode,
    classification: classificationFor(input.payload.mode),
    source_version: input.sourceVersion,
    removal_mask: input.payload.remove,
    protected_regions: input.payload.keep,
    strokes: input.payload.strokes,
    detections: (input.detections || []).map((d) => ({
      id: d.id,
      label: d.label,
      category: d.category,
      decision: d.decision,
      box: d.box,
    })),
    instructions: input.payload.notes,
    mask_native: input.payload.mask_native,
    model: input.model || "google/gemini-2.5-flash-image",
    run: input.run,
    at: new Date().toISOString(),
  };
}

/** Rehydrates panel state from a stored version's metadata. */
export function restoreFromMeta(meta: unknown): {
  mode: DeclutterModeId;
  detections: Detection[];
  mask: MaskState;
  notes: string | null;
} | null {
  const m = (meta || {}) as Record<string, unknown>;
  if (!m || m["tool"] !== "Declutter") return null;
  const dets = Array.isArray(m["detections"]) ? (m["detections"] as unknown[]) : [];
  const strokes = Array.isArray(m["strokes"]) ? (m["strokes"] as unknown[]) : [];
  return {
    mode: declutterMode(String(m["mode"] || "")).id,
    detections: dets.map((raw, i) => {
      const d = (raw || {}) as Record<string, unknown>;
      const label = String(d["label"] || "item");
      return {
        id: String(d["id"] || "d" + (i + 1)),
        label,
        category: (category(String(d["category"] || ""))?.id || "other") as Detection["category"],
        box: normBox(d["box"]),
        confidence: 1,
        personal: Boolean(category(String(d["category"] || ""))?.personal),
        protectedItem: isProtectedLabel(label),
        decision: d["decision"] === "remove" ? "remove" : "keep",
      };
    }),
    mask: {
      ...emptyMask(),
      strokes: strokes.map((raw) => {
        const s = (raw || {}) as Record<string, unknown>;
        return {
          x: clamp01(s["x"]),
          y: clamp01(s["y"]),
          r: Math.max(0.005, clamp01(s["r"])),
          kind: s["kind"] === "keep" ? "keep" : "remove",
        } as MaskStroke;
      }),
      redo: [],
    },
    notes: m["instructions"] ? String(m["instructions"]) : null,
  };
}

/**
 * Restoring one mistakenly removed object: the same brief runs again with that
 * object moved into the protected list, so nothing has to be set up twice.
 */
export function restoreItem(detections: Detection[], id: string): Detection[] {
  return detections.map((d) => (d.id === id ? { ...d, decision: "keep" as const } : d));
}
