/**
 * The one Room / Area picker.
 *
 * Every workflow that needs a room or an area — Canvas, Describe, Photo
 * Design, Video Builder, Save Room, Media, Properties — opens this modal.
 * It reads the authoritative catalog, filters by space, and returns a stable
 * id with its display label. It never generates, never navigates and never
 * charges a credit.
 */

import {
  NEEDS_REVIEW_LABEL,
  UNASSIGNED_LABEL,
  resolveRoom,
  roomPreview,
  roomsForSpace,
  type RoomCatalogEntry,
  type RoomSpace,
} from "@/lib/room-catalog";
import { openCatalogPicker, type CatalogItem } from "@/lib/catalog-picker";

export const UNASSIGNED_ID = "__unassigned";
export const NEEDS_REVIEW_ID = "__needs-review";
const CUSTOM_PREFIX = "custom:";

export type RoomAreaSelection = {
  id: string;
  label: string;
  space: RoomSpace | null;
  icon: string;
  previewImage: string | null;
  /** True for Unassigned, Needs Review, or a hand-typed label. */
  workflowOnly?: boolean;
};

export function normalizeSpace(space: unknown): RoomSpace {
  const s = String(space || "").toLowerCase();
  if (s === "exterior") return "exterior";
  if (s === "garden" || s === "landscape" || s === "outdoor") return "garden";
  return "interior";
}

export function roomPickerTitle(space: RoomSpace): string {
  if (space === "exterior") return "Choose An Exterior Area";
  if (space === "garden") return "Choose A Garden Area";
  return "Choose A Room";
}

function toItem(r: RoomCatalogEntry): CatalogItem {
  return {
    id: r.id,
    label: r.label,
    image: roomPreview(r.id),
    icon: r.icon,
    terms: [...(r.aliases || []), ...(r.terms || []), r.group],
  };
}

export type RoomAreaPickerOptions = {
  space?: unknown;
  /** Stable id of the current selection, when the caller has one. */
  currentId?: string | null;
  /** Current display label. Resolved through aliases when no id is given. */
  currentLabel?: string | null;
  /** Free-form context tag, e.g. "video" or "photo-design". */
  mode?: string;
  allowCustom?: boolean;
  allowUnassigned?: boolean;
  allowNeedsReview?: boolean;
  title?: string;
  description?: string;
  opener?: HTMLElement | null;
  onApply: (selection: RoomAreaSelection) => void;
  onCancel?: () => void;
};

export function openRoomAreaPicker(o: RoomAreaPickerOptions) {
  const space = normalizeSpace(o.space);
  const list = roomsForSpace(space).map(toItem);

  const extras: CatalogItem[] = [];
  if (o.allowUnassigned)
    extras.push({ id: UNASSIGNED_ID, label: UNASSIGNED_LABEL, icon: "circle-dashed" });
  if (o.allowNeedsReview)
    extras.push({ id: NEEDS_REVIEW_ID, label: NEEDS_REVIEW_LABEL, icon: "circle-help" });

  const current =
    (o.currentId && resolveRoom(o.currentId)?.id) ||
    (o.currentLabel && resolveRoom(o.currentLabel)?.id) ||
    (o.currentLabel === UNASSIGNED_LABEL ? UNASSIGNED_ID : "") ||
    (o.currentLabel === NEEDS_REVIEW_LABEL ? NEEDS_REVIEW_ID : "") ||
    "";

  const emit = (sel: RoomAreaSelection) => o.onApply(sel);

  return openCatalogPicker({
    key: "room-area",
    title: o.title || roomPickerTitle(space),
    description:
      o.description ||
      "Pick the space this photo shows. Nothing is generated and no credits are used.",
    items: list,
    selected: current ? [current] : [],
    searchPlaceholder: space === "interior" ? "Search rooms" : "Search areas",
    emptyText: "Nothing matches that search. Try a different word.",
    applyLabel: "Apply Selection",
    extras,
    ...(o.allowCustom ? { allowCustom: true } : {}),
    customHint: (q) => 'Use "' + q + '"',
    opener: o.opener ?? null,
    ...(o.onCancel ? { onCancel: o.onCancel } : {}),
    onCustom: (label) =>
      emit({
        id: CUSTOM_PREFIX + label.toLowerCase(),
        label,
        space,
        icon: "image",
        previewImage: null,
        workflowOnly: true,
      }),
    onApply: (ids) => {
      const id = ids[0] || "";
      if (id === UNASSIGNED_ID)
        return emit({
          id,
          label: UNASSIGNED_LABEL,
          space: null,
          icon: "circle-dashed",
          previewImage: null,
          workflowOnly: true,
        });
      if (id === NEEDS_REVIEW_ID)
        return emit({
          id,
          label: NEEDS_REVIEW_LABEL,
          space: null,
          icon: "circle-help",
          previewImage: null,
          workflowOnly: true,
        });
      const rec = resolveRoom(id);
      if (!rec) return;
      emit({
        id: rec.id,
        label: rec.label,
        space: rec.space,
        icon: rec.icon,
        previewImage: roomPreview(rec.id),
      });
    },
  });
}
