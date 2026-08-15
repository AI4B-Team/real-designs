/** Shared helpers for turning plan/credit refusals into an upgrade prompt. */

const PLAN_RE = /credit|free designs|paid plan|upgrade/i;

/** True when a server refusal was caused by a plan or credit limit. */
export function isPlanBlocked(msg: unknown): boolean {
  return PLAN_RE.test(String((msg as any)?.message ?? msg ?? ""));
}

/** Headline that matches the kind of limit that was hit. */
export function planBlockTitle(msg: unknown): string {
  const m = String((msg as any)?.message ?? msg ?? "");
  return /free designs/i.test(m) ? "You Have Used Today\u2019s Free Designs" : "You Need More Credits";
}

/**
 * Open the plans/upgrade modal. Falls back to the billing page when the app
 * shell (which owns the modal) is not mounted.
 */
export function openUpgrade(msg: unknown, title?: string): void {
  const body = String((msg as any)?.message ?? msg ?? "");
  const um = (window as any).rdUpgradeModal;
  if (typeof um === "function") {
    um(title || planBlockTitle(body), body);
    return;
  }
  try {
    location.hash = "#/account/billing";
  } catch (_) {
    /* no-op */
  }
}
