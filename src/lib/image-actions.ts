/**
 * The canonical registry of image actions.
 *
 * Every surface that shows a design image — the Canvas, Media cards, the Media
 * details drawer, Designs, the property room gallery, Version History and
 * Explore — draws its buttons from this table. One icon therefore always means
 * one action, with the same label, the same tooltip and the same eligibility
 * rule, whichever screen it is on.
 */

export type ImageActionId =
  | "edit"
  | "createVariation"
  | "shop"
  | "favorite"
  | "approve"
  | "download"
  | "sendToVideo"
  | "addToPresentation"
  | "compare"
  | "fullscreen"
  | "more";

export type ImageSurface =
  | "canvas"
  | "media-card"
  | "media-drawer"
  | "designs"
  | "room-gallery"
  | "version-history"
  | "explore";

/** What the surface knows about the image the user is acting on. */
export interface ImageActionContext {
  propertyId?: string | null;
  roomId?: string | null;
  versionId?: string | null;
  versionNo?: number | null;
  /** Durable storage path. Absent while a result is still being saved. */
  resultPath?: string | null;
  sourcePath?: string | null;
  status?: "saving" | "ready" | "failed" | "approved";
  /** Product detection finished for this exact version. */
  shopReady?: boolean;
  busy?: boolean;
}

export interface ImageActionSpec {
  id: ImageActionId;
  icon: string;
  label: string;
  tooltip: string;
  /** False hides the control entirely; disabled only greys it out. */
  eligible: (c: ImageActionContext) => boolean;
  enabled: (c: ImageActionContext) => boolean;
}

const durable = (c: ImageActionContext) => !!c.resultPath && c.status !== "saving";

export const IMAGE_ACTIONS: Record<ImageActionId, ImageActionSpec> = {
  edit: {
    id: "edit",
    icon: "pencil",
    label: "Edit",
    tooltip: "Edit This Design",
    eligible: () => true,
    enabled: (c) => !c.busy,
  },
  createVariation: {
    id: "createVariation",
    icon: "git-branch",
    label: "Create Variation",
    tooltip: "Create A Variation Of This Design",
    eligible: () => true,
    enabled: (c) => !c.busy,
  },
  shop: {
    id: "shop",
    icon: "shopping-bag",
    label: "Shop This Design",
    tooltip: "Shop The Products In This Design",
    /* Hidden until product detection has run for this exact version. */
    eligible: (c) => c.shopReady === true,
    enabled: (c) => c.shopReady === true && !c.busy,
  },
  favorite: {
    id: "favorite",
    icon: "heart",
    label: "Favorite",
    tooltip: "Save To Favorites",
    eligible: () => true,
    enabled: durable,
  },
  approve: {
    id: "approve",
    icon: "check-check",
    label: "Approve",
    tooltip: "Approve This Version",
    /* Only a persistent version can be approved. */
    eligible: (c) => !!c.versionId,
    enabled: (c) => !!c.versionId && c.status !== "saving" && !c.busy,
  },
  download: {
    id: "download",
    icon: "download",
    label: "Download",
    tooltip: "Download This Image",
    eligible: () => true,
    enabled: (c) => durable(c) && !c.busy,
  },
  sendToVideo: {
    id: "sendToVideo",
    icon: "clapperboard",
    label: "Create Video",
    tooltip: "Create A Video From This Design",
    eligible: () => true,
    enabled: durable,
  },
  addToPresentation: {
    id: "addToPresentation",
    icon: "presentation",
    label: "Add To Presentation",
    tooltip: "Add This Design To A Presentation",
    eligible: () => true,
    enabled: durable,
  },
  compare: {
    id: "compare",
    icon: "columns-2",
    label: "Compare",
    tooltip: "Compare With The Original Photo",
    eligible: (c) => !!c.sourcePath,
    enabled: (c) => !!c.sourcePath,
  },
  fullscreen: {
    id: "fullscreen",
    icon: "maximize-2",
    label: "Full Screen",
    tooltip: "View Full Screen",
    eligible: () => true,
    enabled: () => true,
  },
  more: {
    id: "more",
    icon: "ellipsis",
    label: "More",
    tooltip: "More Actions",
    eligible: () => true,
    enabled: () => true,
  },
};

export function imageAction(id: ImageActionId) {
  return IMAGE_ACTIONS[id];
}

/** Actions a surface should show, in canonical order, for this context. */
export function visibleActions(ids: ImageActionId[], ctx: ImageActionContext) {
  return ids.map((id) => IMAGE_ACTIONS[id]).filter((a) => a && a.eligible(ctx));
}

export interface ImageActionEvent {
  actionId: ImageActionId;
  sourceSurface: ImageSurface;
  propertyId?: string | null;
  roomId?: string | null;
  versionId?: string | null;
  resultPath?: string | null;
  at: number;
}

const LOG: ImageActionEvent[] = [];

/** Development diagnostics: what ran, from where, against which version. */
export function recordImageAction(
  actionId: ImageActionId,
  surface: ImageSurface,
  ctx: ImageActionContext,
): ImageActionEvent {
  const ev: ImageActionEvent = {
    actionId,
    sourceSurface: surface,
    propertyId: ctx.propertyId ?? null,
    roomId: ctx.roomId ?? null,
    versionId: ctx.versionId ?? null,
    resultPath: ctx.resultPath ?? null,
    at: Date.now(),
  };
  LOG.push(ev);
  if (LOG.length > 100) LOG.shift();
  try {
    (window as any).__rdImageActions = LOG;
  } catch (_) {
    /* diagnostics are optional */
  }
  return ev;
}

export function imageActionLog() {
  return LOG.slice();
}
