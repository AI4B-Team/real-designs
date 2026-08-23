/**
 * The one canonical client-side design draft.
 *
 * Everything that starts a design — Explore "Try This Style", the Studio
 * source picker, a property, saved media — writes into this single draft
 * instead of leaving state scattered across loose globals and DOM controls.
 * The draft owns the selected style, the workflow step and the session it
 * belongs to, so the choice survives source selection, Photos, Design,
 * Review, a refresh and Back navigation without ever being reapplied to an
 * unrelated future project.
 *
 * Selecting a style here never generates anything and never charges a credit:
 * only the final Generate action creates jobs.
 */

import { styleById } from "@/lib/style-catalog";

const KEY = "rd_design_draft_v1";

export type DraftOrigin = "explore" | "studio" | "property" | "media";
export type DraftStep = "source" | "photos" | "design" | "review" | "generating" | "complete";

export type DesignDraft = {
  id: string;
  origin: DraftOrigin;
  step: DraftStep;
  selectedStyleId: string | null;
  selectedStyleName: string | null;
  /** Session (staging draft) that has already taken the style handoff. */
  claimedBy: string | null;
  propertyId: string | null;
  projectId: string | null;
  generationBatchId: string | null;
  updatedAt: string;
};

const STEPS: DraftStep[] = ["source", "photos", "design", "review", "generating", "complete"];

function newId(): string {
  return "dd" + Math.random().toString(36).slice(2, 10);
}

function read(): DesignDraft | null {
  let raw: any = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch (_) {
    return null;
  }
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  /* A style that left the catalog must not silently drive a generation. */
  const rec = raw.selectedStyleId ? styleById(raw.selectedStyleId) : null;
  return {
    id: String(raw.id),
    origin: (["explore", "studio", "property", "media"].indexOf(raw.origin) > -1
      ? raw.origin
      : "studio") as DraftOrigin,
    step: (STEPS.indexOf(raw.step) > -1 ? raw.step : "source") as DraftStep,
    selectedStyleId: rec ? rec.id : null,
    selectedStyleName: rec ? rec.displayName : null,
    claimedBy: raw.claimedBy ? String(raw.claimedBy) : null,
    propertyId: raw.propertyId ? String(raw.propertyId) : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    generationBatchId: raw.generationBatchId ? String(raw.generationBatchId) : null,
    updatedAt: String(raw.updatedAt || ""),
  };
}

function write(draft: DesignDraft): DesignDraft {
  const next = { ...draft, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {
    /* storage may be blocked; the in-flight return value still works */
  }
  try {
    window.dispatchEvent(new CustomEvent("rd:draft-changed", { detail: next }));
  } catch (_) {}
  return next;
}

export function getDraft(): DesignDraft | null {
  return read();
}

/** The active draft, created with plain defaults when none exists yet. */
export function ensureDraft(origin: DraftOrigin = "studio"): DesignDraft {
  const cur = read();
  if (cur) return cur;
  return write({
    id: newId(),
    origin,
    step: "source",
    selectedStyleId: null,
    selectedStyleName: null,
    claimedBy: null,
    propertyId: null,
    projectId: null,
    generationBatchId: null,
    updatedAt: "",
  });
}

export function patchDraft(patch: Partial<DesignDraft>): DesignDraft {
  const cur = ensureDraft(patch.origin || "studio");
  return write({ ...cur, ...patch, id: cur.id });
}

export function setDraftStep(step: DraftStep): DesignDraft | null {
  const cur = read();
  if (!cur) return null;
  if (STEPS.indexOf(step) < 0) return cur;
  return write({ ...cur, step });
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch (_) {}
  try {
    window.dispatchEvent(new CustomEvent("rd:draft-cleared"));
  } catch (_) {}
}

/**
 * Explore handoff. Validates against the canonical catalog, then replaces the
 * active draft with a fresh one carrying the style. A brand new Explore pick
 * always starts a clean draft, so an abandoned earlier style can never be
 * inherited by the next project.
 */
export function startExploreDraft(styleId?: string | null): DesignDraft | null {
  const rec = styleById(styleId);
  if (!rec) return null;
  return write({
    id: newId(),
    origin: "explore",
    step: "source",
    selectedStyleId: rec.id,
    selectedStyleName: rec.displayName,
    claimedBy: null,
    propertyId: null,
    projectId: null,
    generationBatchId: null,
    updatedAt: "",
  });
}

export type DraftStyle = {
  id: string;
  name: string;
  thumb: string;
  spaces: string[];
};

/** The draft's style, re-validated against the catalog. */
export function draftStyle(): DraftStyle | null {
  const d = read();
  const rec = d && styleById(d.selectedStyleId);
  if (!rec) return null;
  return {
    id: rec.id,
    name: rec.displayName,
    thumb: rec.previewImage || "",
    spaces: (rec.compatibleProjectTypes || []).slice(),
  };
}

export function setDraftStyle(styleId?: string | null): DesignDraft | null {
  const rec = styleById(styleId);
  if (!rec) return null;
  return patchDraft({ selectedStyleId: rec.id, selectedStyleName: rec.displayName });
}

export function removeDraftStyle(): DesignDraft | null {
  const cur = read();
  if (!cur) return null;
  return write({ ...cur, selectedStyleId: null, selectedStyleName: null });
}

/**
 * Take the style once for a given workflow session. The claim is recorded on
 * the draft, so re-entering Photos, Design or Review never re-applies the
 * style over a choice the user has since changed — while a refresh of the
 * same session still restores it.
 */
export function claimDraftStyle(sessionId: string): DraftStyle | null {
  const d = read();
  if (!d || !d.selectedStyleId) return null;
  if (d.claimedBy && d.claimedBy !== sessionId) return null;
  const style = draftStyle();
  if (!style) return null;
  if (d.claimedBy !== sessionId) write({ ...d, claimedBy: sessionId });
  return style;
}

/** True when this session already owns the draft's style handoff. */
export function draftClaimedBy(sessionId: string): boolean {
  const d = read();
  return !!d && d.claimedBy === sessionId;
}
