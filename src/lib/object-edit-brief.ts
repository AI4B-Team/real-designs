/**
 * Object Edit — the one canonical targeted-edit engine.
 *
 * Every targeted change in REAL DESIGNS goes through this file: the rail
 * tool, the "Continue In Object Edit" hand-off from the Photo Editor, the
 * single-object escape hatch in Declutter and the single-surface escape hatch
 * in Materials. Selection, mask maths, action rules, prompts, cost and
 * classification live here so the client, the server and the tests all read
 * exactly the same rules.
 *
 * The rule the whole tool is built on: the model may change the masked target
 * and nothing else. A selection that never reached the backend is not a
 * selection, so the brief refuses to run without one.
 */

export const TOOL_NAME = "Object Edit";

export const TOOL_PROMISE =
  "Select a specific object or area and remove, replace, restyle or modify only that target.";

export const TOOL_EXPLAINER =
  "Everything outside your selection is preserved. Protected areas are never touched.";

/* ------------------------------------------------------------- actions */

export type ActionId =
  | "remove"
  | "replace"
  | "color"
  | "material"
  | "restyle"
  | "duplicate"
  | "move"
  | "custom";

/** What the user must supply before an action can run. */
export type ActionNeed = "replacement" | "color" | "material" | "style" | "instruction" | null;

export type ObjectAction = {
  id: ActionId;
  label: string;
  icon: string;
  hint: string;
  needs: ActionNeed;
  /** Prompt fragment describing the intent to the render model. */
  directive: string;
  /** Modification class stored with the saved version. */
  classification: string;
  /** Actions that only make sense for a free-standing, movable object. */
  requiresMovable?: boolean;
};

export const OBJECT_ACTIONS: ObjectAction[] = [
  {
    id: "remove",
    label: "Remove",
    icon: "eraser",
    hint: "Delete the target and rebuild what is genuinely behind it.",
    needs: null,
    directive:
      "Remove the masked object completely and inpaint the area using the surrounding context: continue the real floor, wall, trim and shadow that the object was covering. Do not leave a blur, a smear or a patch of invented material.",
    classification: "Object Removed",
  },
  {
    id: "replace",
    label: "Replace",
    icon: "repeat",
    hint: "Swap the target for something else at the same scale and position.",
    needs: "replacement",
    directive:
      "Replace the masked object with the described replacement. Match the original object's footprint, scale, perspective, contact shadow and lighting so the replacement looks photographed in this room.",
    classification: "Object Replaced",
  },
  {
    id: "color",
    label: "Change Color",
    icon: "palette",
    hint: "Recolor the target and keep its texture, wear and reflections.",
    needs: "color",
    directive:
      "Recolor the masked object to the requested color. Keep its exact shape, texture, grain, sheen, wear and reflections; only the hue changes.",
    classification: "Object Recolored",
  },
  {
    id: "material",
    label: "Change Material",
    icon: "layers",
    hint: "Apply one catalog material to the target surface.",
    needs: "material",
    directive:
      "Re-surface the masked area with the specified material. Keep the surface's geometry, edges, joints, reflections and lighting; only the material reads differently.",
    classification: "Material Changed",
  },
  {
    id: "restyle",
    label: "Restyle",
    icon: "wand-sparkles",
    hint: "Keep the object but restyle it to a different look.",
    needs: "style",
    directive:
      "Restyle the masked object into the requested style while keeping it the same kind of object, in the same place, at the same scale.",
    classification: "Object Restyled",
  },
  {
    id: "duplicate",
    label: "Duplicate",
    icon: "copy",
    hint: "Add a second, consistent copy beside the target.",
    needs: "instruction",
    directive:
      "Add one more copy of the masked object nearby, as described. The copy must match the original's design, material, scale and lighting, and must stand on the real floor with a correct contact shadow.",
    classification: "Object Duplicated",
    requiresMovable: true,
  },
  {
    id: "move",
    label: "Move",
    icon: "move",
    hint: "Only offered for free-standing objects that can be moved honestly.",
    needs: "instruction",
    directive:
      "Move the masked object to the described position in the same room. Rebuild the area it vacated from the surrounding context and give the object a correct new perspective and contact shadow.",
    classification: "Object Moved",
    requiresMovable: true,
  },
  {
    id: "custom",
    label: "Custom Instruction",
    icon: "pencil-line",
    hint: "Describe the change in your own words.",
    needs: "instruction",
    directive: "Apply the user's instruction to the masked object only.",
    classification: "Object Edited",
  },
];

export function objectAction(id?: string | null): ObjectAction {
  return OBJECT_ACTIONS.find((a) => a.id === id) || OBJECT_ACTIONS[0]!;
}

/**
 * Move and Duplicate only appear when the target can honestly be relocated.
 * An architectural surface cannot be moved, so the tool never offers it.
 */
export function actionSupported(action: ActionId, target: { movable?: boolean } | null): {
  ok: boolean;
  reason: string | null;
} {
  const def = objectAction(action);
  if (!def.requiresMovable) return { ok: true, reason: null };
  if (target && target.movable) return { ok: true, reason: null };
  return {
    ok: false,
    reason:
      def.label +
      " is only offered for free-standing objects. This target reads as architecture or a fixed surface.",
  };
}

export function actionsFor(target: { movable?: boolean } | null): Array<ObjectAction & { supported: boolean; reason: string | null }> {
  return OBJECT_ACTIONS.map((a) => {
    const s = actionSupported(a.id, target);
    return { ...a, supported: s.ok, reason: s.reason };
  });
}

/* ---------------------------------------------------------- detections */

export type Box = { x: number; y: number; w: number; h: number };

export type Detection = {
  id: string;
  label: string;
  category: string;
  box: Box;
  confidence: number;
  /** Free-standing object that could believably be moved or duplicated. */
  movable: boolean;
  /** Architecture, fixtures and structure — never silently edited. */
  architectural: boolean;
  selected: boolean;
  protectedItem: boolean;
};

const clamp01 = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));

function normBox(raw: unknown): Box {
  const b = (raw || {}) as Record<string, unknown>;
  const x = clamp01(b["x"]);
  const y = clamp01(b["y"]);
  return {
    x,
    y,
    w: Math.min(1 - x, Math.max(0.01, Number(b["w"]) || 0.1)),
    h: Math.min(1 - y, Math.max(0.01, Number(b["h"]) || 0.1)),
  };
}

/** Names every detected object, so nothing is ever "Object 3" to the user. */
export function autoName(label: unknown, category: unknown, index: number): string {
  const raw = String(label ?? "").trim();
  if (raw) return raw.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
  const cat = String(category ?? "").trim();
  return (cat ? cat.replace(/\b\w/g, (c) => c.toUpperCase()) : "Object") + " " + (index + 1);
}

export function normalizeDetections(raw: Record<string, unknown>): Detection[] {
  const items = Array.isArray(raw?.["objects"]) ? (raw["objects"] as unknown[]) : [];
  return items.slice(0, 40).map((item, i) => {
    const o = (item || {}) as Record<string, unknown>;
    const architectural = !!o["architectural"];
    return {
      id: "obj_" + i + "_" + Math.random().toString(36).slice(2, 7),
      label: autoName(o["label"], o["category"], i),
      category: String(o["category"] ?? "object").slice(0, 30),
      box: normBox(o["box"]),
      confidence: clamp01(o["confidence"] ?? 0.7),
      movable: !architectural && o["movable"] !== false,
      architectural,
      selected: false,
      protectedItem: architectural,
    };
  });
}

export function roomReadOf(raw: Record<string, unknown>): { roomType: string; surfaces: string[] } {
  return {
    roomType: String(raw?.["room_type"] ?? "room").slice(0, 60),
    surfaces: (Array.isArray(raw?.["surfaces"]) ? (raw["surfaces"] as unknown[]) : [])
      .slice(0, 10)
      .map((s) => String(s).slice(0, 90)),
  };
}

/** Same category and a similar footprint: the "apply to matching" set. */
export function matchingTargets(detections: Detection[], target: Detection | null): Detection[] {
  if (!target) return [];
  const area = target.box.w * target.box.h;
  return detections.filter(
    (d) =>
      d.id !== target.id &&
      !d.architectural &&
      d.category === target.category &&
      Math.abs(d.box.w * d.box.h - area) <= Math.max(0.02, area * 1.2),
  );
}

/* --------------------------------------------------------------- masks */

export type StrokeKind = "add" | "erase" | "protect";

export type Stroke = { x: number; y: number; r: number; kind: StrokeKind };

export type MaskState = {
  strokes: Stroke[];
  redo: Stroke[];
  /** Positive grows the edit mask, negative contracts it, in image fraction. */
  grow: number;
  /** Soft edge in image fraction. */
  feather: number;
  invert: boolean;
};

export const MAX_STROKES = 400;

export function emptyMask(): MaskState {
  return { strokes: [], redo: [], grow: 0, feather: 0.01, invert: false };
}

export function pushStroke(mask: MaskState, stroke: Stroke): MaskState {
  return {
    ...mask,
    strokes: mask.strokes.concat([{ ...stroke, r: Math.max(0.005, Math.min(0.4, stroke.r)) }]).slice(-MAX_STROKES),
    redo: [],
  };
}

export function undoStroke(mask: MaskState): MaskState {
  if (!mask.strokes.length) return mask;
  const strokes = mask.strokes.slice();
  const last = strokes.pop() as Stroke;
  return { ...mask, strokes, redo: mask.redo.concat([last]) };
}

export function redoStroke(mask: MaskState): MaskState {
  if (!mask.redo.length) return mask;
  const redo = mask.redo.slice();
  const back = redo.pop() as Stroke;
  return { ...mask, strokes: mask.strokes.concat([back]), redo };
}

export function growMask(mask: MaskState, delta: number): MaskState {
  return { ...mask, grow: Math.max(-0.08, Math.min(0.08, Number((mask.grow + delta).toFixed(4)))) };
}

export function setFeather(mask: MaskState, value: number): MaskState {
  return { ...mask, feather: Math.max(0, Math.min(0.06, value)) };
}

export function invertMask(mask: MaskState): MaskState {
  return { ...mask, invert: !mask.invert };
}

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

export type MaskRegions = {
  edit: Array<{ label: string; box: Box }>;
  protect: Array<{ label: string; box: Box }>;
  strokes: Stroke[];
};

/**
 * The exact geometry the backend receives. Expand and contract are applied
 * here, so what the overlay draws and what the server is told are the same
 * numbers.
 */
export function maskRegions(detections: Detection[], mask: MaskState): MaskRegions {
  const selected = detections.filter((d) => d.selected);
  const protectedOnes = detections.filter((d) => !d.selected && d.protectedItem);
  const edit = selected.map((d) => ({ label: d.label, box: padBox(d.box, mask.grow) }));
  const protect = protectedOnes.map((d) => ({ label: d.label, box: d.box }));
  return {
    edit: mask.invert ? protect.map((p) => ({ ...p })) : edit,
    protect: mask.invert ? edit.map((e) => ({ ...e })) : protect,
    strokes: mask.strokes.slice(),
  };
}

/** A brush stroke counts: a mask can exist with no detected object at all. */
export function hasMask(detections: Detection[], mask: MaskState): boolean {
  const regions = maskRegions(detections, mask);
  return regions.edit.length > 0 || mask.strokes.some((s) => s.kind === "add");
}

export function maskSummary(detections: Detection[], mask: MaskState): string {
  const regions = maskRegions(detections, mask);
  const brushed = mask.strokes.filter((s) => s.kind === "add").length;
  const protectStrokes = mask.strokes.filter((s) => s.kind === "protect").length;
  const bits: string[] = [];
  if (regions.edit.length) bits.push(regions.edit.map((r) => r.label).join(", "));
  if (brushed) bits.push(brushed + " brushed " + (brushed === 1 ? "area" : "areas"));
  if (!bits.length) return "Nothing selected yet";
  const extra: string[] = [];
  if (regions.protect.length || protectStrokes)
    extra.push(regions.protect.length + protectStrokes + " protected");
  if (mask.invert) extra.push("inverted");
  if (mask.grow) extra.push((mask.grow > 0 ? "expanded" : "contracted") + " edge");
  return bits.join(" · ") + (extra.length ? " (" + extra.join(", ") + ")" : "");
}

/* -------------------------------------------------------------- payload */

export type ObjectEditSettings = {
  action: ActionId;
  /** Free text for Replace, Restyle, Duplicate, Move and Custom. */
  instruction: string | null;
  color: string | null;
  materialId: string | null;
  materialLabel: string | null;
  materialPrompt: string | null;
  surfaceKind: string | null;
  /** Apply the same action to every matching object in this photo. */
  applyToMatching: boolean;
  notes: string | null;
};

export function defaultSettings(): ObjectEditSettings {
  return {
    action: "remove",
    instruction: null,
    color: null,
    materialId: null,
    materialLabel: null,
    materialPrompt: null,
    surfaceKind: null,
    applyToMatching: false,
    notes: null,
  };
}

export type ObjectEditPayload = {
  action: ActionId;
  action_label: string;
  target_label: string;
  targets: Array<{ label: string; box: Box }>;
  protect: Array<{ label: string; box: Box }>;
  strokes: Stroke[];
  grow: number;
  feather: number;
  inverted: boolean;
  room_type: string;
  surfaces: string[];
  instruction: string | null;
  color: string | null;
  material_id: string | null;
  material_label: string | null;
  material_prompt: string | null;
  surface_kind: string | null;
  notes: string | null;
  mask_attached: boolean;
};

export const PRESERVATION_RULES = [
  "Every pixel outside the masked target must be identical to the source photograph.",
  "Do not move the camera, change the lens, re-crop, re-light or re-color the room.",
  "Do not restyle, tidy or improve anything that was not selected.",
  "Keep walls, windows, doors, ceilings, floors and permanent fixtures exactly as photographed unless they are the selected target.",
  "Match the existing white balance, exposure, grain and perspective of the source photograph.",
];

export function objectEditPrompt(payload: ObjectEditPayload): string {
  const def = objectAction(payload.action);
  const lines: string[] = [];
  lines.push(
    "You are performing one targeted edit on a real estate photograph. The second image is the mask overlay: " +
      "the magenta area is the ONLY region you may change, and the green outlines mark protected areas you must not touch.",
  );
  lines.push("Target: " + payload.target_label + ".");
  if (payload.targets.length)
    lines.push(
      "Target regions, normalized 0..1 from the top-left: " +
        payload.targets
          .map(
            (t) =>
              t.label +
              " [x " +
              t.box.x.toFixed(3) +
              ", y " +
              t.box.y.toFixed(3) +
              ", w " +
              t.box.w.toFixed(3) +
              ", h " +
              t.box.h.toFixed(3) +
              "]",
          )
          .join("; ") +
        ".",
    );
  if (payload.protect.length)
    lines.push("Protected regions that must survive unchanged: " + payload.protect.map((p) => p.label).join(", ") + ".");
  if (payload.inverted) lines.push("The selection is inverted: edit everything marked magenta, not the outlined object.");
  lines.push("Action: " + def.label + ". " + def.directive);
  if (payload.instruction) lines.push("The user asks for: " + payload.instruction);
  if (payload.color) lines.push("New color: " + payload.color + ".");
  if (payload.material_prompt || payload.material_label)
    lines.push(
      "New material: " +
        (payload.material_label || "") +
        (payload.material_prompt ? " — " + payload.material_prompt : "") +
        (payload.surface_kind ? " applied to the " + payload.surface_kind + " only." : "."),
    );
  if (payload.surfaces.length) lines.push("Real surfaces visible in this room: " + payload.surfaces.join("; ") + ".");
  if (payload.room_type) lines.push("Room type: " + payload.room_type + ".");
  if (payload.notes) lines.push("Additional user instructions: " + payload.notes);
  if (payload.feather)
    lines.push("Blend the edited edge softly over roughly " + Math.round(payload.feather * 100) + "% of the frame width.");
  lines.push(PRESERVATION_RULES.join(" "));
  lines.push("Return one photorealistic image at the same aspect ratio and resolution as the source.");
  return lines.join("\n");
}

/* --------------------------------------------------------------- brief */

export const CREDITS_PER_EDIT = 1;

export type ObjectEditRun = { id: string; label: string; directive: string };

export type ObjectEditBrief = {
  valid: boolean;
  missing: string[];
  credits: number;
  targetLabel: string;
  actionLabel: string;
  summary: string;
  payload: ObjectEditPayload;
  runs: ObjectEditRun[];
  classification: string;
};

export type BriefInput = {
  hasSource: boolean;
  detections: Detection[];
  mask: MaskState;
  settings: ObjectEditSettings;
  roomType?: string | null;
  surfaces?: string[];
};

export function buildObjectEditBrief(input: BriefInput): ObjectEditBrief {
  const s = input.settings;
  const def = objectAction(s.action);
  const regions = maskRegions(input.detections, input.mask);
  const selected = input.detections.filter((d) => d.selected);
  const primary = selected[0] || null;
  const brushed = input.mask.strokes.filter((x) => x.kind === "add").length;

  const missing: string[] = [];
  if (!input.hasSource) missing.push("Add A Source Photo");
  if (!hasMask(input.detections, input.mask)) missing.push("Select Or Brush The Target");
  const support = actionSupported(s.action, primary);
  if (!support.ok) missing.push(support.reason as string);
  if (def.needs === "replacement" && !s.instruction) missing.push("Describe The Replacement");
  if (def.needs === "color" && !s.color) missing.push("Choose A Color");
  if (def.needs === "material" && !s.materialId) missing.push("Choose A Material");
  if (def.needs === "style" && !s.instruction) missing.push("Describe The New Style");
  if (def.needs === "instruction" && !s.instruction) missing.push("Write Your Instruction");

  const targets = s.applyToMatching
    ? regions.edit.concat(
        matchingTargets(input.detections, primary).map((m) => ({ label: m.label, box: padBox(m.box, input.mask.grow) })),
      )
    : regions.edit;

  const targetLabel =
    targets.length > 1
      ? targets.length + " Objects (" + targets.map((t) => t.label).slice(0, 3).join(", ") + ")"
      : targets[0]?.label || (brushed ? "Your Brushed Area" : "No Target");

  const payload: ObjectEditPayload = {
    action: s.action,
    action_label: def.label,
    target_label: targetLabel,
    targets,
    protect: regions.protect,
    strokes: regions.strokes,
    grow: input.mask.grow,
    feather: input.mask.feather,
    inverted: input.mask.invert,
    room_type: input.roomType || "room",
    surfaces: (input.surfaces || []).slice(0, 10),
    instruction: s.instruction,
    color: s.color,
    material_id: s.materialId,
    material_label: s.materialLabel,
    material_prompt: s.materialPrompt,
    surface_kind: s.surfaceKind,
    notes: s.notes,
    mask_attached: true,
  };

  return {
    valid: missing.length === 0,
    missing,
    credits: CREDITS_PER_EDIT,
    targetLabel,
    actionLabel: def.label,
    summary: def.label + " · " + targetLabel,
    payload,
    runs: [{ id: "run_1", label: def.label, directive: def.directive }],
    classification: def.classification,
  };
}

/** The one sentence shown before any credit is spent. */
export function costSentence(brief: ObjectEditBrief): string {
  return (
    brief.actionLabel +
    " will be applied to " +
    brief.targetLabel +
    " for " +
    brief.credits +
    " credit" +
    (brief.credits === 1 ? "" : "s") +
    ". Everything outside your selection is preserved."
  );
}

/* --------------------------------------------------- preservation check */

export const PRESERVATION_CHECKS = [
  { id: "outside_changed", question: "Did anything outside the masked target change?" },
  { id: "protected_changed", question: "Was any protected region altered?" },
  { id: "camera_moved", question: "Did the camera position, crop or lens change?" },
  { id: "relight", question: "Was the whole photo re-lit, re-colored or re-graded?" },
  { id: "target_untouched", question: "Was the requested change actually applied to the target?" },
  { id: "artifacts", question: "Are there smears, ghosts or blurred patches at the edited edge?" },
];

export type PreservationIssue = { id: string; severity: "minor" | "major"; detail: string };

export type PreservationReport = {
  issues: PreservationIssue[];
  /** Rough share of the image outside the mask that changed, 0..1. */
  drift: number;
  rejected: boolean;
  headline: string;
};

export const DRIFT_THRESHOLD = 0.08;

export function normalizePreservation(raw: Record<string, unknown>): PreservationReport {
  const list = Array.isArray(raw?.["issues"]) ? (raw["issues"] as unknown[]) : [];
  const issues: PreservationIssue[] = list.slice(0, 8).map((item) => {
    const o = (item || {}) as Record<string, unknown>;
    return {
      id: String(o["id"] ?? "outside_changed").slice(0, 30),
      severity: o["severity"] === "major" ? "major" : "minor",
      detail: String(o["detail"] ?? "").slice(0, 200),
    };
  });
  const drift = clamp01(raw?.["drift"] ?? 0);
  const major = issues.filter((i) => i.severity === "major");
  const rejected = drift > DRIFT_THRESHOLD || major.some((i) => i.id !== "target_untouched") || major.length > 1;
  return {
    issues,
    drift,
    rejected,
    headline: rejected
      ? "This result changed more than your selection"
      : issues.length
        ? "Small differences were found outside your selection"
        : "Only your selection changed",
  };
}

/* ------------------------------------------------------------- history */

export type ObjectEditRecord = {
  action: ActionId;
  action_label: string;
  target_label: string;
  classification: string;
  source_version: string | null;
  mask: { targets: Array<{ label: string; box: Box }>; protect: Array<{ label: string; box: Box }>; strokes: Stroke[]; grow: number; feather: number; inverted: boolean };
  instruction: string | null;
  material: { id: string | null; label: string | null; surface: string | null } | null;
  mask_overlay_path: string | null;
  model: string | null;
};

/** The metadata stored with every accepted Object Edit version. */
export function objectEditMeta(args: {
  payload: ObjectEditPayload;
  sourceVersion: string | null;
  overlayPath?: string | null;
  model?: string | null;
}): ObjectEditRecord {
  const p = args.payload;
  return {
    action: p.action,
    action_label: p.action_label,
    target_label: p.target_label,
    classification: objectAction(p.action).classification,
    source_version: args.sourceVersion,
    mask: {
      targets: p.targets,
      protect: p.protect,
      strokes: p.strokes,
      grow: p.grow,
      feather: p.feather,
      inverted: p.inverted,
    },
    instruction: p.instruction,
    material: p.material_id
      ? { id: p.material_id, label: p.material_label, surface: p.surface_kind }
      : null,
    mask_overlay_path: args.overlayPath ?? null,
    model: args.model ?? null,
  };
}

/** Replacements the user can reuse on the next room. */
export type SavedReplacement = {
  id: string;
  label: string;
  action: ActionId;
  instruction: string | null;
  materialId: string | null;
  materialLabel: string | null;
  color: string | null;
};

export const REPLACEMENT_STORE_KEY = "rd.objectEdit.replacements";

export function replacementFrom(settings: ObjectEditSettings, targetLabel: string): SavedReplacement {
  return {
    id: "rep_" + Math.random().toString(36).slice(2, 9),
    label:
      objectAction(settings.action).label +
      " · " +
      (settings.materialLabel || settings.color || settings.instruction || targetLabel).slice(0, 48),
    action: settings.action,
    instruction: settings.instruction,
    materialId: settings.materialId,
    materialLabel: settings.materialLabel,
    color: settings.color,
  };
}
