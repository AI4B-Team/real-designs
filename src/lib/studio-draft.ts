/**
 * The one canonical Studio draft.
 *
 * Photos -> Design -> Review -> Generate -> Canvas is a single workflow. A
 * one-photo project and a fifty-photo project use this same record: there is
 * no separate "single photo" model any more. Everything the workflow needs to
 * be reopened exactly where the user left it lives here — origin, step,
 * selected sources, photo order, rooms, output format, crops, the shared
 * style and every per-photo override.
 *
 * Ownership rules:
 *   - the persisted draft is authoritative;
 *   - React and the imperative views render draft data, they do not own it;
 *   - CSS classes and window globals are never state;
 *   - localStorage is a recovery cache for this record, not a business record
 *     of its own, and every legacy key is adapted once and then consumed.
 *
 * Nothing in this module generates anything or spends a credit. Only the
 * final Generate action, which submits a versioned snapshot, does that.
 */

import { styleById } from "@/lib/style-catalog";
import { reportError } from "@/lib/errors/report";

const KEY = "rd_studio_draft_v1";
/** Pre-Phase-1A draft record. Read once, adapted, then removed. */
const LEGACY_DRAFT_KEY = "rd_design_draft_v1";
/** Pre-Phase-1A Explore style handoff. Read once, adapted, then removed. */
const LEGACY_STYLE_KEY = "rd_style_choice";

export type DraftOrigin = "explore" | "studio" | "property" | "media" | "upload" | "describe";
export type DraftStep = "source" | "photos" | "design" | "review" | "generating" | "complete";

export const DRAFT_STEPS: DraftStep[] = [
  "source",
  "photos",
  "design",
  "review",
  "generating",
  "complete",
];

const ORIGINS: DraftOrigin[] = ["explore", "studio", "property", "media", "upload", "describe"];

export type DraftPhoto = {
  /** Stable per-photo key used by every surface. */
  key: string;
  /** Source record id (media asset, property photo, upload id), when known. */
  sourceId: string | null;
  /** Durable storage path. Never a blob: URL. */
  path: string | null;
  name: string;
  room: string | null;
  roomSource: "ai" | "manual" | "library" | "none";
  confidence: number;
  selected: boolean;
  /** Output-format override; null follows the project format. */
  ratio: string | null;
  /** Placement inside a fixed format frame; null is the centred default. */
  crop: Record<string, unknown> | null;
  rotation: number;
  /** Per-photo style override; null follows the shared style. */
  styleId: string | null;
  /** Per-photo instructions. */
  instructions: string;
};

export type StudioDraft = {
  id: string;
  /** Optimistic-concurrency revision. Every accepted write bumps it. */
  rev: number;
  /** User / workspace the draft belongs to. */
  ownerKey: string | null;
  origin: DraftOrigin;
  step: DraftStep;
  sourceIds: string[];
  photos: DraftPhoto[];
  /** Photo keys in display order. */
  order: string[];
  propertyId: string | null;
  projectId: string | null;
  /** Project output format. "original" keeps each photo's native aspect. */
  outputRatio: string;
  /** False until the user deliberately picks a format. */
  outputRatioExplicit: boolean;
  /** Shared style for every photo without an override. */
  styleId: string | null;
  styleName: string | null;
  designDirection: string | null;
  finishGrade: string | null;
  structureProtection: string | null;
  /** Shared instructions applied to every photo. */
  instructions: string;
  /** Workflow session that has already taken the style handoff. */
  claimedBy: string | null;
  generationBatchId: string | null;
  /** Revision Review last rendered, so Generate can refuse a stale snapshot. */
  reviewedRev: number | null;
  /** Legacy fields we could not map. Kept, never silently discarded. */
  legacyExtras: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/** A frozen copy of the draft, submitted with the final Generate. */
export type DraftSnapshot = { rev: number; takenAt: string; draft: StudioDraft };

export type CommitResult =
  | { ok: true; draft: StudioDraft }
  | { ok: false; conflict: true; draft: StudioDraft };

/* ------------------------------------------------------------------ utils */

function newId(prefix = "dd"): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

function store(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function emit(name: string, detail?: unknown) {
  try {
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent(name, { detail: detail as any }));
  } catch {
    /* a listener must never break persistence */
  }
}

function logLegacy(shape: string, extras?: Record<string, unknown> | null) {
  /* Legacy adaptation is measured, not hidden, so the compatibility layer can
     be retired once real usage reaches zero. */
  reportError(new Error("legacy studio draft adapted: " + shape), {
    operation: "studio-draft.legacy",
    category: "storage",
    severity: "low",
    context: { shape, unmapped: extras ? Object.keys(extras) : [] },
  });
}

/* ------------------------------------------------------------- normalising */

function normPhoto(raw: any): DraftPhoto | null {
  if (!raw || typeof raw !== "object" || !raw.key) return null;
  const path = str(raw.path, "") || null;
  const src = /^(blob:|data:)/i.test(path || "") ? null : path;
  const roomSource = ["ai", "manual", "library"].indexOf(raw.roomSource) > -1
    ? raw.roomSource
    : "none";
  return {
    key: String(raw.key),
    sourceId: raw.sourceId ? String(raw.sourceId) : null,
    path: src,
    name: str(raw.name, "Photo") || "Photo",
    room: raw.room ? String(raw.room) : null,
    roomSource,
    confidence: Number(raw.confidence) || 0,
    selected: raw.selected !== false,
    ratio: raw.ratio ? String(raw.ratio) : null,
    crop: raw.crop && typeof raw.crop === "object" ? { ...raw.crop } : null,
    rotation: Number(raw.rotation) || 0,
    styleId: raw.styleId && styleById(raw.styleId) ? String(raw.styleId) : null,
    instructions: str(raw.instructions, ""),
  };
}

function normalize(raw: any): StudioDraft | null {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const photos = Array.isArray(raw.photos)
    ? (raw.photos.map(normPhoto).filter(Boolean) as DraftPhoto[])
    : [];
  const keys = photos.map((p) => p.key);
  const order = (Array.isArray(raw.order) ? raw.order.map(String) : [])
    .filter((k: string) => keys.indexOf(k) > -1)
    .concat(keys.filter((k) => (raw.order || []).indexOf(k) < 0));
  /* A style that left the catalog must never silently drive a generation. */
  const rec = raw.styleId ? styleById(raw.styleId) : null;
  const now = new Date().toISOString();
  return {
    id: String(raw.id),
    rev: Number(raw.rev) > 0 ? Number(raw.rev) : 1,
    ownerKey: raw.ownerKey ? String(raw.ownerKey) : null,
    origin: (ORIGINS.indexOf(raw.origin) > -1 ? raw.origin : "studio") as DraftOrigin,
    step: (DRAFT_STEPS.indexOf(raw.step) > -1 ? raw.step : "source") as DraftStep,
    sourceIds: Array.isArray(raw.sourceIds) ? raw.sourceIds.map(String) : [],
    photos,
    order,
    propertyId: raw.propertyId ? String(raw.propertyId) : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    outputRatio: str(raw.outputRatio, "original") || "original",
    outputRatioExplicit: !!raw.outputRatioExplicit,
    styleId: rec ? rec.id : null,
    styleName: rec ? rec.displayName : null,
    designDirection: raw.designDirection ? String(raw.designDirection) : null,
    finishGrade: raw.finishGrade ? String(raw.finishGrade) : null,
    structureProtection: raw.structureProtection ? String(raw.structureProtection) : null,
    instructions: str(raw.instructions, ""),
    claimedBy: raw.claimedBy ? String(raw.claimedBy) : null,
    generationBatchId: raw.generationBatchId ? String(raw.generationBatchId) : null,
    reviewedRev: Number(raw.reviewedRev) > 0 ? Number(raw.reviewedRev) : null,
    legacyExtras:
      raw.legacyExtras && typeof raw.legacyExtras === "object" ? { ...raw.legacyExtras } : null,
    createdAt: str(raw.createdAt, now) || now,
    updatedAt: str(raw.updatedAt, now) || now,
  };
}

export function emptyDraft(origin: DraftOrigin = "studio"): StudioDraft {
  const now = new Date().toISOString();
  return {
    id: newId(),
    rev: 1,
    ownerKey: null,
    origin,
    step: "source",
    sourceIds: [],
    photos: [],
    order: [],
    propertyId: null,
    projectId: null,
    outputRatio: "original",
    outputRatioExplicit: false,
    styleId: null,
    styleName: null,
    designDirection: null,
    finishGrade: null,
    structureProtection: null,
    instructions: "",
    claimedBy: null,
    generationBatchId: null,
    reviewedRev: null,
    legacyExtras: null,
    createdAt: now,
    updatedAt: now,
  };
}

/* --------------------------------------------------------- legacy adapter */

const LEGACY_KNOWN = [
  "id",
  "origin",
  "step",
  "selectedStyleId",
  "selectedStyleName",
  "claimedBy",
  "propertyId",
  "projectId",
  "generationBatchId",
  "updatedAt",
];

/** Adapt the pre-1A `rd_design_draft_v1` record, keeping unmapped fields. */
export function adaptLegacyDraft(raw: any): StudioDraft | null {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const extras: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) if (LEGACY_KNOWN.indexOf(k) < 0) extras[k] = raw[k];
  const base = emptyDraft(ORIGINS.indexOf(raw.origin) > -1 ? raw.origin : "studio");
  const adapted = normalize({
    ...base,
    id: String(raw.id),
    origin: raw.origin,
    step: raw.step,
    styleId: raw.selectedStyleId || null,
    claimedBy: raw.claimedBy || null,
    propertyId: raw.propertyId || null,
    projectId: raw.projectId || null,
    generationBatchId: raw.generationBatchId || null,
    updatedAt: raw.updatedAt || base.updatedAt,
    legacyExtras: Object.keys(extras).length ? extras : null,
  });
  if (adapted) logLegacy("design-draft-v1", adapted.legacyExtras);
  return adapted;
}

/**
 * The one-time Explore style handoff written by the old `rd_style_choice`
 * key. Consumed into the draft, then removed so it can never leak into an
 * unrelated later project.
 */
function consumeLegacyStyle(draft: StudioDraft): StudioDraft {
  const s = store();
  if (!s) return draft;
  let raw: any = null;
  try {
    raw = JSON.parse(s.getItem(LEGACY_STYLE_KEY) || "null");
  } catch {
    raw = null;
  }
  try {
    s.removeItem(LEGACY_STYLE_KEY);
  } catch {
    /* nothing to clean up */
  }
  const rec = raw && styleById(raw.styleId);
  if (!rec) return draft;
  logLegacy("style-choice");
  if (draft.styleId) return draft;
  return { ...draft, styleId: rec.id, styleName: rec.displayName };
}

/* ------------------------------------------------------------ persistence */

function read(): StudioDraft | null {
  const s = store();
  if (!s) return null;
  let raw: any = null;
  try {
    raw = JSON.parse(s.getItem(KEY) || "null");
  } catch {
    return null;
  }
  const cur = normalize(raw);
  if (cur) return cur;

  /* Nothing canonical yet: an existing production draft must still open. */
  let legacyRaw: any = null;
  try {
    legacyRaw = JSON.parse(s.getItem(LEGACY_DRAFT_KEY) || "null");
  } catch {
    legacyRaw = null;
  }
  const adapted = adaptLegacyDraft(legacyRaw);
  if (!adapted) return null;
  try {
    s.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    /* the adapted copy is already canonical */
  }
  return persist(consumeLegacyStyle(adapted), { bump: false });
}

function persist(draft: StudioDraft, opt: { bump?: boolean } = {}): StudioDraft {
  const next: StudioDraft = {
    ...draft,
    rev: opt.bump === false ? draft.rev : draft.rev + 1,
    updatedAt: new Date().toISOString(),
  };
  const s = store();
  try {
    s && s.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage may be blocked; the returned value still drives this session */
  }
  emit("rd:draft-changed", next);
  return next;
}

/* -------------------------------------------------------------------- API */

export function getDraft(): StudioDraft | null {
  return read();
}

/** The active draft, created with plain defaults when none exists yet. */
export function ensureDraft(origin: DraftOrigin = "studio"): StudioDraft {
  const cur = read();
  if (cur) return cur;
  return persist(consumeLegacyStyle(emptyDraft(origin)), { bump: false });
}

/**
 * Write to the draft. Pass `expectedRev` from the revision the caller read to
 * get optimistic concurrency: a second tab that saved in the meantime makes
 * this a conflict instead of a silent overwrite.
 */
export function commitDraft(
  patch: Partial<StudioDraft>,
  opt: { expectedRev?: number } = {},
): CommitResult {
  const cur = ensureDraft(patch.origin || "studio");
  if (typeof opt.expectedRev === "number" && opt.expectedRev !== cur.rev) {
    return { ok: false, conflict: true, draft: cur };
  }
  const merged = normalize({ ...cur, ...patch, id: cur.id, rev: cur.rev }) as StudioDraft;
  return { ok: true, draft: persist(merged) };
}

/** Last-write-wins convenience for single-surface updates. */
export function patchDraft(patch: Partial<StudioDraft>): StudioDraft {
  return (commitDraft(patch) as { draft: StudioDraft }).draft;
}

export function setDraftStep(step: DraftStep): StudioDraft | null {
  const cur = read();
  if (!cur || DRAFT_STEPS.indexOf(step) < 0) return cur;
  if (cur.step === step) return cur;
  return persist({ ...cur, step });
}

export function clearDraft(): void {
  const s = store();
  try {
    s && s.removeItem(KEY);
    s && s.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    /* nothing to clean up */
  }
  emit("rd:draft-cleared");
}

/** Start a brand new draft. Nothing from the previous one is inherited. */
export function startDraft(origin: DraftOrigin = "studio", seed: Partial<StudioDraft> = {}) {
  clearDraft();
  const base = normalize({ ...emptyDraft(origin), ...seed, origin }) as StudioDraft;
  return persist(base, { bump: false });
}

/* ------------------------------------------------------------------ style */

export type DraftStyle = { id: string; name: string; thumb: string; spaces: string[] };

export function draftStyle(): DraftStyle | null {
  const d = read();
  const rec = d && styleById(d.styleId);
  if (!rec) return null;
  return {
    id: rec.id,
    name: rec.displayName,
    thumb: rec.previewImage || "",
    spaces: (rec.compatibleProjectTypes || []).slice(),
  };
}

export function setDraftStyle(styleId?: string | null): StudioDraft | null {
  const rec = styleById(styleId);
  if (!rec) return null;
  return patchDraft({ styleId: rec.id, styleName: rec.displayName });
}

export function removeDraftStyle(): StudioDraft | null {
  const cur = read();
  if (!cur) return null;
  return persist({ ...cur, styleId: null, styleName: null });
}

/**
 * Explore "Try This Style": store the canonical style id on a fresh draft and
 * open source selection. It never generates and never charges.
 */
export function startExploreDraft(styleId?: string | null): StudioDraft | null {
  const rec = styleById(styleId);
  if (!rec) return null;
  return startDraft("explore", { styleId: rec.id, styleName: rec.displayName, step: "source" });
}

/** Take the style once per workflow session; a refresh of it still restores. */
export function claimDraftStyle(sessionId: string): DraftStyle | null {
  const d = read();
  if (!d || !d.styleId) return null;
  if (d.claimedBy && d.claimedBy !== sessionId) return null;
  const style = draftStyle();
  if (!style) return null;
  if (d.claimedBy !== sessionId) persist({ ...d, claimedBy: sessionId });
  return style;
}

export function draftClaimedBy(sessionId: string): boolean {
  const d = read();
  return !!d && d.claimedBy === sessionId;
}

/** The style that actually applies to one photo. */
export function styleForPhoto(key: string): string | null {
  const d = read();
  if (!d) return null;
  const p = d.photos.find((x) => x.key === key);
  return (p && p.styleId) || d.styleId || null;
}

/* ----------------------------------------------------------------- photos */

export function orderedPhotos(draft?: StudioDraft | null): DraftPhoto[] {
  const d = draft || read();
  if (!d) return [];
  const byKey = new Map(d.photos.map((p) => [p.key, p]));
  return d.order.map((k) => byKey.get(k)).filter(Boolean) as DraftPhoto[];
}

export function makePhoto(over: Partial<DraftPhoto> = {}): DraftPhoto {
  return normPhoto({ key: over.key || newId("p"), ...over }) as DraftPhoto;
}

/** Replace the photo set, preserving the given order. */
export function setDraftPhotos(list: Partial<DraftPhoto>[]): StudioDraft {
  const photos = list.map((p) => makePhoto(p));
  return patchDraft({ photos, order: photos.map((p) => p.key) });
}

/** Add photos from any source (upload, cloud, property, media, describe). */
export function addDraftPhotos(
  list: Partial<DraftPhoto>[],
  origin?: DraftOrigin,
): StudioDraft {
  const cur = ensureDraft(origin || "studio");
  const next = cur.photos.slice();
  const order = cur.order.slice();
  for (const raw of list) {
    const p = makePhoto(raw);
    const at = next.findIndex((x) => x.key === p.key);
    if (at > -1) next[at] = { ...next[at], ...p };
    else {
      next.push(p);
      order.push(p.key);
    }
  }
  const sourceIds = Array.from(
    new Set(cur.sourceIds.concat(next.map((p) => p.sourceId).filter(Boolean) as string[])),
  );
  return patchDraft({ photos: next, order, sourceIds });
}

export function removeDraftPhoto(key: string): StudioDraft {
  const cur = ensureDraft();
  return patchDraft({
    photos: cur.photos.filter((p) => p.key !== key),
    order: cur.order.filter((k) => k !== key),
  });
}

export function updateDraftPhoto(key: string, patch: Partial<DraftPhoto>): StudioDraft {
  const cur = ensureDraft();
  return patchDraft({
    photos: cur.photos.map((p) => (p.key === key ? (makePhoto({ ...p, ...patch, key }) as DraftPhoto) : p)),
  });
}

export function setDraftOrder(keys: string[]): StudioDraft {
  return patchDraft({ order: keys.slice() });
}

/* ----------------------------------------------------------- review/commit */

/**
 * What Review renders. Review shows exactly these values — it never rebuilds
 * them from loose DOM controls — and records the revision it displayed.
 */
export function openReview(): DraftSnapshot | null {
  const cur = read();
  if (!cur) return null;
  const draft = cur.reviewedRev === cur.rev ? cur : persist({ ...cur, reviewedRev: cur.rev + 1 });
  return { rev: draft.rev, takenAt: new Date().toISOString(), draft };
}

/** True when the draft moved on since Review rendered this revision. */
export function reviewIsStale(reviewedRev: number | null | undefined): boolean {
  const cur = read();
  if (!cur || reviewedRev == null) return false;
  return cur.rev !== reviewedRev;
}

/**
 * The versioned snapshot the final Generate submits. Refuses when the draft
 * changed after Review loaded: the user must refresh Review first.
 */
export function snapshotForGeneration(
  reviewedRev?: number | null,
): { ok: true; snapshot: DraftSnapshot } | { ok: false; stale: true; draft: StudioDraft | null } {
  const cur = read();
  if (!cur) return { ok: false, stale: true, draft: null };
  const expected = reviewedRev == null ? cur.reviewedRev : reviewedRev;
  if (expected != null && expected !== cur.rev) return { ok: false, stale: true, draft: cur };
  return {
    ok: true,
    snapshot: { rev: cur.rev, takenAt: new Date().toISOString(), draft: { ...cur } },
  };
}

/** Record the batch the reviewed snapshot produced. */
export function recordGeneration(batchId: string, snapshotRev?: number): StudioDraft {
  const cur = ensureDraft();
  if (typeof snapshotRev === "number" && snapshotRev !== cur.rev) {
    /* Do not silently attach a batch to a draft the user has since changed. */
    reportError(new Error("generation recorded against a changed draft"), {
      operation: "studio-draft.generate",
      category: "validation",
      severity: "medium",
      context: { snapshotRev, currentRev: cur.rev },
    });
  }
  return patchDraft({ generationBatchId: batchId, step: "generating" });
}
