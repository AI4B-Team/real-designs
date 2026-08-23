/**
 * Independent module mounting.
 *
 * The back office mounts a dozen semi-independent painters. A throw inside any
 * one of them used to be swallowed by an empty catch — or, worse, take the whole
 * view down with it. `runModule` isolates each unit of work, reports the real
 * exception with a diagnostic id, and lets the remaining modules mount.
 */

export type ModuleFailure = {
  /** Short id shown to the user and printed with the stack. */
  id: string;
  module: string;
  error: unknown;
  at: number;
};

const failures: ModuleFailure[] = [];

/** Short, human-quotable diagnostic id: RD-<base36 time>-<random>. */
export function diagnosticId(): string {
  const t = Date.now().toString(36).slice(-5).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RD-${t}-${r}`;
}

/** Everything that has failed this session, newest last. */
export function moduleFailures(): ModuleFailure[] {
  return failures.slice();
}

/** Test seam. */
export function __resetModuleFailures() {
  failures.length = 0;
}

/**
 * A request cancelled because the page is navigating away (or the caller
 * aborted it) is not a module failure. Reporting it produces phantom
 * "load failed" diagnostics every time the user clicks a link mid-fetch.
 */
export function isAbortLikeError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null | undefined;
  if (!e) return false;
  if (e.name === "AbortError" || e.name === "NavigationAborted") return true;
  const m = String(e.message || "").toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror when attempting to fetch") ||
    m.includes("load failed") ||
    m.includes("the operation was aborted") ||
    m.includes("aborted")
  );
}

export function reportModuleFailure(module: string, error: unknown): ModuleFailure {
  const failure: ModuleFailure = { id: diagnosticId(), module, error, at: Date.now() };
  if (isAbortLikeError(error)) {
    // Transient: the fetch was cancelled, usually by navigation. Not a defect.
    console.debug(`[REAL DESIGNS] ${module} cancelled`, error);
    return failure;
  }
  failures.push(failure);
  if (failures.length > 50) failures.shift();
  // Never an empty catch: the original error object is logged so the stack survives.
  console.error(`[REAL DESIGNS] ${module} failed (${failure.id})`, error);
  return failure;
}


/**
 * Run one module. Returns its value, or `undefined` when it threw — the caller
 * keeps going either way.
 */
export function runModule<T>(module: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    reportModuleFailure(module, error);
    return undefined;
  }
}
