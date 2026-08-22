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

const PHOTO_ENHANCEMENTS: EnhancementDef[] = [
  { op: "auto_enhance", label: "Auto Enhance", icon: "wand-sparkles", credits: 1 },
  { op: "window_balance", label: "Window Balance", icon: "panel-top", credits: 1 },
  { op: "sky", label: "Sky Replacement", icon: "cloud-sun", credits: 1 },
  { op: "lawn", label: "Lawn Enhancement", icon: "trees", credits: 1 },
  { op: "dusk", label: "Day To Dusk", icon: "moon", credits: 1 },
  { op: "privacy_blur", label: "Privacy Blur", icon: "shield", credits: 1, requiresTarget: true },
];

const GENERATIVE_EDITS: EnhancementDef[] = [
  { op: "object_removal", label: "Object Removal", icon: "eraser", credits: 1, requiresTarget: true },
  { op: "declutter", label: "Declutter", icon: "sparkles", credits: 1, requiresTarget: true },
];

/** Photo Enhancements available for this photograph. Context aware. */
export function photoEnhancements(traits: PhotoTraits): EnhancementDef[] {
  return PHOTO_ENHANCEMENTS.filter((e) => {
    if (e.op === "lawn") return !traits.interior;
    if (e.op === "sky") return traits.hasSky;
    if (e.op === "window_balance") return traits.hasWindows;
    return true;
  });
}

/** Generative Edits — scene-altering, always confirmed, always a new version. */
export function generativeEdits(): EnhancementDef[] {
  return GENERATIVE_EDITS;
}

export function enhancementByOp(op: string): EnhancementDef | undefined {
  return [...PHOTO_ENHANCEMENTS, ...GENERATIVE_EDITS].find((e) => e.op === op);
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
  { id: "light", label: "Light", icon: "sun", long: true },
  { id: "color", label: "Color", icon: "palette", long: true },
  { id: "detail", label: "Detail", icon: "focus", long: true },
  { id: "crop", label: "Crop & Rotate", icon: "crop", long: true },
  { id: "enhance", label: "Photo Enhancements", icon: "sparkles", long: false },
  { id: "generative", label: "Generative Edits", icon: "wand", long: false },
];

/** Only one long section is expanded when the editor opens. */
export function defaultOpenSections(): string[] {
  return ["light"];
}

/** Hold To Compare only means something once something changed. */
export function compareEnabled(hasEdits: boolean): boolean {
  return hasEdits;
}
