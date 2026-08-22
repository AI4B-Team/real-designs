/**
 * The Materials brief.
 *
 * One pure, DOM-free module owns everything that must be true BEFORE a credit
 * is spent on a material swap: which real surface was selected, which
 * replacement material and options were chosen, what stays untouched, the
 * prompt the model receives, the cost, the disclosure and the automatic
 * post-generation checks.
 *
 * The promise this enforces: "Select a real surface, choose its replacement
 * material and preview that exact change while preserving everything else."
 * A swap is therefore always single-surface — the brief refuses to run without
 * one selected surface and one compatible material.
 */

import {
  BAND_NOTE,
  MATERIALS,
  SURFACE_KINDS,
  isCompatible,
  material,
  materialsForSurface,
  optionOf,
  surfaceKind,
  surfaceLabel,
  type Material,
  type MaterialOption,
  type SurfaceKindId,
} from "@/lib/materials-catalog";

/* ----------------------------------------------------------------- boxes */

export type Box = { x: number; y: number; w: number; h: number };

export function clamp01(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function normBox(raw: unknown): Box {
  const b = (raw || {}) as Record<string, unknown>;
  const x = clamp01(b["x"]);
  const y = clamp01(b["y"]);
  return {
    x,
    y,
    w: Math.max(0.01, Math.min(1 - x, clamp01(b["w"]) || 0.2)),
    h: Math.max(0.01, Math.min(1 - y, clamp01(b["h"]) || 0.2)),
  };
}

export function boxSentence(b: Box): string {
  const pct = (n: number) => Math.round(n * 100) + "%";
  return (
    "x " + pct(b.x) + " to " + pct(b.x + b.w) + ", y " + pct(b.y) + " to " + pct(b.y + b.h) + " of the frame"
  );
}

/* ------------------------------------------------------------ detections */

export type SurfaceDetection = {
  id: string;
  /** What the model called it, e.g. "kitchen floor". */
  label: string;
  kind: SurfaceKindId;
  box: Box;
  /** The material that is actually there today. */
  current: string;
  confidence: number;
  /** Rough share of the frame, 0..1, used to warn about tiny selections. */
  area: number;
};

export type RoomRead = {
  roomType: string | null;
  summary: string | null;
  lighting: string | null;
  /** Everything else the model saw, so the prompt can protect it by name. */
  otherSurfaces: string[];
};

function kindFrom(raw: unknown): SurfaceKindId | null {
  const key = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const direct = SURFACE_KINDS.find((s) => s.id === key);
  if (direct) return direct.id;
  const alias: Record<string, SurfaceKindId> = {
    floor: "flooring",
    floors: "flooring",
    wall: "wall_paint",
    walls: "wall_paint",
    paint: "wall_paint",
    tile: "wall_tile",
    shower: "wall_tile",
    splashback: "backsplash",
    counter: "countertop",
    counters: "countertop",
    worktop: "countertop",
    vanity: "countertop",
    cabinets: "cabinetry",
    cabinet: "cabinetry",
    millwork: "cabinetry",
    kitchen_island: "island",
    trim: "trim_doors",
    doors: "trim_doors",
    baseboard: "trim_doors",
    hearth: "fireplace",
    surround: "fireplace",
    cladding: "siding",
    exterior_wall: "siding",
    roof: "roofing",
    driveway: "paving",
    walkway: "paving",
    patio: "paving",
    deck: "decking",
    fence: "fencing",
    mulch: "gravel_bed",
    gravel: "gravel_bed",
    landscaping: "gravel_bed",
  };
  return alias[key] || null;
}

export function normalizeSurfaces(raw: unknown): SurfaceDetection[] {
  const src = (raw || {}) as Record<string, unknown>;
  const list = Array.isArray(src["surfaces"]) ? (src["surfaces"] as unknown[]) : [];
  const out: SurfaceDetection[] = [];
  list.slice(0, 14).forEach((entry, i) => {
    const e = (entry || {}) as Record<string, unknown>;
    const kind = kindFrom(e["kind"]) || kindFrom(e["label"]);
    if (!kind) return;
    const box = normBox(e["box"]);
    out.push({
      id: String(e["id"] || "s" + (i + 1)),
      label: String(e["label"] || surfaceLabel(kind)).slice(0, 60),
      kind,
      box,
      current: String(e["current_material"] || e["material"] || "").slice(0, 80) || "unknown",
      confidence: Math.max(0, Math.min(1, Number(e["confidence"]) || 0.6)),
      area: box.w * box.h,
    });
  });
  /* Largest, most confident surfaces first: that is the order a user scans. */
  return out.sort((a, b) => b.confidence * b.area - a.confidence * a.area);
}

export function normalizeRoomRead(raw: unknown): RoomRead {
  const src = (raw || {}) as Record<string, unknown>;
  const others = Array.isArray(src["other_surfaces"]) ? (src["other_surfaces"] as unknown[]) : [];
  return {
    roomType: src["room_type"] ? String(src["room_type"]).slice(0, 60) : null,
    summary: src["summary"] ? String(src["summary"]).slice(0, 300) : null,
    lighting: src["lighting"] ? String(src["lighting"]).slice(0, 200) : null,
    otherSurfaces: others.slice(0, 12).map((s) => String(s).slice(0, 80)),
  };
}

/* ------------------------------------------------------------------ mask */

/*
 * Materials does not own a mask engine. Selection geometry, brush history,
 * edge expansion and region maths come from @/lib/selection-mask, the same
 * foundation Object Edit and Declutter stand on; only the vocabulary here is
 * material-specific.
 */

export type StrokeKind = "include" | "exclude";
export type MaskStroke = CoreMaskStroke<StrokeKind>;
export type MaskState = CoreMaskState<StrokeKind>;

export function strokeIntent(kind: StrokeKind): SelectionIntent {
  return kind === "include" ? "include" : "exclude";
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

/** What the overlay paints and what the prompt describes. */
export function maskRegions(
  selected: SurfaceDetection | null,
  others: SurfaceDetection[],
  mask: MaskState,
): {
  target: Array<{ label: string; box: Box }>;
  keep: Array<{ label: string; box: Box }>;
  strokes: MaskStroke[];
  hasTarget: boolean;
} {
  const regions = buildRegions<StrokeKind>({
    selected: selected ? [{ label: selected.label, box: selected.box }] : [],
    protectedRegions: others
      .filter((o) => !selected || o.id !== selected.id)
      .map((o) => ({ label: o.label, box: o.box })),
    mask,
    intent: strokeIntent,
  });
  return {
    target: regions.edit,
    keep: regions.protect,
    strokes: regions.strokes,
    hasTarget: regions.hasEdit,
  };
}


/* ---------------------------------------------------------------- costs */

export const MATERIAL_CREDIT = 1;

export function materialsCredits(results: number): number {
  return Math.max(1, Math.min(4, Math.round(results || 1))) * MATERIAL_CREDIT;
}

export function materialsCostSentence(results: number): string {
  const n = Math.max(1, Math.min(4, Math.round(results || 1)));
  const c = materialsCredits(n);
  return (
    n +
    (n === 1 ? " option" : " options") +
    " \u00b7 " +
    c +
    (c === 1 ? " credit" : " credits") +
    ". Detecting surfaces and browsing materials is free — you are only charged when you confirm."
  );
}

/* ---------------------------------------------------------- mask support */

export const MASK_SUPPORT = {
  native: false,
  label: "Mask-Guided",
  note:
    "This provider does not accept a separate mask layer, so the surface you selected is sent as a rendered " +
    "mask overlay with exact coordinates and hard instructions to repaint only that surface. Precision is very " +
    "good but not pixel-exact — check the edges and refine the mask if the material bled anywhere.",
} as const;

/* ------------------------------------------------------- classification */

export const MATERIALS_CLASSIFICATION = "Material Change";

export const MATERIALS_DISCLOSURE =
  "This photograph shows a digitally applied material change. The selected surface has been re-rendered to " +
  "preview a different finish; the property, its layout, its furniture and every other surface are unchanged.";

/* --------------------------------------------------------------- checks */

export const QUALITY_CHECKS = [
  { id: "other_surface_changed", question: "Did any surface other than the selected one change material, colour or tone?" },
  { id: "bleed", question: "Did the new material bleed past the surface boundary onto walls, trim, furniture or fixtures?" },
  { id: "geometry_drift", question: "Did the room geometry, perspective, edges or object positions shift?" },
  { id: "lighting_mismatch", question: "Do the shadows, highlights and reflections on the new material disagree with the room's light?" },
  { id: "perspective_texture", question: "Does the material texture fail to follow perspective — wrong scale, flat pattern or no foreshortening?" },
  { id: "occlusion_lost", question: "Is the new material drawn over furniture, rugs, appliances or anything that should sit on top of the surface?" },
  { id: "seam_grout", question: "Are the seams, grout lines, planks or joints inconsistent, misaligned or missing?" },
  { id: "not_applied", question: "Is the selected surface unchanged, so the requested material was not applied at all?" },
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
    major.some((i) => i.id === "other_surface_changed" || i.id === "geometry_drift" || i.id === "not_applied");
  return {
    issues,
    rejected,
    headline: !issues.length
      ? "Quality checks passed."
      : rejected
        ? "This swap changed more than the surface you selected."
        : issues.length + " thing" + (issues.length > 1 ? "s" : "") + " to check on this result.",
  };
}

/* ---------------------------------------------------------------- brief */

export type MaterialsSettings = {
  /** Detected surface id, when the user picked one from the list. */
  surfaceId: string | null;
  /** Surface kind, always present once anything is selected. */
  surfaceKind: SurfaceKindId | string | null;
  detections: SurfaceDetection[];
  mask: MaskState;
  materialId: string | null;
  finishId: string | null;
  colorId: string | null;
  patternId: string | null;
  scaleId: string | null;
  /** Grout / joint colour when the material has joints. */
  groutId?: string | null;
  results: number;
  notes: string | null;
  roomType?: string | null;
  roomRead?: RoomRead | null;
};

export const GROUT_OPTIONS: MaterialOption[] = [
  { id: "match", label: "Matching", prompt: "grout that matches the tile colour so joints read quietly" },
  { id: "light", label: "Light", prompt: "light grey grout that keeps the joints visible" },
  { id: "dark", label: "Dark", prompt: "dark charcoal grout that draws the joint grid" },
];

export type MaterialsPayload = {
  surface_kind: SurfaceKindId;
  surface_label: string;
  surface_prompt_name: string;
  current_material: string;
  target: Array<{ label: string; box: Box }>;
  keep: Array<{ label: string; box: Box }>;
  strokes: MaskStroke[];
  material_id: string;
  material_name: string;
  material_spec: string;
  finish: string;
  color: string;
  pattern: string | null;
  scale: string | null;
  grout: string | null;
  room_type: string;
  room_summary: string | null;
  lighting: string | null;
  other_surfaces: string[];
  notes: string | null;
  mask_native: boolean;
};

export type MaterialsRun = { id: string; label: string; directive: string };

export type MaterialsBrief = {
  valid: boolean;
  missing: string[];
  warnings: string[];
  runs: MaterialsRun[];
  credits: number;
  costSentence: string;
  lines: Array<{ k: string; v: string }>;
  classification: string;
  disclosure: string;
  maskNote: string;
  payload: MaterialsPayload;
};

export function buildRuns(count: number): MaterialsRun[] {
  const n = Math.max(1, Math.min(4, Math.round(count || 1)));
  const out: MaterialsRun[] = [{ id: "primary", label: "Exact Specification", directive: "" }];
  const extras: MaterialsRun[] = [
    {
      id: "lighter",
      label: "Lighter Tone",
      directive: "Use the same material one shade lighter, keeping the finish, pattern and scale identical.",
    },
    {
      id: "darker",
      label: "Deeper Tone",
      directive: "Use the same material one shade deeper, keeping the finish, pattern and scale identical.",
    },
    {
      id: "tighter",
      label: "Tighter Edges",
      directive:
        "Be conservative at the boundary: stop the new material exactly at the surface edge, even if that leaves a sliver of the original visible.",
    },
  ];
  return out.concat(extras.slice(0, n - 1));
}

export type MaterialsBriefInput = MaterialsSettings & { hasSource: boolean };

function selectedDetection(input: MaterialsBriefInput): SurfaceDetection | null {
  if (!input.surfaceId) return null;
  return (input.detections || []).find((d) => d.id === input.surfaceId) || null;
}

export function buildMaterialsBrief(input: MaterialsBriefInput): MaterialsBrief {
  const det = selectedDetection(input);
  const kind = surfaceKind(input.surfaceKind || det?.kind || null);
  const mat = material(input.materialId);
  const mask = input.mask || emptyMask();
  const regions = maskRegions(det, input.detections || [], mask);
  const runs = buildRuns(input.results);
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
  const read = input.roomRead || null;

  const finish = optionOf(mat?.finishes, input.finishId);
  const col = optionOf(mat?.colors, input.colorId);
  const pattern = mat?.patterns ? optionOf(mat.patterns, input.patternId) : null;
  const scale = mat?.scales ? optionOf(mat.scales, input.scaleId) : null;
  const hasJoints = !!mat && (mat.family === "tile" || mat.family === "stone" || mat.family === "brick" || mat.family === "paving");
  const grout = hasJoints ? optionOf(GROUT_OPTIONS, input.groutId) : null;

  const missing: string[] = [];
  if (!input.hasSource) missing.push("Add A Photo");
  if (!kind) missing.push("Select A Surface");
  if (!mat) missing.push("Choose A Material");
  if (kind && mat && !isCompatible(kind.id, mat.id)) missing.push("Choose A Material That Suits " + kind.label);
  if (kind && !regions.hasTarget) missing.push("Mark The Surface On The Photo");

  const warnings: string[] = [];
  if (!MASK_SUPPORT.native) warnings.push(MASK_SUPPORT.note);
  if (det && det.confidence < 0.55)
    warnings.push(
      "The " +
        det.label +
        " was detected with low confidence. Brush over it to make the boundary exact before generating.",
    );
  if (det && det.area < 0.04)
    warnings.push("This surface covers a small part of the frame, so the change will be subtle in the result.");
  if (!det && regions.strokes.some((s) => s.kind === "include"))
    warnings.push("No detected surface is selected, so only the area you brushed will be changed.");
  if (mat && kind && mat.family === "carpet" && kind.id !== "flooring")
    warnings.push("Carpet only belongs on a floor. Pick a different material for " + kind.label + ".");
  const otherKinds = (input.detections || []).filter((d) => !det || d.id !== det.id).map((d) => d.label);
  if (otherKinds.length)
    warnings.push("Everything else stays as photographed, including " + otherKinds.slice(0, 4).join(", ") + ".");

  const lines: Array<{ k: string; v: string }> = [
    { k: "Tool", v: "Materials" },
    { k: "Surface", v: (det?.label || kind?.label || "Not Set") + (det ? " \u00b7 currently " + det.current : "") },
    { k: "New Material", v: mat ? mat.name + " \u00b7 " + mat.blurb : "Not Set" },
    { k: "Finish", v: [col?.label, finish?.label].filter(Boolean).join(" \u00b7 ") || "Not Set" },
  ];
  if (pattern || scale)
    lines.push({ k: "Layout", v: [scale?.label, pattern?.label].filter(Boolean).join(" \u00b7 ") });
  if (grout) lines.push({ k: "Grout", v: grout.label });
  lines.push({
    k: "Selection",
    v: MASK_SUPPORT.label + " \u00b7 " + regions.target.length + " surface, " + regions.strokes.length + " brush marks",
  });
  lines.push({ k: "Protected", v: regions.keep.length ? regions.keep.map((r) => r.label).join(", ") : "Every other surface, all furniture, fixtures and architecture" });
  lines.push({ k: "Options", v: runs.map((r) => r.label).join(", ") });
  lines.push({ k: "Classification", v: MATERIALS_CLASSIFICATION });
  if (mat) lines.push({ k: "Cost Band", v: BAND_NOTE[mat.band] });
  if (notes) lines.push({ k: "Your Instructions", v: notes });

  return {
    valid: missing.length === 0,
    missing,
    warnings,
    runs,
    credits: materialsCredits(runs.length),
    costSentence: materialsCostSentence(runs.length),
    lines,
    classification: MATERIALS_CLASSIFICATION,
    disclosure: MATERIALS_DISCLOSURE,
    maskNote: MASK_SUPPORT.note,
    payload: {
      surface_kind: (kind?.id || "flooring") as SurfaceKindId,
      surface_label: det?.label || kind?.label || "surface",
      surface_prompt_name: kind?.promptName || "the selected surface",
      current_material: det?.current || "the existing material",
      target: regions.target,
      keep: regions.keep,
      strokes: regions.strokes,
      material_id: mat?.id || "",
      material_name: mat?.name || "",
      material_spec: mat?.spec || "",
      finish: finish?.prompt || "",
      color: col?.prompt || "",
      pattern: pattern?.prompt || null,
      scale: scale?.prompt || null,
      grout: grout?.prompt || null,
      room_type: input.roomType || read?.roomType || "room",
      room_summary: read?.summary || null,
      lighting: read?.lighting || null,
      other_surfaces: read?.otherSurfaces || [],
      notes,
      mask_native: MASK_SUPPORT.native,
    },
  };
}

/* --------------------------------------------------------------- prompt */

const BASE_RULES =
  "This is a real estate photograph. You are performing a single-surface material replacement, not a redesign.\n" +
  "Absolute rules:\n" +
  "- Keep the same camera angle, focal length, perspective, framing, exposure and white balance.\n" +
  "- Change exactly one surface. Every other surface keeps its existing material, colour, tone and texture.\n" +
  "- Never move, add or remove furniture, rugs, décor, appliances, plumbing or lighting fixtures, cabinetry, " +
  "doors, windows, trim or any architectural element.\n" +
  "- Respect occlusion: anything resting on or in front of the surface stays in front of it, with its original " +
  "contact shadows intact. Never paint the new material over an object.\n" +
  "- Match the room's existing light: the new material takes the same light direction, shadow softness, " +
  "highlight placement and reflection behaviour that the original surface had.\n" +
  "- Follow perspective: the material's texture, joints, planks or pattern must foreshorten correctly and " +
  "keep a believable real-world scale at every depth in the frame.\n" +
  "- Leave every pixel outside the target surface untouched.\n" +
  "- No text, no watermarks, no labels, no people.";

export function materialsPrompt(payload: MaterialsPayload, run?: MaterialsRun | null): string {
  const lines: string[] = [
    BASE_RULES,
    "",
    "Task: replace " +
      payload.surface_prompt_name +
      " (" +
      payload.surface_label +
      ", currently " +
      payload.current_material +
      ") with " +
      (payload.material_name || "the specified material") +
      ".",
    "The new material: " + payload.material_spec + ".",
  ];
  if (payload.color) lines.push("Colour: " + payload.color + ".");
  if (payload.finish) lines.push("Finish: " + payload.finish + ".");
  if (payload.scale) lines.push("Scale: " + payload.scale + ".");
  if (payload.pattern) lines.push("Layout: " + payload.pattern + ".");
  if (payload.grout) lines.push("Joints: " + payload.grout + ".");

  if (payload.room_summary) lines.push("", "The room: " + payload.room_summary);
  if (payload.lighting) lines.push("The light in this photograph: " + payload.lighting);

  if (!payload.mask_native) {
    lines.push(
      "",
      "A second image is attached: the same photograph with the target surface filled in magenta and the " +
        "protected surfaces outlined in green. Treat the magenta area as the only editable region and the green " +
        "regions as untouchable. Return the photograph itself, never the overlay.",
    );
  }

  if (payload.target.length) {
    lines.push("", "The target surface, as a normalized region of the frame:");
    payload.target.forEach((t) => lines.push("- " + t.label + " at " + boxSentence(t.box)));
  }
  const inc = payload.strokes.filter((s) => s.kind === "include");
  const exc = payload.strokes.filter((s) => s.kind === "exclude");
  if (inc.length) lines.push("- plus the areas painted magenta by hand (" + inc.length + " marks).");
  if (exc.length)
    lines.push("- minus the areas outlined green by hand (" + exc.length + " marks); those keep their original material.");

  if (payload.keep.length) {
    lines.push("", "These surfaces are protected and must stay pixel-identical:");
    payload.keep.forEach((r) => lines.push("- " + r.label + " at " + boxSentence(r.box)));
  }
  if (payload.other_surfaces.length)
    lines.push("Also unchanged: " + payload.other_surfaces.join("; ") + ".");

  if (payload.notes) lines.push("", "The user also asks: " + payload.notes);
  if (run?.directive) lines.push("", "For this option: " + run.directive);
  return lines.join("\n");
}

/* ---------------------------------------------------------- persistence */

export type MaterialsMeta = {
  tool: "Materials";
  classification: string;
  source_version: string | null;
  surface_kind: SurfaceKindId;
  surface_label: string;
  current_material: string;
  material_id: string;
  material_name: string;
  finish_id: string | null;
  color_id: string | null;
  pattern_id: string | null;
  scale_id: string | null;
  grout_id: string | null;
  target_mask: Array<{ label: string; box: Box }>;
  protected_regions: Array<{ label: string; box: Box }>;
  strokes: MaskStroke[];
  detections: Array<{ id: string; label: string; kind: string; current: string; box: Box }>;
  instructions: string | null;
  mask_native: boolean;
  model: string;
  run: string;
  at: string;
};

export function materialsMeta(input: {
  payload: MaterialsPayload;
  settings: MaterialsSettings;
  sourceVersion: string | null;
  run: string;
  model?: string;
}): MaterialsMeta {
  const s = input.settings;
  return {
    tool: "Materials",
    classification: MATERIALS_CLASSIFICATION,
    source_version: input.sourceVersion,
    surface_kind: input.payload.surface_kind,
    surface_label: input.payload.surface_label,
    current_material: input.payload.current_material,
    material_id: input.payload.material_id,
    material_name: input.payload.material_name,
    finish_id: s.finishId || null,
    color_id: s.colorId || null,
    pattern_id: s.patternId || null,
    scale_id: s.scaleId || null,
    grout_id: s.groutId || null,
    target_mask: input.payload.target,
    protected_regions: input.payload.keep,
    strokes: input.payload.strokes,
    detections: (s.detections || []).map((d) => ({
      id: d.id,
      label: d.label,
      kind: d.kind,
      current: d.current,
      box: d.box,
    })),
    instructions: input.payload.notes,
    mask_native: input.payload.mask_native,
    model: input.model || "google/gemini-2.5-flash-image",
    run: input.run,
    at: new Date().toISOString(),
  };
}

/** Rehydrates the panel from a stored version so a swap can be re-run or tuned. */
export function restoreFromMeta(meta: unknown): {
  surfaceId: string | null;
  surfaceKind: SurfaceKindId;
  detections: SurfaceDetection[];
  mask: MaskState;
  materialId: string | null;
  finishId: string | null;
  colorId: string | null;
  patternId: string | null;
  scaleId: string | null;
  groutId: string | null;
  notes: string | null;
} | null {
  const m = (meta || {}) as Record<string, unknown>;
  if (!m || m["tool"] !== "Materials") return null;
  const dets = Array.isArray(m["detections"]) ? (m["detections"] as unknown[]) : [];
  const strokes = Array.isArray(m["strokes"]) ? (m["strokes"] as unknown[]) : [];
  const kind = kindFrom(m["surface_kind"]) || "flooring";
  const detections: SurfaceDetection[] = dets.map((raw, i) => {
    const d = (raw || {}) as Record<string, unknown>;
    const box = normBox(d["box"]);
    return {
      id: String(d["id"] || "s" + (i + 1)),
      label: String(d["label"] || surfaceLabel(String(d["kind"] || kind))),
      kind: kindFrom(d["kind"]) || kind,
      box,
      current: String(d["current"] || "unknown"),
      confidence: 1,
      area: box.w * box.h,
    };
  });
  const label = String(m["surface_label"] || "");
  const match = detections.find((d) => d.label === label) || detections.find((d) => d.kind === kind) || null;
  return {
    surfaceId: match?.id || null,
    surfaceKind: kind,
    detections,
    mask: {
      strokes: strokes.map((raw) => {
        const s = (raw || {}) as Record<string, unknown>;
        return {
          x: clamp01(s["x"]),
          y: clamp01(s["y"]),
          r: Math.max(0.005, clamp01(s["r"])),
          kind: s["kind"] === "exclude" ? "exclude" : "include",
        } as MaskStroke;
      }),
      redo: [],
    },
    materialId: m["material_id"] ? String(m["material_id"]) : null,
    finishId: m["finish_id"] ? String(m["finish_id"]) : null,
    colorId: m["color_id"] ? String(m["color_id"]) : null,
    patternId: m["pattern_id"] ? String(m["pattern_id"]) : null,
    scaleId: m["scale_id"] ? String(m["scale_id"]) : null,
    groutId: m["grout_id"] ? String(m["grout_id"]) : null,
    notes: m["instructions"] ? String(m["instructions"]) : null,
  };
}

/**
 * The default material for a surface: the first compatible entry, so the
 * picker is never empty and the brief always has a legitimate starting point.
 */
export function defaultMaterialFor(kind: string | null | undefined): Material | null {
  const list = materialsForSurface(kind);
  return list[0] || null;
}

export const ALL_MATERIAL_IDS = MATERIALS.map((m) => m.id);
