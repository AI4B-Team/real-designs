/**
 * One gate for every navigation that leaves an open Canvas.
 *
 * The Canvas used to drift back to the Studio start page on its own: a failed
 * URL resolution, a stale handoff or a late callback from a previous route
 * would call `go("studio")` and the user's work vanished. Navigation is now a
 * decision with a reason attached, and only two reasons are ever allowed to
 * take a live Canvas away: the user asked, or a workflow finished and has a
 * known destination.
 */

export type StudioNavReason =
  | "user"
  | "workflow-complete"
  | "handoff"
  | "recovery"
  | "startup";

export interface StudioNavRequest {
  reason: StudioNavReason;
  initiatedByUser?: boolean;
  mode?: string | null;
  propertyId?: string | null;
  projectId?: string | null;
  roomId?: string | null;
  versionId?: string | null;
  draftId?: string | null;
  /** Navigation token captured when the caller started its async work. */
  token?: number;
}

export interface StudioNavEnv {
  /** True when a Canvas is mounted with a photo or a result on screen. */
  canvasActive: () => boolean;
  /** Current navigation token; a stale caller carries an older one. */
  token: () => number;
  go: (view: string) => void;
}

export interface StudioNavDecision {
  navigated: boolean;
  /** Why the navigation was refused, for diagnostics and inline recovery. */
  blocked?: "stale-callback" | "not-user-initiated";
}

/** Monotonic token: every route mount bumps it, invalidating older callbacks. */
let navToken = 0;
export function currentNavToken() {
  return navToken;
}
export function bumpNavToken() {
  navToken += 1;
  return navToken;
}

export function decideStudioNav(
  req: StudioNavRequest,
  env: Pick<StudioNavEnv, "canvasActive" | "token">,
): StudioNavDecision {
  /* A callback that belongs to an older route never navigates. */
  if (typeof req.token === "number" && req.token !== env.token()) {
    return { navigated: false, blocked: "stale-callback" };
  }
  if (!env.canvasActive()) return { navigated: true };
  const allowed = req.initiatedByUser === true || req.reason === "workflow-complete";
  return allowed ? { navigated: true } : { navigated: false, blocked: "not-user-initiated" };
}

export function navigateToStudio(req: StudioNavRequest, env: StudioNavEnv): StudioNavDecision {
  const decision = decideStudioNav(req, env);
  if (decision.navigated) env.go("studio");
  return decision;
}

/** Default environment bound to the running app. */
export function appNavEnv(): StudioNavEnv {
  const w = window as any;
  return {
    canvasActive: () => {
      try {
        return !!(w.rdStudioHasSource && w.rdStudioHasSource());
      } catch (_) {
        return false;
      }
    },
    token: () => navToken,
    go: (view) => {
      try {
        w.__rdGo && w.__rdGo(view);
      } catch (_) {}
    },
  };
}

/** Convenience wrapper used from app code. */
export function goStudio(req: StudioNavRequest) {
  return navigateToStudio(req, appNavEnv());
}
