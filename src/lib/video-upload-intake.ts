/**
 * Photo intake for the property-video builder.
 *
 * Kept out of the view module so the Step 1 -> Step 2 transition can be tested
 * without a DOM: every side effect (object URLs, ids, asset loading, render)
 * arrives as an injected dependency.
 *
 * Navigation never waits on remote work. Uploaded files become grid assets
 * synchronously, Step 2 renders immediately, and the optional enrichment pass
 * (media library, room detection, duplicate and quality analysis) merges in
 * afterwards.
 */

export type IntakeWizard = {
  step: number;
  uploads: any[];
  uploadFails?: any[];
  uploadPrep?: any[];
  uploadError?: string;
  enrichNotice?: string;
  selectGridLoading?: boolean;
  manualOrder?: boolean;
  advancingToGrid?: boolean;
  [k: string]: any;
};

export type IntakeDeps = {
  rejectReason: (file: File) => string | null;
  createUrl: (file: File) => string;
  uuid: () => string;
  /** Shared Step 1 -> Step 2 transition; must handle its own errors. */
  advance: (w: IntakeWizard) => Promise<void>;
  /** Optional enrichment; never blocks navigation. */
  loadAssets: () => Promise<void>;
  isCurrent: (w: IntakeWizard) => boolean;
  render: () => void;
  attachUploads?: (w: IntakeWizard) => string[];
  selectUploads?: (w: IntakeWizard) => void;
  autoArrange?: () => void;
  timeoutMs?: number;
};

export const ENRICH_TIMEOUT_MS = 8000;
export const ENRICH_NOTICE =
  "Your photos are ready. Some automatic organization is still unavailable.";

/**
 * Turn every attached upload into a usable grid asset, synchronously.
 * Returns the keys newly added to gridOrder. Safe to call repeatedly.
 */
export function attachUploadAssets(w: IntakeWizard): string[] {
  if (!w) return [];
  const available: any[] = Array.isArray(w['available']) ? w['available'] : [];
  const gridOrder: string[] = Array.isArray(w['gridOrder']) ? w['gridOrder'] : [];
  w['available'] = available;
  w['gridOrder'] = gridOrder;
  const have = new Set(available.map((a: any) => a.key));
  const ordered = new Set(gridOrder);
  const added: string[] = [];
  for (const u of w.uploads || []) {
    const key = "u-" + u.id;
    if (!have.has(key)) {
      available.push({
        key,
        path: u.url,
        room: u.room || "Unsorted",
        kind: "Original",
        group: "Unsorted",
        disclosure: null,
        uploaded: true,
        flags: [],
      });
      have.add(key);
    }
    if (!ordered.has(key)) {
      gridOrder.push(key);
      ordered.add(key);
      added.push(key);
    }
  }
  return added;
}

/** Validate and attach every selected file, then transition exactly once. */
export async function runIntake(w: IntakeWizard, list: any, deps: IntakeDeps): Promise<void> {
  const files: File[] = Array.from(list || []).filter(Boolean) as File[];
  if (!files.length) return;
  w.uploadFails = w.uploadFails || [];
  const added: any[] = [];

  for (const f of files) {
    const why = deps.rejectReason(f);
    if (why) {
      w.uploadFails.push({ name: f.name, why, file: f });
      continue;
    }
    const upload = {
      id: deps.uuid(),
      name: f.name.replace(/\.[a-z0-9]+$/i, ""),
      originalName: f.name,
      url: deps.createUrl(f),
      file: f,
    };
    w.uploads.push(upload);
    added.push(upload);
  }
  w.uploadPrep = [];

  /* No valid file: stay where we are and show the failures. */
  if (!added.length) {
    deps.render();
    return;
  }

  if (w.step === 1) {
    await deps.advance(w);
    return;
  }

  /* Already on the grid: show the new photos immediately, enrich after. */
  (deps.attachUploads || attachUploadAssets)(w);
  console.log("[intake] append branch", w.step, (w.uploads||[]).length);
  if (deps.selectUploads) deps.selectUploads(w);
  w.selectGridLoading = true;
  deps.render();
  await runEnrichment(w, deps);

}

export const STEP_TWO_ERROR =
  "Your photos were added, but the next step could not load. Please try again.";

/**
 * Optional, non-blocking enrichment of an already-visible Step 2 grid.
 * Timeouts and failures never navigate the user away or drop uploads.
 */
export async function runEnrichment(w: IntakeWizard, deps: Partial<IntakeDeps>): Promise<void> {
  const attach = deps.attachUploads || attachUploadAssets;
  const limit = deps.timeoutMs ?? ENRICH_TIMEOUT_MS;
  let timer: any = null;
  try {
    await Promise.race([
      deps.loadAssets ? deps.loadAssets() : Promise.resolve(),
      new Promise((_r, reject) => { timer = setTimeout(() => reject(new Error("enrich-timeout")), limit); }),
    ]);
    if (deps.isCurrent && !deps.isCurrent(w)) return;
    attach(w);
    if (!(w['scenes'] || []).length && deps.selectUploads) deps.selectUploads(w);
    if (!w.manualOrder && deps.autoArrange) deps.autoArrange();
  } catch {
    if (deps.isCurrent && !deps.isCurrent(w)) return;
    /* Optional analysis failing is not a navigation failure. */
    attach(w);
    if (!(w['scenes'] || []).length && deps.selectUploads) deps.selectUploads(w);
    w.enrichNotice = ENRICH_NOTICE;
  } finally {
    if (timer) clearTimeout(timer);
    if (!deps.isCurrent || deps.isCurrent(w)) {
      w.selectGridLoading = false;
      deps.render?.();
    }
  }
}

/**
 * Shared Step 1 -> Step 2 transition.
 *
 * Order matters: guard, set step 2, attach uploaded assets, select them,
 * render — all synchronously — and only then await optional enrichment.
 */
export async function runAdvanceToGrid(
  w: IntakeWizard,
  deps: {
    loadAssets: () => Promise<void>;
    isCurrent: (w: IntakeWizard) => boolean;
    selectRecommended?: () => void;
    selectUploads?: (w: IntakeWizard) => void;
    attachUploads?: (w: IntakeWizard) => string[];
    autoArrange?: () => void;
    render: () => void;
    timeoutMs?: number;
  },
): Promise<void> {
  if (!w || w.advancingToGrid) return;
  w.advancingToGrid = true;
  const attach = deps.attachUploads || attachUploadAssets;
  try {
    delete w.uploadError;
    delete w.enrichNotice;
    w.step = 2;
    attach(w);
    if (!(w['scenes'] || []).length) {
      if (deps.selectUploads) deps.selectUploads(w);
      else deps.selectRecommended?.();
    }
    w.selectGridLoading = true;
    deps.render();
  } finally {
    w.advancingToGrid = false;
  }
  await runEnrichment(w, deps as Partial<IntakeDeps>);
}
