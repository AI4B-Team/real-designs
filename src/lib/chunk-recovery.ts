/**
 * Stale-chunk recovery guard.
 *
 * A deployed or Preview rebuild can invalidate the chunk a route is about to
 * import. One reload picks up the fresh build. A second reload for the same
 * build and the same failing chunk would be a loop, so it is refused and the
 * error UI (with a manual Retry) is shown instead.
 */

export interface RecoveryStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = "rd:chunk-recovery";

/** Normalized signature of the failing import, without query cache-busters. */
export function chunkSignature(message: string) {
  const url = /(https?:\/\/[^\s'")]+)/.exec(message || "");
  const raw = url ? url[1] : (message || "").slice(0, 120);
  return raw.replace(/[?&]t=\d+/g, "").replace(/[?&]v=[^&]*/g, "");
}

/**
 * Returns true when exactly one automatic reload is still allowed for this
 * build + chunk. Records the attempt so a repeat is refused.
 */
export function shouldRecoverFromChunkError(
  message: string,
  store: RecoveryStore | null,
  buildId: string,
) {
  if (!store) return false; // private mode: never risk an unguarded loop
  const stamp = `${buildId}::${chunkSignature(message)}`;
  let prev = "";
  try {
    prev = store.getItem(KEY) || "";
  } catch {
    return false;
  }
  if (prev === stamp) return false;
  try {
    store.setItem(KEY, stamp);
  } catch {
    return false;
  }
  return true;
}

/** Called once the app mounts successfully: the new build is healthy. */
export function clearChunkRecovery(store: RecoveryStore | null) {
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** A stable-enough identifier for the currently loaded build. */
export function currentBuildId(doc?: Document | null) {
  try {
    const el = (doc || document).querySelector<HTMLScriptElement>('script[type="module"][src]');
    if (el?.src) return el.src;
  } catch {
    /* ignore */
  }
  return "dev";
}
