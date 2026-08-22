/**
 * REAL DESIGNS — shared Photo Editor context rules.
 *
 * Pure, testable decisions for the ONE full-screen editor: which mode it runs
 * in, which enhancements make sense for the photograph in front of the user,
 * how the action footer lays out at the panel's real width, and what the
 * primary save action must be called so a persisted version is never silently
 * overwritten.
 */

export type EditorMode = "source" | "generated" | "media";

/** The contract every "Edit Photo" entry point passes to the editor. */
export type EditorEntry = {
  assetId: string;
  assetType?: "uploaded_image" | "generated_image" | "edited_image" | string;
  storagePath?: string;
  propertyId?: string;
  roomId?: string;
  versionId?: string;
  parentVersionId?: string;
  editorMode: EditorMode;
};

export type PhotoTraitsInput = {
  room?: string;
  space?: string;
  name?: string;
  assetType?: string;
};

export type PhotoTraits = {
  interior: boolean;
  hasSky: boolean;
  hasWindows: boolean;
};

const EXTERIOR_WORDS = [
  "exterior",
  "front",
  "facade",
  "yard",
  "lawn",
  "garden",
  "patio",
  "deck",
  "pool",
  "backyard",
  "curb",
  "driveway",
  "porch",
  "balcony",
  "roof",
  "aerial",
  "street",
];

const NO_WINDOW_WORDS = ["closet", "pantry", "hallway", "basement", "garage", "laundry", "powder"];

/**
 * Best-effort scene classification from the room/space labels the app already
 * carries. Conservative: when nothing is known we assume an interior room with
 * windows, because those controls are harmless, and we hide the outdoor-only
 * operations that would look absurd on a kitchen.
 */
export function detectPhotoTraits(input: PhotoTraitsInput = {}): PhotoTraits {
  const text = [input.space, input.room, input.name].filter(Boolean).join(" ").toLowerCase();
  const exterior = EXTERIOR_WORDS.some((w) => text.includes(w));
  return {
    interior: !exterior,
    hasSky: exterior,
    hasWindows: exterior ? true : !NO_WINDOW_WORDS.some((w) => text.includes(w)),
  };
}

export type EnhancementDef = {
  op: string;
  label: string;
  icon: string;
  /** Server-side AI operation that consumes credits. */
  credits: number;
  /** Needs an explicit selection/confirmation step before it can run. */
  requiresTarget?: boolean;
};

/**
 * AI Enhancements. Real-estate specific, credit-bearing, never automatic.
 * Auto Enhance is NOT here: it is an ordinary, free, local photo adjustment.
 * Object removal is NOT here either — Object Edit owns the one implementation.
 */
const PHOTO_ENHANCEMENTS: EnhancementDef[] = [
  { op: "window_balance", label: "Window Balance", icon: "panel-top", credits: 1 },
  { op: "sky", label: "Sky Enhancement", icon: "cloud-sun", credits: 1 },
  { op: "lawn", label: "Lawn Enhancement", icon: "trees", credits: 1 },
  { op: "dusk", label: "Day To Dusk", icon: "moon", credits: 1 },
  { op: "reflection", label: "Reflection Removal", icon: "sparkle", credits: 1, requiresTarget: true },
  { op: "tv_off", label: "TV Screen Cleanup", icon: "tv", credits: 1, requiresTarget: true },
  { op: "fireplace", label: "Fireplace Enhancement", icon: "flame", credits: 1, requiresTarget: true },
];

/** What Privacy Blur is allowed to obscure. Manual is always available. */
export const PRIVACY_TARGETS: { id: string; label: string; icon: string }[] = [
  { id: "faces", label: "Faces", icon: "user-round" },
  { id: "plates", label: "License Plates", icon: "car" },
  { id: "documents", label: "Documents", icon: "file-text" },
  { id: "screens", label: "Screens", icon: "monitor" },
  { id: "manual", label: "Manual Area", icon: "square-dashed" },
];

/** Instruction sent to the server for the chosen Privacy Blur targets. */
export function privacyInstruction(targets: string[]): string {
  const picked = PRIVACY_TARGETS.filter((t) => targets.includes(t.id) && t.id !== "manual").map((t) =>
    t.label.toLowerCase(),
  );
  const manual = targets.includes("manual");
  const parts: string[] = [];
  if (picked.length) parts.push(`Obscure only: ${picked.join(", ")}.`);
  if (manual) parts.push("Obscure the area the user marked on the photograph.");
  if (!parts.length) parts.push("Obscure personally identifying details only.");
  parts.push("Do not alter the room, furniture, finishes or any other part of the photograph.");
  return parts.join(" ");
}

/** Photo Enhancements available for this photograph. Context aware. */
export function photoEnhancements(traits: PhotoTraits): EnhancementDef[] {
  return PHOTO_ENHANCEMENTS.filter((e) => {
    if (e.op === "lawn") return !traits.interior;
    if (e.op === "sky") return traits.hasSky;
    if (e.op === "window_balance") return traits.hasWindows;
    if (e.op === "fireplace" || e.op === "tv_off" || e.op === "reflection") return traits.interior;
    return true;
  });
}


/* ------------------------------------------------------------- handoffs */

export type ContinueTool = {
  /** Rail tool name, or "object" for the Object Edit rail button. */
  tool: string;
  label: string;
  icon: string;
  blurb: string;
};

/**
 * Edit Photo never re-implements a rail tool. It hands the active asset over
 * to the canonical one, with nothing generated and no credit spent.
 */
export function continueWithTools(): ContinueTool[] {
  return [
    { tool: "Redesign", label: "Redesign", icon: "wand-sparkles", blurb: "Create a new design while preserving the room's structure." },
    { tool: "Virtual Stage", label: "Stage", icon: "sofa", blurb: "Add furniture and décor to an empty or furnished room." },
    { tool: "Declutter", label: "Declutter", icon: "eraser", blurb: "Remove unwanted furniture and visual clutter." },
    { tool: "Material Swap", label: "Materials", icon: "paintbrush", blurb: "Change floors, walls, counters, cabinets, and finishes." },
    { tool: "object", label: "Object Edit", icon: "mouse-pointer-square-dashed", blurb: "Select, remove, replace, or modify a specific object." },
  ];
}


export function enhancementByOp(op: string): EnhancementDef | undefined {
  return PHOTO_ENHANCEMENTS.find((e) => e.op === op);
}

/* ----------------------------------------------------------------- footer */

export type FooterLayout = "row" | "stack";

/**
 * The footer wraps on the panel's own width, not the browser's. Three long
 * labels only share a row when they genuinely fit.
 */
export function footerLayout(panelWidth: number): FooterLayout {
  return panelWidth >= 420 ? "row" : "stack";
}

/* ------------------------------------------------------------ save labels */

export type SaveContext = { mode: EditorMode; hasPersistedVersion?: boolean };

/** Primary action label. A persisted version is never overwritten in place. */
export function primarySaveLabel(ctx: SaveContext): string {
  if (ctx.mode === "generated" && ctx.hasPersistedVersion !== false) return "Save As New Version";
  return "Save Changes";
}

/** Version History provenance line for an edited child version. */
export function editedFromLabel(parentVersionNumber?: number | null): string | null {
  if (!parentVersionNumber && parentVersionNumber !== 0) return null;
  return `Edited From Version ${parentVersionNumber}`;
}

/** After saving source edits, which image should generation consume? */
export function defaultGenerationSource(mode: EditorMode): "edited" | "original" {
  return mode === "source" ? "edited" : "original";
}

/* ------------------------------------------------------------- panel plan */

export type PanelSection = { id: string; label: string; icon: string; long: boolean };

export const PANEL_SECTIONS: PanelSection[] = [
  { id: "auto", label: "Auto Enhance", icon: "wand-sparkles", long: false },
  { id: "light", label: "Light & Color", icon: "sun", long: true },
  { id: "detail", label: "Detail", icon: "focus", long: true },
  { id: "crop", label: "Crop & Geometry", icon: "crop", long: true },
  { id: "ai", label: "AI Enhancements", icon: "sparkles", long: false },
  { id: "continue", label: "Continue With", icon: "arrow-right-circle", long: false },
];

/** Only Auto Enhance is expanded when the editor opens. */
export function defaultOpenSections(): string[] {
  return ["auto"];
}

/** Hold To Compare only means something once something changed. */
export function compareEnabled(hasEdits: boolean): boolean {
  return hasEdits;
}
