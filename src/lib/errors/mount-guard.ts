/**
 * Guarded mounting for the prototype runtime (Phase 0D).
 *
 * The imperative runtime mounts many optional modules (Explore, CRM, Media
 * Library, Reveal, Present, surveys…). Before this guard, a throw inside any
 * one of them escaped `initApp` and left the user on a blank shell.
 *
 * `guardMount` isolates each module: a failure is classified, reported once
 * with a correlation ID and — when the module is required — surfaced to the
 * user. The rest of the application keeps working either way.
 */

import { AppError, toAppError } from "./app-error";
import { notifyError } from "./notify";
import { reportError } from "./report";

export interface MountOutcome<T> {
  ok: boolean;
  name: string;
  value: T | null;
  error: AppError | null;
}

export interface MountOptions {
  /** A required module tells the user when it fails; optional ones stay quiet. */
  required?: boolean;
  /** Mounting is retried by remounting the screen, never automatically. */
  onError?: (error: AppError) => void;
}

function handle(name: string, e: unknown, opts: MountOptions): AppError {
  const error = toAppError(e, {
    operation: `mount:${name}`,
    category: "navigation",
    code: "module_mount_failed",
    severity: opts.required ? "high" : "low",
    context: { module: name },
  });
  if (opts.required) {
    notifyError(error, { operation: error.operation });
  } else {
    reportError(error, { operation: error.operation });
  }
  try {
    opts.onError?.(error);
  } catch {
    /* an error handler must not be able to escalate the failure it handles */
  }
  return error;
}

/** Mount one module synchronously; never throws. */
export function guardMount<T>(
  name: string,
  mount: () => T,
  opts: MountOptions = {},
): MountOutcome<T> {
  try {
    return { ok: true, name, value: mount(), error: null };
  } catch (e) {
    return { ok: false, name, value: null, error: handle(name, e, opts) };
  }
}

/** Mount one module that loads or initializes asynchronously; never rejects. */
export async function guardMountAsync<T>(
  name: string,
  mount: () => Promise<T> | T,
  opts: MountOptions = {},
): Promise<MountOutcome<T>> {
  try {
    return { ok: true, name, value: await mount(), error: null };
  } catch (e) {
    return { ok: false, name, value: null, error: handle(name, e, opts) };
  }
}
