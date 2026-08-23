/**
 * Compatibility facade over the canonical Studio draft.
 *
 * Phase 1A consolidated every Studio step/draft model into
 * `@/lib/studio-draft`. This module keeps the older, narrower surface working
 * for callers that only care about origin, step and the Explore style, while
 * the single record underneath owns photos, order, crops, formats and
 * instructions too. New code should import `@/lib/studio-draft` directly.
 */

import {
  claimDraftStyle as _claim,
  clearDraft as _clear,
  draftClaimedBy as _claimedBy,
  draftStyle as _style,
  ensureDraft as _ensure,
  getDraft as _get,
  patchDraft as _patch,
  removeDraftStyle as _removeStyle,
  setDraftStep as _setStep,
  setDraftStyle as _setStyle,
  startExploreDraft as _startExplore,
  type DraftOrigin,
  type DraftStep,
  type DraftStyle,
  type StudioDraft,
} from "@/lib/studio-draft";

export type { DraftOrigin, DraftStep, DraftStyle };

/** The legacy view of the canonical draft. */
export type DesignDraft = {
  id: string;
  origin: DraftOrigin;
  step: DraftStep;
  selectedStyleId: string | null;
  selectedStyleName: string | null;
  claimedBy: string | null;
  propertyId: string | null;
  projectId: string | null;
  generationBatchId: string | null;
  updatedAt: string;
};

function view(d: StudioDraft | null): DesignDraft | null {
  if (!d) return null;
  return {
    id: d.id,
    origin: d.origin,
    step: d.step,
    selectedStyleId: d.styleId,
    selectedStyleName: d.styleName,
    claimedBy: d.claimedBy,
    propertyId: d.propertyId,
    projectId: d.projectId,
    generationBatchId: d.generationBatchId,
    updatedAt: d.updatedAt,
  };
}

function toCanonical(patch: Partial<DesignDraft>): Partial<StudioDraft> {
  const out: Partial<StudioDraft> = {};
  if (patch.origin !== undefined) out.origin = patch.origin;
  if (patch.step !== undefined) out.step = patch.step;
  if (patch.selectedStyleId !== undefined) out.styleId = patch.selectedStyleId;
  if (patch.selectedStyleName !== undefined) out.styleName = patch.selectedStyleName;
  if (patch.claimedBy !== undefined) out.claimedBy = patch.claimedBy;
  if (patch.propertyId !== undefined) out.propertyId = patch.propertyId;
  if (patch.projectId !== undefined) out.projectId = patch.projectId;
  if (patch.generationBatchId !== undefined) out.generationBatchId = patch.generationBatchId;
  return out;
}

export function getDraft(): DesignDraft | null {
  return view(_get());
}

export function ensureDraft(origin: DraftOrigin = "studio"): DesignDraft {
  return view(_ensure(origin)) as DesignDraft;
}

export function patchDraft(patch: Partial<DesignDraft>): DesignDraft {
  return view(_patch(toCanonical(patch))) as DesignDraft;
}

export function setDraftStep(step: DraftStep): DesignDraft | null {
  return view(_setStep(step));
}

export function clearDraft(): void {
  _clear();
}

export function startExploreDraft(styleId?: string | null): DesignDraft | null {
  return view(_startExplore(styleId));
}

export function draftStyle(): DraftStyle | null {
  return _style();
}

export function setDraftStyle(styleId?: string | null): DesignDraft | null {
  return view(_setStyle(styleId));
}

export function removeDraftStyle(): DesignDraft | null {
  return view(_removeStyle());
}

export function claimDraftStyle(sessionId: string): DraftStyle | null {
  return _claim(sessionId);
}

export function draftClaimedBy(sessionId: string): boolean {
  return _claimedBy(sessionId);
}
