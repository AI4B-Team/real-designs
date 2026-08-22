/**
 * The result model for text-first ("Describe") generation.
 *
 * A described concept is not a redesign of a photo, so it cannot be pushed
 * through the photo-redesign canvas path: there is no source asset, no
 * before/after pair and no Reality Lock. This module owns the batch record,
 * the canvas mode rules and the copy, so the UI layers only render it.
 *
 * One request produces ONE batch with one entry per requested option. Every
 * entry is preserved independently: a later option never erases an earlier
 * one, a failed option keeps its slot so it can be retried on its own, and a
 * partial batch is always reported as partial.
 */

export type ConceptResultStatus = "pending" | "generating" | "saving" | "done" | "failed";

export type ConceptResult = {
  resultId: string;
  index: number;
  image: string | null;
  durablePath: string | null;
  versionId: string | null;
  status: ConceptResultStatus;
  error: string | null;
  label: string;
};

export type ConceptContext = {
  prompt: string;
  space: string;
  /** The room or area this concept is for, or null when it is unknown. */
  room: string | null;
  /** Where the room came from. Never invented. */
  roomSource: "selected" | "inferred" | "unknown";
  styleId: string | null;
  styleName: string | null;
  changeLevel: string | null;
  aspectRatio: string | null;
  referenceIds: string[];
};

export type ConceptBatch = ConceptContext & {
  batchId: string;
  requestedCount: number;
  results: ConceptResult[];
  createdAt: number;
};

export const UNSPECIFIED_ROOM = "Unspecified Space";

/* --------------------------------------------------------------- ids */

let seq = 0;

export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/** One key for the batch; each option gets its own child key. */
export function batchIdempotencyKey(batchId: string): string {
  return `concept:${batchId}`;
}

export function optionIdempotencyKey(batchId: string, index: number): string {
  return `concept:${batchId}:${index}`;
}

/* ------------------------------------------------------- room inference */

const ROOM_HINTS: Array<[RegExp, string]> = [
  [/\bkitchen(ette)?\b/i, "Kitchen"],
  [/\b(bath(room)?|powder room|ensuite|en-suite)\b/i, "Bathroom"],
  [/\b(primary|master|guest)?\s?bedroom\b/i, "Bedroom"],
  [/\b(living room|family room|great room|lounge)\b/i, "Living Room"],
  [/\bdining (room|area)\b/i, "Dining Room"],
  [/\b(home )?office|study\b/i, "Home Office"],
  [/\b(basement|cellar)\b/i, "Basement"],
  [/\b(laundry|mud ?room)\b/i, "Laundry"],
  [/\b(entry|entryway|foyer|hallway)\b/i, "Entry"],
  [/\b(backyard|back yard)\b/i, "Backyard"],
  [/\b(front yard|curb appeal|facade|front of house)\b/i, "Front Of House"],
  [/\b(patio|deck|terrace)\b/i, "Patio"],
  [/\b(pool|poolside)\b/i, "Pool Area"],
  [/\b(garden|landscap\w*)\b/i, "Garden"],
  [/\bgarage\b/i, "Garage"],
];

/** Reads a room out of the description. Returns null when nothing is clear. */
export function inferRoom(prompt: string): string | null {
  const text = String(prompt || "");
  for (const [re, room] of ROOM_HINTS) if (re.test(text)) return room;
  return null;
}

/**
 * Resolves the room for a concept. An explicit selection always wins; a clear
 * prompt may fill the gap; nothing else is ever assumed. An unknown concept is
 * never silently labelled "Living Room".
 */
export function resolveRoom(
  selected: string | null | undefined,
  prompt: string,
): { room: string | null; roomSource: ConceptContext["roomSource"] } {
  const picked = String(selected || "").trim();
  if (picked) return { room: picked, roomSource: "selected" };
  const guess = inferRoom(prompt);
  if (guess) return { room: guess, roomSource: "inferred" };
  return { room: null, roomSource: "unknown" };
}

export function roomLabel(ctx: Pick<ConceptContext, "room">): string {
  return ctx.room || UNSPECIFIED_ROOM;
}

/* ------------------------------------------------------------- batches */

export type BatchInput = {
  prompt: string;
  requestedCount: number;
  space?: string | null;
  room?: string | null;
  styleId?: string | null;
  styleName?: string | null;
  changeLevel?: string | null;
  aspectRatio?: string | null;
  referenceIds?: string[] | null;
  batchId?: string | null;
};

export function makeBatch(input: BatchInput): ConceptBatch {
  const prompt = String(input.prompt || "").trim();
  const requestedCount = Math.max(1, Math.min(4, Number(input.requestedCount) || 1));
  const { room, roomSource } = resolveRoom(input.room, prompt);
  const batchId = input.batchId || newId("batch");
  return {
    batchId,
    prompt,
    requestedCount,
    space: String(input.space || "interior"),
    room,
    roomSource,
    styleId: input.styleId || null,
    styleName: input.styleName || null,
    changeLevel: input.changeLevel || "Balanced",
    aspectRatio: input.aspectRatio || null,
    referenceIds: (input.referenceIds || []).slice(),
    createdAt: Date.now(),
    results: Array.from({ length: requestedCount }, (_, i) => ({
      resultId: `${batchId}:${i}`,
      index: i,
      image: null,
      durablePath: null,
      versionId: null,
      status: "pending" as ConceptResultStatus,
      error: null,
      label: requestedCount > 1 ? `Concept ${i + 1}` : "Concept",
    })),
  };
}

function slot(batch: ConceptBatch, index: number): ConceptResult | null {
  return batch.results.find((r) => r.index === index) || null;
}

export function markGenerating(batch: ConceptBatch, index: number): ConceptBatch {
  const r = slot(batch, index);
  if (r) {
    r.status = "generating";
    r.error = null;
  }
  return batch;
}

/** Records a produced image. Never touches any other option. */
export function addResult(
  batch: ConceptBatch,
  index: number,
  data: { image: string; durablePath?: string | null; versionId?: string | null },
): ConceptBatch {
  const r = slot(batch, index);
  if (!r) return batch;
  r.image = data.image;
  r.durablePath = data.durablePath || r.durablePath || null;
  r.versionId = data.versionId || r.versionId || null;
  r.status = "done";
  r.error = null;
  return batch;
}

export function failResult(batch: ConceptBatch, index: number, message: string): ConceptBatch {
  const r = slot(batch, index);
  if (!r) return batch;
  /* A failure never discards an image that already exists. */
  if (r.status === "done") return batch;
  r.status = "failed";
  r.error = String(message || "Generation failed");
  return batch;
}

export function succeeded(batch: ConceptBatch): ConceptResult[] {
  return batch.results.filter((r) => r.status === "done" && !!r.image);
}

export function failedIndexes(batch: ConceptBatch): number[] {
  return batch.results.filter((r) => r.status !== "done").map((r) => r.index);
}

export type BatchStatus = {
  created: number;
  requested: number;
  complete: boolean;
  partial: boolean;
  /** Honest one-line report. Never claims more than was created. */
  message: string;
  /** Credits actually consumed: one per created image. */
  creditsUsed: number;
  canRetry: boolean;
};

export function batchStatus(batch: ConceptBatch): BatchStatus {
  const created = succeeded(batch).length;
  const requested = batch.requestedCount;
  const complete = created === requested;
  const partial = created > 0 && created < requested;
  const noun = (n: number) => (n === 1 ? "image" : "images");
  return {
    created,
    requested,
    complete,
    partial,
    creditsUsed: created,
    canRetry: created < requested,
    message: complete
      ? `${created} ${noun(created)} created \u00b7 ${created} ${created === 1 ? "credit" : "credits"} used`
      : created === 0
        ? `No images were created \u00b7 no credits used`
        : `${created} of ${requested} ${noun(requested)} was created`,
  };
}

/* -------------------------------------------------------------- copy */

export function progressLabel(phase: "creating" | "saving", index: number, total: number): string {
  const verb = phase === "creating" ? "Creating" : "Saving";
  return total > 1
    ? `${verb} image ${index + 1} of ${total}\u2026`
    : `${verb} your image\u2026`;
}

export function costLabel(count: number): string {
  const n = Math.max(1, count);
  return `${n} ${n === 1 ? "image" : "images"} \u00b7 ${n} ${n === 1 ? "credit" : "credits"}`;
}

/** "Kitchen · Modern Luxury · 16:9 · Concept 1 of 2" — only real values. */
export function conceptSummary(batch: ConceptBatch, index: number): string {
  const parts: string[] = [roomLabel(batch)];
  if (batch.styleName) parts.push(batch.styleName);
  if (batch.aspectRatio) parts.push(batch.aspectRatio);
  parts.push(
    batch.requestedCount > 1
      ? `Concept ${index + 1} of ${batch.requestedCount}`
      : "Generated Concept",
  );
  return parts.join(" \u00b7 ");
}

/* ------------------------------------------------------- canvas modes */

export type CanvasMode =
  | "photo-redesign"
  | "concept-only"
  | "reference-guided"
  | "generated-variation";

export function canvasModeFor(input: {
  /** A durable source photo the result was derived from. */
  hasSource?: boolean;
  /** Inspiration images that the user did NOT mark "Use as source". */
  hasReferences?: boolean;
  isVariation?: boolean;
}): CanvasMode {
  if (input.isVariation) return "generated-variation";
  if (input.hasSource) return "photo-redesign";
  if (input.hasReferences) return "reference-guided";
  return "concept-only";
}

export type OverlayPlan = {
  /** Before/After split, handle and range input. */
  compare: boolean;
  /** "Before" / "After" corner labels. */
  cornerLabels: boolean;
  /** Reality Lock only means something when real geometry exists. */
  realityLock: boolean;
  /** Zoom/fit/fullscreen cluster, always top-right and always alone there. */
  viewerControls: "top-right";
  /** A concept gets one compact button, never a permanent editing toolbar. */
  editToolbar: "compact" | "full";
  /** References are reachable, but never used as a fake Before image. */
  referencesAction: boolean;
  resultLabel: string;
};

export function overlayPlan(mode: CanvasMode): OverlayPlan {
  const real = mode === "photo-redesign" || mode === "generated-variation";
  return {
    compare: real,
    cornerLabels: real,
    realityLock: real,
    viewerControls: "top-right",
    editToolbar: real ? "full" : "compact",
    referencesAction: mode === "reference-guided",
    resultLabel:
      mode === "photo-redesign"
        ? "Redesign"
        : mode === "generated-variation"
          ? "Variation"
          : "Generated Concept",
  };
}

/** Guard used by the canvas: the two layers may never hold the same asset. */
export function comparePairIsValid(
  beforeAsset: string | null | undefined,
  afterAsset: string | null | undefined,
): boolean {
  if (!beforeAsset || !afterAsset) return false;
  return beforeAsset !== afterAsset;
}
