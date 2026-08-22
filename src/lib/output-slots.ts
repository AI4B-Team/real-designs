/**
 * Multi-output generation state.
 *
 * One request that asks for N images creates N slots up front, in permanent
 * numerical order. A slot owns its own identity (`outputId`, `outputIndex`,
 * `generationJobId`, `persistentVersionId`) and its own lifecycle, so:
 *
 *  - the second result can never overwrite or reorder the first,
 *  - the active output is addressed by id, never by array position,
 *  - status copy always describes the real lifecycle (generating / saving /
 *    saved / failed) and never claims a file is "uploading",
 *  - exactly one status line exists, so nothing stacks on top of anything.
 */

export type SlotStatus = "queued" | "generating" | "saving" | "saved" | "failed";

export type OutputSlot = {
  outputId: string;
  outputIndex: number;
  generationJobId: string;
  persistentVersionId: string | null;
  image: string | null;
  path: string | null;
  status: SlotStatus;
  error: string | null;
};

export type OutputKind = "concept" | "design";

export type OutputSet = {
  setId: string;
  kind: OutputKind;
  requested: number;
  /** The one authoritative room type for every slot in this set. */
  roomType: string | null;
  roomSource: "selected" | "inferred" | "unknown";
  slots: OutputSlot[];
  activeOutputId: string | null;
};

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export function createOutputSet(input: {
  count: number;
  kind?: OutputKind;
  roomType?: string | null;
  roomSource?: OutputSet["roomSource"];
  setId?: string | null;
}): OutputSet {
  const requested = Math.max(1, Math.min(8, Number(input.count) || 1));
  const setId = input.setId || nextId("set");
  const slots: OutputSlot[] = Array.from({ length: requested }, (_, i) => ({
    outputId: `${setId}:${i}`,
    outputIndex: i,
    generationJobId: `${setId}:job:${i}`,
    persistentVersionId: null,
    image: null,
    path: null,
    status: (i === 0 ? "generating" : "queued") as SlotStatus,
    error: null,
  }));
  return {
    setId,
    kind: input.kind || "concept",
    requested,
    roomType: input.roomType || null,
    roomSource: input.roomSource || (input.roomType ? "selected" : "unknown"),
    slots,
    activeOutputId: slots[0] ? slots[0].outputId : null,
  };
}

/** Slots in permanent numerical order, whatever order they finished in. */
export function orderedSlots(set: OutputSet): OutputSlot[] {
  return set.slots.slice().sort((a, b) => a.outputIndex - b.outputIndex);
}

export function slotAt(set: OutputSet, index: number): OutputSlot | null {
  return set.slots.find((s) => s.outputIndex === index) || null;
}

export function slotById(set: OutputSet, outputId: string | null): OutputSlot | null {
  if (!outputId) return null;
  return set.slots.find((s) => s.outputId === outputId) || null;
}

export function markGenerating(set: OutputSet, index: number): OutputSet {
  const s = slotAt(set, index);
  if (s && s.status !== "saved") {
    s.status = "generating";
    s.error = null;
  }
  return set;
}

/** The image exists but is not durable yet. */
export function markImage(set: OutputSet, index: number, image: string): OutputSet {
  const s = slotAt(set, index);
  if (!s) return set;
  s.image = image;
  s.status = "saving";
  s.error = null;
  if (!set.activeOutputId || !slotById(set, set.activeOutputId)?.image)
    set.activeOutputId = s.outputId;
  return set;
}

export function markSaved(
  set: OutputSet,
  index: number,
  data: { path?: string | null; versionId?: string | null },
): OutputSet {
  const s = slotAt(set, index);
  if (!s) return set;
  s.path = data.path || s.path || null;
  s.persistentVersionId = data.versionId || s.persistentVersionId || null;
  s.status = "saved";
  s.error = null;
  return set;
}

/** A failure never discards an image that already exists. */
export function markFailed(set: OutputSet, index: number, message: string): OutputSet {
  const s = slotAt(set, index);
  if (!s || s.status === "saved") return set;
  s.status = "failed";
  s.error = String(message || "Generation failed");
  return set;
}

export function setActive(set: OutputSet, outputId: string): OutputSet {
  if (slotById(set, outputId)) set.activeOutputId = outputId;
  return set;
}

export function activeSlot(set: OutputSet): OutputSlot | null {
  return slotById(set, set.activeOutputId) || orderedSlots(set)[0] || null;
}

export function noun(set: OutputSet): string {
  return set.kind === "concept" ? "concept" : "design";
}

/** "Concept 1" — always from outputIndex, never from array position. */
export function slotLabel(set: OutputSet, slot: OutputSlot): string {
  const base = set.kind === "concept" ? "Concept" : "Design";
  return set.requested > 1 ? `${base} ${slot.outputIndex + 1}` : base;
}

/** "Concept 2 of 2" for the right-panel summary. */
export function activeSummary(set: OutputSet): string {
  const s = activeSlot(set);
  if (!s) return "";
  const base = set.kind === "concept" ? "Concept" : "Design";
  return set.requested > 1
    ? `${base} ${s.outputIndex + 1} of ${set.requested}`
    : `Generated ${base}`;
}

export function counts(set: OutputSet) {
  const saved = set.slots.filter((s) => s.status === "saved").length;
  const saving = set.slots.filter((s) => s.status === "saving").length;
  const generating = set.slots.filter(
    (s) => s.status === "generating" || s.status === "queued",
  ).length;
  const failed = set.slots.filter((s) => s.status === "failed").length;
  const withImage = set.slots.filter((s) => !!s.image).length;
  return { saved, saving, generating, failed, withImage };
}

/**
 * The single inline status line. Exactly one string is ever shown, so status
 * messages cannot overlap each other or any control.
 */
export function statusLine(set: OutputSet): string {
  const total = set.requested;
  const plural = noun(set) + (total === 1 ? "" : "s");
  const c = counts(set);
  const gen = orderedSlots(set).find((s) => s.status === "generating");
  if (gen)
    return total > 1
      ? `Generating ${noun(set)} ${gen.outputIndex + 1} of ${total}\u2026`
      : `Generating your ${noun(set)}\u2026`;
  const sav = orderedSlots(set).find((s) => s.status === "saving");
  if (sav)
    return total > 1
      ? `Saving ${noun(set)} ${sav.outputIndex + 1} of ${total}\u2026`
      : `Saving your ${noun(set)}\u2026`;
  if (c.failed && c.saved) return `${c.saved} of ${total} ${plural} saved \u00b7 retry the rest`;
  if (c.failed && !c.saved) return "Save failed \u2014 retry";
  if (c.saved === total) return total > 1 ? `${total} ${plural} saved` : `${cap(noun(set))} saved`;
  if (c.saved) return `${cap(noun(set))} ${firstSavedIndex(set) + 1} saved`;
  const queued = orderedSlots(set).find((s) => s.status === "queued");
  if (queued)
    return total > 1
      ? `Generating ${noun(set)} ${queued.outputIndex + 1} of ${total}\u2026`
      : `Generating your ${noun(set)}\u2026`;
  return "";
}

function firstSavedIndex(set: OutputSet): number {
  const s = orderedSlots(set).find((x) => x.status === "saved");
  return s ? s.outputIndex : 0;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2 concepts · 1 saved · 1 generating" for the Version History header. */
export function historyCount(set: OutputSet): string {
  const total = set.requested;
  const plural = noun(set) + (total === 1 ? "" : "s");
  const c = counts(set);
  const parts = [`${total} ${plural}`];
  if (c.saved) parts.push(`${c.saved} saved`);
  if (c.saving) parts.push(`${c.saving} saving`);
  if (c.generating) parts.push(`${c.generating} generating`);
  if (c.failed) parts.push(`${c.failed} failed`);
  return parts.join(" \u00b7 ");
}

/** Slot-level badge under each thumbnail. */
export function slotBadge(set: OutputSet, slot: OutputSlot): string {
  switch (slot.status) {
    case "queued":
      return "Queued";
    case "generating":
      return "Generating";
    case "saving":
      return "Saving\u2026";
    case "saved":
      return "Saved";
    case "failed":
      return "Failed";
    default:
      return "";
  }
}

export type SaveRoomState = { enabled: boolean; label: string; tooltip: string };

/**
 * Save Room always explains itself: it is only disabled while durable saves
 * are still running, and it enables the moment they finish — including when
 * one output failed but another succeeded.
 */
export function saveRoomState(set: OutputSet | null, opts?: { roomSaved?: boolean }): SaveRoomState {
  const saved = !!opts?.roomSaved;
  if (!set)
    return {
      enabled: true,
      label: saved ? "Room Saved" : "Save Room",
      tooltip: saved ? "Update this saved room" : "Save this room to your account",
    };
  const c = counts(set);
  if (c.generating || c.saving)
    return {
      enabled: false,
      label: `Saving ${noun(set)}s\u2026`,
      tooltip:
        set.requested > 1
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
export function persistableSlots(set: OutputSet): OutputSlot[] {
  return orderedSlots(set).filter((s) => !!s.path);
}
