/**
 * Studio context and route rules.
 *
 * The Studio view hosts two different things and they must never be confused:
 * a generic session (may open the source chooser and start a new project) and
 * a Photo Design Canvas (belongs to an existing Photo Design draft and always
 * keeps its draft, active photo, All Rooms header and room filmstrip).
 *
 * The context is explicit state. It is never inferred from the DOM or from
 * whether an image happens to be on the canvas.
 */

export type StudioContext =
  { type: "generic" } | { type: "photo-design-canvas"; draftId: string; photoKey: string };

export const GENERIC_STUDIO: StudioContext = { type: "generic" };

export function photoCanvasContext(draftId: string, photoKey: string): StudioContext {
  return {
    type: "photo-design-canvas",
    draftId: String(draftId || ""),
    photoKey: String(photoKey || ""),
  };
}

export function isPhotoCanvas(ctx: StudioContext | null | undefined): boolean {
  return !!ctx && ctx.type === "photo-design-canvas";
}

/* ------------------------------------------------------------------ routes */

/** The one canonical Studio route. */
export const STUDIO_HASH = "#v-studio";

/** Legacy "#studio" normalizes to the canonical hash exactly once. */
export function canonicalHash(hash: string): string {
  const raw = String(hash || "")
    .replace(/^#/, "")
    .replace(/^v-/, "");
  return raw ? "#v-" + raw : "";
}

export function isStudioRoute(hash: string): boolean {
  return canonicalHash(hash) === STUDIO_HASH;
}

/** True when the hash is already canonical and needs no rewrite. */
export function needsNormalize(hash: string): boolean {
  const c = canonicalHash(hash);
  return !!c && c !== String(hash || "");
}

/* --------------------------------------------------------------- subtitles */

export type CanvasPhase = "" | "generating" | "error";

/** The single dynamic Canvas subtitle. There is never a second one. */
export function canvasSubtitle(opts: {
  empty: boolean;
  result: boolean;
  phase?: CanvasPhase;
}): string {
  if (opts.phase === "generating") return "Generating your design\u2026";
  if (opts.empty) return "Add A Source To Begin";
  if (opts.phase === "error") return "Generation failed. Try again.";
  if (opts.result) return "Review your generated design";
  return "Your source photo";
}

/* ---------------------------------------------------------- stale callbacks */

export type StaleCheck = {
  /** Navigation token captured when the delayed work was queued. */
  token: number;
  /** Current navigation token. */
  current: number;
  ctx: StudioContext;
  /** Draft/photo the callback was queued against, when it had one. */
  draftId?: string | null;
  photoKey?: string | null;
};

/**
 * A delayed startup callback (workspace summary, start-page preferences,
 * first-use routing, autosave, room detection, property matching, media
 * hydration, auth refresh) may only navigate when nothing has moved on.
 */
export function mayGenericNavigate(check: StaleCheck): boolean {
  if (check.token !== check.current) return false;
  if (isPhotoCanvas(check.ctx)) return false;
  return true;
}

/** A Canvas callback is stale as soon as the draft or the photo changed. */
export function canvasCallbackIsCurrent(check: StaleCheck): boolean {
  if (check.token !== check.current) return false;
  if (!isPhotoCanvas(check.ctx)) return false;
  const ctx = check.ctx as { draftId: string; photoKey: string };
  if (check.draftId != null && check.draftId !== ctx.draftId) return false;
  if (check.photoKey != null && check.photoKey !== ctx.photoKey) return false;
  return true;
}
