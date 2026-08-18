/**
 * One authoritative navigation owner.
 *
 * Every intentional page change bumps a monotonic sequence and records the
 * canonical destination. Asynchronous work (startup routing, draft
 * restoration, builder hydration, retry loops) captures the token it was
 * queued under and re-checks it before it is allowed to move the user. An
 * older callback simply does nothing instead of yanking the page away.
 */

export type NavReason =
  | "user"
  | "sidebar_click"
  | "browser_back"
  | "builder_resume"
  | "builder_open"
  | "startup_preference"
  | "draft_missing"
  | "auth_signed_out"
  | "legacy_hash_normalization"
  | "chunk_recovery"
  | "unknown";

export interface NavEntry {
  at: number;
  seq: number;
  from: string;
  to: string;
  reason: NavReason;
  source?: string | undefined;
  userInitiated: boolean;
}

let sequence = 0;
let view = "";
const log: NavEntry[] = [];

/** Current navigation token. */
export function navSequence() {
  return sequence;
}

/** Canonical destination of the newest navigation intent. */
export function navView() {
  return view;
}

/**
 * Record a new intentional navigation and return its token.
 * Callers hold the token across awaits and compare with isCurrentNavigation.
 */
export function beginNavigation(
  to: string,
  opts: { reason?: NavReason; source?: string; userInitiated?: boolean } = {},
) {
  const from = view;
  sequence += 1;
  view = String(to || "");
  const entry: NavEntry = {
    at: Date.now(),
    seq: sequence,
    from,
    to: view,
    reason: opts.reason || "unknown",
    source: opts.source,
    userInitiated: opts.userInitiated !== false,
  };
  log.push(entry);
  if (log.length > 50) log.shift();
  devLog(entry);
  return sequence;
}

/**
 * A route may be remapped by the router after the intent was recorded
 * (for example Video falling back to Media). Keep the recorded destination
 * truthful without pretending a second navigation happened.
 */
export function retargetNavigation(to: string, reason: NavReason = "unknown") {
  const from = view;
  view = String(to || "");
  const entry: NavEntry = {
    at: Date.now(),
    seq: sequence,
    from,
    to: view,
    reason,
    source: "router_retarget",
    userInitiated: false,
  };
  log.push(entry);
  if (log.length > 50) log.shift();
  devLog(entry);
  return sequence;
}

/** True while the captured navigation is still the one on screen. */
export function isCurrentNavigation(seq: number, expected?: string | null) {
  if (seq !== sequence) return false;
  if (expected === undefined || expected === null) return true;
  return String(expected) === view;
}

/** Read-only navigation history for debugging. */
export function navHistory() {
  return log.slice();
}

/** Test seam only. */
export function __resetNav() {
  sequence = 0;
  view = "";
  log.length = 0;
}

function devLog(entry: NavEntry) {
  try {
    if (!import.meta.env?.DEV) return;
    // No project or user content is ever logged: routes and reasons only.
    console.debug(
      `[nav#${entry.seq}] ${entry.from || "(none)"} -> ${entry.to} · ${entry.reason}` +
        (entry.source ? ` · ${entry.source}` : "") +
        (entry.userInitiated ? "" : " · async"),
    );
  } catch {
    /* logging must never break navigation */
  }
}
