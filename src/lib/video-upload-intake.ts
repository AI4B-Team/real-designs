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
  /** Add specific asset keys to the current selection without clearing it. */
  selectKeys?: (w: IntakeWizard, keys: string[]) => void;

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
  const available: any[] = Array.isArray(w["available"]) ? w["available"] : [];
  const gridOrder: string[] = Array.isArray(w["gridOrder"]) ? w["gridOrder"] : [];
  w["available"] = available;
  w["gridOrder"] = gridOrder;
  const have = new Set(available.map((a: any) => a.key));
  /* Two upload records pointing at the same stored object are the same photo
     (a retried or double-fired ingest), so only the first becomes an asset. */
  /* Only a durable storage path identifies a photo. A transient object URL
     can repeat across genuinely different files, so it never merges two. */
  const durable = (p: any) =>
    !!p && typeof p === "string" && !p.startsWith("blob:") && !p.startsWith("data:");
  const havePath = new Set(available.map((a: any) => a.path).filter(durable));
  const ordered = new Set(gridOrder);
  const added: string[] = [];
  for (const u of w.uploads || []) {
    const key = "u-" + u.id;
    const path = (u as any).storagePath || u.url;
    if (!have.has(key) && !(durable(path) && havePath.has(path))) {
      available.push({
        key,
        /* Durable storage path wins: an object URL dies with the tab, so a
           draft saved with one reopens as a black tile. */
        path,
        room: u.room || "Unsorted",
        kind: "Original",
        group: "Unsorted",
        disclosure: null,
        uploaded: true,
        flags: [],
      });
      have.add(key);
      if (durable(path)) havePath.add(path);
    }
    if (have.has(key) && !ordered.has(key)) {
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

  /* New photos are an explicit choice: keep them selected wherever we land. */
  const newKeys = added.map((u) => "u-" + u.id);

  if (w.step === 1) {
    await deps.advance(w);
    if (!deps.isCurrent || deps.isCurrent(w)) {
      deps.selectKeys?.(w, newKeys);
      deps.render();
    }
    return;
  }

  /* Already on the grid: show the new photos immediately, enrich after. */
  (deps.attachUploads || attachUploadAssets)(w);
  deps.selectKeys?.(w, newKeys);
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
      new Promise((_r, reject) => {
        timer = setTimeout(() => reject(new Error("enrich-timeout")), limit);
      }),
    ]);
    if (deps.isCurrent && !deps.isCurrent(w)) return;
    attach(w);
    if (!(w["scenes"] || []).length && deps.selectUploads) deps.selectUploads(w);
    if (!w.manualOrder && deps.autoArrange) deps.autoArrange();
  } catch {
    if (deps.isCurrent && !deps.isCurrent(w)) return;
    /* Optional analysis failing is not a navigation failure. */
    attach(w);
    if (!(w["scenes"] || []).length && deps.selectUploads) deps.selectUploads(w);
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
    if (!(w["scenes"] || []).length) {
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

/* ===================== CANONICAL ENTRY POINTS =====================
   Every path that puts photos into the builder — Browse Files, drag and
   drop, Studio / Create Media handoff, seed.files, cloud imports, retries,
   staging handoff — resolves its step through these helpers. There is no
   second navigation implementation. */

/** Structured diagnostics; swallowed when analytics is unavailable. */
export function logVideoEvent(event: string, data: Record<string, any>): void {
  try {
    const payload = { event, ...data };
    (globalThis as any).__rdVideoEvents = ((globalThis as any).__rdVideoEvents || []).concat(
      payload,
    );
    if ((globalThis as any).__rdVideoDebug) console.info("[rd]", payload);
  } catch (_) {}
}

/**
 * The single rule for where a freshly built wizard opens.
 * Photos always win: a wizard holding uploads can never open on Add Photos.
 */
export function initialWizardStep(
  seed: { propertyId?: any; versionId?: any; step?: number; designs?: any[] } = {},
  uploads: any[] = [],
): number {
  if (seed.step && seed.step > 1) return seed.step;
  /* Studio is the photo-source step: the builder itself always opens on
     Scenes, never on an internal Add Photos page. */
  return 2;
}

/**
 * Defensive invariant: a wizard with photos is never left on Step 1.
 * Protection against regression, not a replacement for the entry-path fixes.
 */
export function ensureStepInvariant(w: IntakeWizard, deps?: Partial<IntakeDeps>): boolean {
  if (!w || w.step !== 1 || !(w.uploads || []).length) return false;
  w.step = 2;
  (deps?.attachUploads || attachUploadAssets)(w);
  if (!(w["scenes"] || []).length) deps?.selectUploads?.(w);
  deps?.render?.();
  logVideoEvent("video_step_invariant_applied", { totalUploads: (w.uploads || []).length });
  return true;
}

/**
 * Synchronously make already-seeded uploads visible on Scenes, before the
 * first paint. Enrichment (assets, rooms, quality) continues afterwards.
 */
export function hydrateSeededWizard(w: IntakeWizard, deps: Partial<IntakeDeps>): boolean {
  if (!w || !(w.uploads || []).length) return false;
  const attach = deps.attachUploads || attachUploadAssets;
  w.step = 2;
  attach(w);
  if (!(w["scenes"] || []).length) deps.selectUploads?.(w);
  w.selectGridLoading = true;
  logVideoEvent("video_photos_accepted", {
    entrySource: "seed",
    addedCount: (w.uploads || []).length,
    totalUploads: (w.uploads || []).length,
    visibleStep: w.step,
  });
  return true;
}

/**
 * Canonical accepted-photo pipeline. Validates, attaches, previews, selects,
 * advances when entering from Step 1, renders, then persists / enriches.
 */
export async function acceptVideoPhotos(opts: {
  wizard: IntakeWizard;
  files: any;
  source: string;
  shouldAdvance?: boolean;
  deps: IntakeDeps;
}): Promise<void> {
  const { wizard: w, files, source, deps } = opts;
  if (!w) return;
  const before = (w.uploads || []).length;
  const advance =
    opts.shouldAdvance === false
      ? {
          ...deps,
          advance: async (x: IntakeWizard) => {
            x.step = Math.max(x.step, 2);
          },
        }
      : deps;
  await runIntake(w, files, advance);
  ensureStepInvariant(w, deps);
  logVideoEvent("video_photos_accepted", {
    entrySource: source,
    addedCount: (w.uploads || []).length - before,
    totalUploads: (w.uploads || []).length,
    visibleStep: w.step,
  });
}
