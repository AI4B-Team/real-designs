/**
 * Photo intake for the property-video builder.
 *
 * Kept out of the view module so the Step 1 -> Step 2 transition can be tested
 * without a DOM: every side effect (object URLs, ids, asset loading, render)
 * arrives as an injected dependency.
 */

export type IntakeWizard = {
  step: number;
  uploads: any[];
  uploadFails?: any[];
  uploadPrep?: any[];
  uploadError?: string;
  advancingToGrid?: boolean;
  [k: string]: any;
};

export type IntakeDeps = {
  rejectReason: (file: File) => string | null;
  createUrl: (file: File) => string;
  uuid: () => string;
  /** Shared Step 1 -> Step 2 transition; must handle its own errors. */
  advance: (w: IntakeWizard) => Promise<void>;
  loadAssets: () => Promise<void>;
  isCurrent: (w: IntakeWizard) => boolean;
  render: () => void;
};

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

  if (added.length && w.step === 1) {
    await deps.advance(w);
    return;
  }
  if (added.length) {
    try {
      await deps.loadAssets();
    } catch {
      /* the photos are already attached; a stale asset list is recoverable */
    }
    if (deps.isCurrent(w)) deps.render();
    return;
  }
  deps.render();
}

export const STEP_TWO_ERROR =
  "Your photos were added, but the next step could not load. Please try again.";

/**
 * Shared Step 1 -> Step 2 transition. Guarded against duplicate runs and
 * always leaves the user on a usable step with their photos intact.
 */
export async function runAdvanceToGrid(
  w: IntakeWizard,
  deps: {
    loadAssets: () => Promise<void>;
    isCurrent: (w: IntakeWizard) => boolean;
    selectRecommended: () => void;
    autoArrange: () => void;
    render: () => void;
  },
): Promise<void> {
  if (!w || w.advancingToGrid) return;
  w.advancingToGrid = true;
  const from = w.step;
  try {
    w.step = 2;
    delete w.uploadError;
    await deps.loadAssets();
    if (!deps.isCurrent(w)) return;
    if (!(w.scenes || []).length) {
      deps.selectRecommended();
      deps.autoArrange();
    }
    deps.render();
  } catch {
    if (!deps.isCurrent(w)) return;
    w.step = from === 2 ? 1 : from;
    w.uploadError = STEP_TWO_ERROR;
    deps.render();
  } finally {
    w.advancingToGrid = false;
  }
}
