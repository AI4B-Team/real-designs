/**
 * The one authoritative Canvas generation model.
 *
 * Progress, the displayed concept, room metadata, persistence, Version History
 * and every action derive from a single `CanvasSession`. Nothing else keeps a
 * parallel copy of "what is happening right now":
 *
 *  - outputs exist before the first pixel arrives, in permanent numerical order,
 *  - the active output is addressed by `outputId`, never by array position,
 *  - status copy always describes the real lifecycle,
 *  - room type, style and space live on the session, so every surface agrees,
 *  - `generationStatus` and `roomSaveStatus` are derived, never hand-set.
 */

export type OutputStatus =
  | "queued"
  | "generating"
  | "uploading"
  | "saving"
  | "saved"
  | "failed";

export type CanvasOutput = {
  outputId: string;
  outputIndex: number;
  generationJobId: string | null;
  persistentVersionId: string | null;
  versionNo: number | null;
  sourceStoragePath: string | null;
  resultStoragePath: string | null;
  displayUrl: string | null;
  status: OutputStatus;
  errorCode: string | null;
  retryable: boolean;
  createdAt: string;
  savedAt: string | null;
};

export type OutputKind = "concept" | "design";

export type GenerationStatus =
  | "idle"
  | "queued"
  | "generating"
  | "partially_complete"
  | "complete"
  | "failed";

export type RoomSaveStatus = "unsaved" | "saving" | "saved" | "failed";

export type CanvasSession = {
  sessionId: string;
  draftId: string | null;
  propertyId: string | null;
  projectId: string | null;
  roomId: string | null;
  sourceAssetId: string | null;
  spaceType: "interior" | "exterior" | "garden";
  roomTypeId: string | null;
  roomTypeName: string | null;
  roomSource: "selected" | "inferred" | "unknown";
  activeTool: string;
  selectedStyleId: string | null;
  selectedStyleName: string | null;
  changeLevel: "subtle" | "balanced" | "bold";
  finishGrade: string | null;
  prompt: string;
  kind: OutputKind;
  requestedOutputCount: number;
  outputs: CanvasOutput[];
  activeOutputId: string | null;
  roomSaveStatus: RoomSaveStatus;
  generationStatus: GenerationStatus;
};

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export function createSession(input: {
  count: number;
  kind?: OutputKind;
  roomType?: string | null;
  roomTypeId?: string | null;
  roomSource?: CanvasSession["roomSource"];
  sessionId?: string | null;
  spaceType?: CanvasSession["spaceType"];
  activeTool?: string;
  styleId?: string | null;
  styleName?: string | null;
  changeLevel?: CanvasSession["changeLevel"];
  finishGrade?: string | null;
  prompt?: string;
  sourceStoragePath?: string | null;
  sourceAssetId?: string | null;
  roomId?: string | null;
  propertyId?: string | null;
  projectId?: string | null;
}): CanvasSession {
  const requested = Math.max(1, Math.min(8, Number(input.count) || 1));
  const sessionId = input.sessionId || nextId("cs");
  const now = new Date().toISOString();
  const outputs: CanvasOutput[] = Array.from({ length: requested }, (_, i) => ({
    outputId: `${sessionId}:${i}`,
    outputIndex: i,
    generationJobId: `${sessionId}:job:${i}`,
    persistentVersionId: null,
    versionNo: null,
    sourceStoragePath: input.sourceStoragePath || null,
    resultStoragePath: null,
    displayUrl: null,
    status: (i === 0 ? "generating" : "queued") as OutputStatus,
    errorCode: null,
    retryable: true,
    createdAt: now,
    savedAt: null,
  }));
  const s: CanvasSession = {
    sessionId,
    draftId: null,
    propertyId: input.propertyId || null,
    projectId: input.projectId || null,
    roomId: input.roomId || null,
    sourceAssetId: input.sourceAssetId || null,
    spaceType: input.spaceType || "interior",
    roomTypeId: input.roomTypeId || null,
    roomTypeName: input.roomType || null,
    roomSource: input.roomSource || (input.roomType ? "selected" : "unknown"),
    activeTool: input.activeTool || "redesign",
    selectedStyleId: input.styleId || null,
    selectedStyleName: input.styleName || null,
    changeLevel: input.changeLevel || "balanced",
    finishGrade: input.finishGrade || null,
    prompt: input.prompt || "",
    kind: input.kind || "concept",
    requestedOutputCount: requested,
    outputs,
    activeOutputId: outputs[0] ? outputs[0].outputId : null,
    roomSaveStatus: input.roomId ? "saved" : "unsaved",
    generationStatus: "generating",
  };
  return recompute(s);
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function orderedOutputs(s: CanvasSession): CanvasOutput[] {
  return s.outputs.slice().sort((a, b) => a.outputIndex - b.outputIndex);
}

export function outputAt(s: CanvasSession, index: number): CanvasOutput | null {
  return s.outputs.find((o) => o.outputIndex === index) || null;
}

export function outputById(s: CanvasSession, outputId: string | null): CanvasOutput | null {
  if (!outputId) return null;
  return s.outputs.find((o) => o.outputId === outputId) || null;
}

export function activeOutput(s: CanvasSession): CanvasOutput | null {
  return outputById(s, s.activeOutputId) || orderedOutputs(s)[0] || null;
}

/* ------------------------------------------------------------------ */
/* Derived state — never set by hand                                   */
/* ------------------------------------------------------------------ */

export function counts(s: CanvasSession) {
  const has = (...st: OutputStatus[]) => s.outputs.filter((o) => st.includes(o.status)).length;
  return {
    saved: has("saved"),
    saving: has("saving", "uploading"),
    generating: has("generating", "queued"),
    failed: has("failed"),
    withImage: s.outputs.filter((o) => !!o.displayUrl).length,
  };
}

export function recompute(s: CanvasSession): CanvasSession {
  const c = counts(s);
  const total = s.requestedOutputCount;
  s.generationStatus =
    c.generating === total && !c.saved && !c.failed
      ? s.outputs.every((o) => o.status === "queued")
        ? "queued"
        : "generating"
      : c.generating || c.saving
        ? "generating"
        : c.saved === total
          ? "complete"
          : c.saved
            ? "partially_complete"
            : c.failed
              ? "failed"
              : "idle";
  /* Version numbers are assigned in permanent output order, so Version History
     can never show a number that disagrees with the slot it belongs to. */
  let n = 0;
  orderedOutputs(s).forEach((o) => {
    if (o.resultStoragePath || o.persistentVersionId) {
      n += 1;
      o.versionNo = n;
    }
  });
  /* The active output always exists and always has something to show. */
  const active = outputById(s, s.activeOutputId);
  if (!active || (!active.displayUrl && c.withImage))
    s.activeOutputId = (orderedOutputs(s).find((o) => !!o.displayUrl) || orderedOutputs(s)[0] || { outputId: null })
      .outputId;
  return s;
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

export function markGenerating(s: CanvasSession, index: number): CanvasSession {
  const o = outputAt(s, index);
  if (o && o.status !== "saved") {
    o.status = "generating";
    o.errorCode = null;
  }
  return recompute(s);
}

export function markUploading(s: CanvasSession, index: number): CanvasSession {
  const o = outputAt(s, index);
  if (o && o.status !== "saved") o.status = "uploading";
  return recompute(s);
}

/** The image exists but is not durable yet. */
export function markImage(s: CanvasSession, index: number, displayUrl: string): CanvasSession {
  const o = outputAt(s, index);
  if (!o) return s;
  o.displayUrl = displayUrl;
  o.status = "saving";
  o.errorCode = null;
  if (!s.activeOutputId || !outputById(s, s.activeOutputId)?.displayUrl) s.activeOutputId = o.outputId;
  return recompute(s);
}

export function markSaved(
  s: CanvasSession,
  index: number,
  data: { path?: string | null; versionId?: string | null },
): CanvasSession {
  const o = outputAt(s, index);
  if (!o) return s;
  o.resultStoragePath = data.path || o.resultStoragePath || null;
  o.persistentVersionId = data.versionId || o.persistentVersionId || null;
  o.status = "saved";
  o.errorCode = null;
  o.savedAt = new Date().toISOString();
  return recompute(s);
}

/** A failure never discards an image that already exists. */
export function markFailed(
  s: CanvasSession,
  index: number,
  message: string,
  opts?: { retryable?: boolean },
): CanvasSession {
  const o = outputAt(s, index);
  if (!o || o.status === "saved") return s;
  o.status = "failed";
  o.errorCode = String(message || "Generation failed");
  o.retryable = opts?.retryable !== false;
  return recompute(s);
}

export function setActive(s: CanvasSession, outputId: string): CanvasSession {
  if (outputById(s, outputId)) s.activeOutputId = outputId;
  return s;
}

export function setRoomType(
  s: CanvasSession,
  name: string | null,
  opts?: { id?: string | null; source?: CanvasSession["roomSource"] },
): CanvasSession {
  if (!name) return s;
  s.roomTypeName = name;
  if (opts?.id !== undefined) s.roomTypeId = opts.id;
  s.roomSource = opts?.source || (s.roomSource === "unknown" ? "inferred" : s.roomSource);
  return s;
}

export function setRoomSave(s: CanvasSession, status: RoomSaveStatus, roomId?: string | null): CanvasSession {
  s.roomSaveStatus = status;
  if (roomId !== undefined) s.roomId = roomId;
  return s;
}

export function patch(s: CanvasSession, changes: Partial<CanvasSession>): CanvasSession {
  Object.assign(s, changes);
  return recompute(s);
}

/* ------------------------------------------------------------------ */
/* Copy — one source for every label in the UI                         */
/* ------------------------------------------------------------------ */

export function noun(s: CanvasSession): string {
  return s.kind === "concept" ? "concept" : "design";
}

function cap(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** "Concept 1" — always from outputIndex, never from array position. */
export function outputLabel(s: CanvasSession, o: CanvasOutput): string {
  const base = s.kind === "concept" ? "Concept" : "Design";
  return s.requestedOutputCount > 1 ? `${base} ${o.outputIndex + 1}` : base;
}

/** "Concept 2 of 2" for the right-panel summary. */
export function activeSummary(s: CanvasSession): string {
  const o = activeOutput(s);
  if (!o) return "";
  const base = s.kind === "concept" ? "Concept" : "Design";
  return s.requestedOutputCount > 1
    ? `${base} ${o.outputIndex + 1} of ${s.requestedOutputCount}`
    : `Generated ${base}`;
}

/** The single inline status line. Exactly one string is ever shown. */
export function statusLine(s: CanvasSession): string {
  const total = s.requestedOutputCount;
  const plural = noun(s) + (total === 1 ? "" : "s");
  const c = counts(s);
  const gen = orderedOutputs(s).find((o) => o.status === "generating");
  if (gen)
    return total > 1
      ? `Generating ${noun(s)} ${gen.outputIndex + 1} of ${total}\u2026`
      : `Generating your ${noun(s)}\u2026`;
  const sav = orderedOutputs(s).find((o) => o.status === "saving" || o.status === "uploading");
  if (sav)
    return total > 1
      ? `Saving ${noun(s)} ${sav.outputIndex + 1} of ${total}\u2026`
      : `Saving your ${noun(s)}\u2026`;
  if (c.failed && c.saved) return `${c.saved} of ${total} ${plural} saved \u00b7 retry the rest`;
  if (c.failed && !c.saved) return "Save failed \u2014 retry";
  if (c.saved === total) return total > 1 ? `${total} ${plural} saved` : `${cap(noun(s))} saved`;
  if (c.saved) {
    const first = orderedOutputs(s).find((o) => o.status === "saved");
    return `${cap(noun(s))} ${(first ? first.outputIndex : 0) + 1} saved`;
  }
  const queued = orderedOutputs(s).find((o) => o.status === "queued");
  if (queued)
    return total > 1
      ? `Generating ${noun(s)} ${queued.outputIndex + 1} of ${total}\u2026`
      : `Generating your ${noun(s)}\u2026`;
  return "";
}

/** "2 concepts · 1 saved · 1 generating" for the Version History header. */
export function historyCount(s: CanvasSession): string {
  const total = s.requestedOutputCount;
  const plural = noun(s) + (total === 1 ? "" : "s");
  const c = counts(s);
  const parts = [`${total} ${plural}`];
  if (c.saved) parts.push(`${c.saved} saved`);
  if (c.saving) parts.push(`${c.saving} saving`);
  if (c.generating) parts.push(`${c.generating} generating`);
  if (c.failed) parts.push(`${c.failed} failed`);
  return parts.join(" \u00b7 ");
}

/** Slot-level badge under each thumbnail. */
export function outputBadge(_s: CanvasSession, o: CanvasOutput): string {
  switch (o.status) {
    case "queued":
      return "Queued";
    case "generating":
      return "Generating";
    case "uploading":
      return "Uploading\u2026";
    case "saving":
      return "Saving\u2026";
    case "saved":
      return o.versionNo ? `Saved \u00b7 V${o.versionNo}` : "Saved";
    case "failed":
      return "Failed";
    default:
      return "";
  }
}

export type SaveRoomState = { enabled: boolean; label: string; tooltip: string };

/**
 * Save Room always explains itself: disabled only while durable saves run, and
 * enabled the moment they finish — including when one output failed.
 */
export function saveRoomState(s: CanvasSession | null, opts?: { roomSaved?: boolean }): SaveRoomState {
  const saved = opts?.roomSaved ?? (s ? s.roomSaveStatus === "saved" : false);
  if (!s)
    return {
      enabled: true,
      label: saved ? "Room Saved" : "Save Room",
      tooltip: saved ? "Update this saved room" : "Save this room to your account",
    };
  if (s.roomSaveStatus === "saving")
    return { enabled: false, label: "Saving Room\u2026", tooltip: "This room is being saved." };
  const c = counts(s);
  if (c.generating || c.saving)
    return {
      enabled: false,
      label: `Saving ${noun(s)}s\u2026`,
      tooltip:
        s.requestedOutputCount > 1
          ? "Available after both concepts finish saving."
          : "Available once this concept finishes saving.",
    };
  if (!c.saved)
    return {
      enabled: false,
      label: "Save Room",
      tooltip: "Nothing has been saved yet. Retry the failed generation first.",
    };
  return {
    enabled: true,
    label: saved ? "Room Saved" : "Save Room",
    tooltip: saved ? "Update this saved room" : "Save this room and its generated concepts",
  };
}

/** Every output that is durable and must be attached when the room is saved. */
export function persistableOutputs(s: CanvasSession): CanvasOutput[] {
  return orderedOutputs(s).filter((o) => !!o.resultStoragePath);
}

/** Which actions may run against the active output right now. */
export function actionState(s: CanvasSession | null): {
  enabled: boolean;
  reason: string;
  outputId: string | null;
} {
  const o = s ? activeOutput(s) : null;
  if (!s || !o) return { enabled: false, reason: "Generate a design first.", outputId: null };
  if (!o.displayUrl)
    return { enabled: false, reason: "This output is still generating.", outputId: o.outputId };
  return { enabled: true, reason: "", outputId: o.outputId };
}
