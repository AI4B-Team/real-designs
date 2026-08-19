/**
 * Canvas routing and initialization rules.
 *
 * The Photo Design / Video Canvas used to bounce back to Studio whenever a
 * photo, property, room or draft record had simply not arrived yet. Empty is
 * not the same as missing: this module makes the difference explicit so no
 * effect can navigate on a temporary null, and only a definitively missing or
 * unauthorized record sends the user back.
 */

export type CanvasStatus = "loading" | "loaded" | "missing" | "unauthorized" | "network-error";

export type CanvasWorkflow = "photo-design" | "video";

/** Everything an open Canvas needs to keep working after a refresh. */
export type CanvasEntry = {
  photoKey: string;
  draftId: string;
  propertyId: string | null;
  roomType: string | null;
  sourcePath: string | null;
  sourceUrl: string | null;
  workflow: CanvasWorkflow;
  /** Where Back (and "Back To Photos") returns the user. */
  returnTo: string;
};

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): string | null => {
  const out = s(v).trim();
  return out ? out : null;
};

/** Normalize a card handoff into a complete, persistable Canvas entry. */
export function canvasEntryFrom(input: Partial<CanvasEntry> & { photoKey?: unknown }): CanvasEntry {
  const workflow: CanvasWorkflow = input.workflow === "video" ? "video" : "photo-design";
  return {
    photoKey: s(input.photoKey),
    draftId: s(input.draftId),
    propertyId: n(input.propertyId),
    roomType: n(input.roomType),
    sourcePath: n(input.sourcePath),
    sourceUrl: n(input.sourceUrl),
    workflow,
    returnTo: n(input.returnTo) || (workflow === "video" ? "reveal" : "staging"),
  };
}

/** A Canvas entry is only usable when it names a photo. */
export function canvasEntryIsComplete(entry: CanvasEntry | null | undefined): boolean {
  return !!entry && !!entry.photoKey && (!!entry.sourcePath || !!entry.sourceUrl);
}

/** Browser Back and the header action share one destination. */
export function backDestination(entry: CanvasEntry | null | undefined): string {
  return entry && entry.returnTo ? entry.returnTo : "staging";
}

/* ------------------------------------------------------------ route guard */

/**
 * Redirect only after loading finished and the record is definitively gone or
 * not ours. Loading, a transient network failure and an empty-but-loaded
 * record all stay on the Canvas.
 */
export function shouldLeaveCanvas(status: CanvasStatus): boolean {
  return status === "missing" || status === "unauthorized";
}

export type CanvasView = "skeleton" | "canvas" | "error" | "redirect";

/** What the Canvas renders for a given load status. */
export function canvasView(status: CanvasStatus): CanvasView {
  if (status === "loading") return "skeleton";
  if (status === "network-error") return "error";
  if (shouldLeaveCanvas(status)) return "redirect";
  return "canvas";
}

/** Classify a load result without guessing: empty data is not "missing". */
export function classifyLoad(result: {
  pending?: boolean;
  error?: { status?: number; kind?: string } | null;
  record?: unknown;
}): CanvasStatus {
  if (result.pending) return "loading";
  const err = result.error;
  if (err) {
    const code = Number(err.status || 0);
    if (code === 401 || code === 403 || err.kind === "auth") return "unauthorized";
    if (code === 404 || err.kind === "missing") return "missing";
    return "network-error";
  }
  if (result.record === null || result.record === undefined) return "missing";
  return "loaded";
}

/** The recoverable failure state always offers both ways out. */
export function errorActions(status: CanvasStatus): Array<{ id: string; label: string }> {
  if (status !== "network-error") return [];
  return [
    { id: "retry", label: "Retry" },
    { id: "back", label: "Back To Photos" },
  ];
}

/* -------------------------------------------------- open / stale requests */

export type CanvasOpenStore = { token: number; key: string };

export function createOpenStore(): CanvasOpenStore {
  return { token: 0, key: "" };
}

/** Start one Canvas open; the token invalidates every earlier open. */
export function beginCanvasOpen(store: CanvasOpenStore, photoKey: string): number {
  store.token += 1;
  store.key = s(photoKey);
  return store.token;
}

/** True while this open is still the newest one for the same photo. */
export function canvasOpenIsCurrent(
  store: CanvasOpenStore,
  token: number,
  photoKey?: string,
): boolean {
  if (token !== store.token) return false;
  if (photoKey !== undefined && s(photoKey) !== store.key) return false;
  return true;
}

/** Re-clicking the photo already opening is a no-op, not a second init. */
export function isDuplicateOpen(
  store: CanvasOpenStore,
  photoKey: string,
  status: CanvasStatus,
): boolean {
  return status === "loading" && store.key === s(photoKey) && store.token > 0;
}

/* ------------------------------------------------------------------ modals */

/**
 * Canceling a modal closes it. It never navigates and never edits saved
 * state, so the workflow the user came from is still there afterwards.
 */
export function cancelModal<T>(state: T): { state: T; navigate: null; persist: false } {
  return { state, navigate: null, persist: false };
}
