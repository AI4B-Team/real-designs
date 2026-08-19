import type { Page } from "@playwright/test";

import { RUN_ID, assertNonProductionTarget } from "./env";

/**
 * Cleanup only ever removes records created by the current run (they carry the
 * `RUN_ID` prefix) and refuses to run against a production host.
 */

const trackedKeys = new Set<string>();

export function trackRecord(key: string): void {
  trackedKeys.add(key);
}

/** Clears run-scoped client state (drafts, selections, favourites). */
export async function clearLocalState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const drop: string[] = [];
    for (const key of Object.keys(window.localStorage)) {
      if (/^rd[-.:]/i.test(key) || key.startsWith("realdesigns")) drop.push(key);
    }
    drop.forEach((k) => window.localStorage.removeItem(k));
    window.sessionStorage.clear();
  });
}

/** Deletes run-scoped rows through the in-page authenticated client (RLS applies). */
export async function deleteRunRecords(page: Page): Promise<void> {
  assertNonProductionTarget();
  await page.evaluate(async (runId) => {
    const w = window as unknown as {
      supabase?: {
        from: (t: string) => {
          delete: () => { like: (c: string, p: string) => Promise<unknown> };
        };
      };
    };
    const client = w.supabase;
    if (!client) return;
    const tables = ["projects", "photos", "designs", "presentations", "project_drafts"];
    for (const table of tables) {
      try {
        await client.from(table).delete().like("name", `${runId}%`);
      } catch {
        /* table may not exist for this build; cleanup stays best-effort */
      }
    }
  }, RUN_ID);
}

export async function cleanupRun(page: Page): Promise<void> {
  await clearLocalState(page);
  await deleteRunRecords(page);
  trackedKeys.clear();
}
