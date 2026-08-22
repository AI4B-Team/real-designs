/**
 * REAL DESIGNS — the one authoritative "active image" contract.
 *
 * Canvas, the Photo Editor, Media and Version History all act on exactly one
 * visible image. That image is described here, once, and every action — Open
 * Canvas, Edit Photo, Generate, Approve, Download, Shop, Video, Presentation —
 * reads the same record.
 *
 * Nothing in this module inspects the latest room, the newest Media asset, a
 * display label, a browser URL, the first selected photo or a global
 * `lastRender`: the target is always passed in explicitly.
 */

import type { EditorMode } from "@/lib/photo-editor-context";

export type ReturnDestination =
  | "prepare-photos"
  | "canvas"
  | "media"
  | "version-history"
  | "property-photos"
  | "studio";

export type ActiveImageKind =
  | "original-source"
  | "edited-source"
  | "generated-version"
  | "edited-generated";

/** The record every surface passes around. Ids are durable, never blob URLs. */
export type ActiveImage = {
  assetId: string;
  assetType: "uploaded_image" | "generated_image" | "edited_image";
  /** The upload every derivative descends from. */
  sourceAssetId: string | null;
  /** Storage path of the source currently used for generation. */
  activeSourcePath: string | null;
  activeVersionId: string | null;
  activeVersionPath: string | null;
  roomId: string | null;
  propertyId: string | null;
  draftId: string | null;
  returnDestination: ReturnDestination;
  /** True once a source has a saved derivative that replaces the upload. */
  editedSource?: boolean;
  /** Set on a version that was produced by the Photo Editor. */
  editedFromVersionNo?: number | null;
};

const DESTINATION_LABELS: Record<ReturnDestination, string> = {
  "prepare-photos": "Return To Prepare Photos",
  canvas: "Return To Canvas",
  media: "Return To Media",
  "version-history": "Return To Version History",
  "property-photos": "Return To Property Photos",
  studio: "Return To Studio",
};

/** Contextual accessible label for the editor's close control. */
export function returnLabel(dest: ReturnDestination | undefined | null): string {
  return DESTINATION_LABELS[(dest || "canvas") as ReturnDestination] || "Close Photo Editor";
}

/**
 * What the user is actually looking at. The editor uses this to decide whether
 * a save produces a source derivative or a child version — it must never guess
 * from an older image.
 */
export function activeImageKind(a: ActiveImage): ActiveImageKind {
  if (a.activeVersionId) return a.assetType === "edited_image" ? "edited-generated" : "generated-version";
  return a.editedSource ? "edited-source" : "original-source";
}

/** Source edits and generated finishing are different modes of ONE editor. */
export function editorModeFor(a: ActiveImage): EditorMode {
  return a.activeVersionId ? "generated" : "source";
}

/**
 * The storage path the editor must load. Always the visible image: the active
 * version when one exists, otherwise the active (possibly edited) source.
 */
export function activePath(a: ActiveImage): string | null {
  return a.activeVersionId ? a.activeVersionPath || null : a.activeSourcePath || null;
}

/** Generation always consumes the currently active source, never the raw upload. */
export function generationSourcePath(a: ActiveImage): string | null {
  return a.activeSourcePath || null;
}

/** The entry payload handed to `openPhotoEditor`. One shape, every surface. */
export function editorEntry(a: ActiveImage): {
  assetId: string;
  assetType: ActiveImage["assetType"];
  storagePath: string;
  propertyId: string | undefined;
  roomId: string | undefined;
  versionId: string | undefined;
  parentVersionId: string | undefined;
  editorMode: EditorMode;
  returnDestination: ReturnDestination;
} {
  return {
    assetId: a.assetId,
    assetType: a.assetType,
    storagePath: activePath(a) || "",
    propertyId: a.propertyId || undefined,
    roomId: a.roomId || undefined,
    versionId: a.activeVersionId || undefined,
    parentVersionId: a.activeVersionId || undefined,
    editorMode: editorModeFor(a),
    returnDestination: a.returnDestination,
  };
}

/**
 * Primary save label. A persisted version is never written over: once a
 * version exists the editor creates a child, and the button must say so.
 */
export function saveActionLabel(a: ActiveImage): string {
  return a.activeVersionId ? "Save As New Version" : "Save Changes";
}

/** Lineage line for Version History, e.g. `Edited From Version 7`. */
export function lineageLabel(versionNo: number | null | undefined): string {
  return Number(versionNo) > 0 ? `Edited From Version ${Number(versionNo)}` : "";
}

export type OpenCanvasContext = {
  draftId: string | null;
  assetId: string;
  storagePath: string | null;
  propertyId: string | null;
  roomId: string | null;
  roomTypeId: string | null;
  sourceVersionId: string | null;
  selectedPhotoIndex: number;
  returnDestination: ReturnDestination;
};

/**
 * Durable context for opening one Prepare Photos card in the room Canvas.
 * Opening only configures the workspace: it never generates, never spends a
 * credit and never touches the rest of the batch.
 */
export function openCanvasContext(input: {
  draftId?: string | null;
  assetId: string;
  storagePath?: string | null;
  propertyId?: string | null;
  roomId?: string | null;
  roomTypeId?: string | null;
  sourceVersionId?: string | null;
  index?: number;
}): OpenCanvasContext {
  return {
    draftId: input.draftId || null,
    assetId: input.assetId,
    storagePath: input.storagePath || null,
    propertyId: input.propertyId || null,
    roomId: input.roomId || null,
    roomTypeId: input.roomTypeId || null,
    sourceVersionId: input.sourceVersionId || null,
    selectedPhotoIndex: Math.max(0, Number(input.index) || 0),
    returnDestination: "prepare-photos",
  };
}

/** A card may only be opened in Canvas once it has a usable stored image. */
export function canOpenCanvas(card: { status?: string; path?: string | null; previewUrl?: string | null }): boolean {
  if (!card) return false;
  if (card.status === "failed" || card.status === "uploading") return false;
  return !!(card.path || card.previewUrl);
}

/** Room type is required before generating — never silently assumed. */
export function canvasRequirement(card: { room?: string | null }): string {
  return card && card.room ? "" : "Choose A Room Type Before Generating.";
}
