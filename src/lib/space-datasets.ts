/**
 * Space-aware view of the authoritative room catalog.
 *
 * This module keeps the Canvas-facing names (`AreaOption`, `areasForSpace`)
 * but owns no data of its own: everything is derived from
 * `@/lib/room-catalog`, so Canvas, Describe, Video Builder and Save Room all
 * see exactly the same rooms, ids, labels, aliases and preview images.
 */

import {
  ROOM_CATALOG,
  resolveRoom,
  roomPreview,
  roomsForSpace,
  type RoomCatalogEntry,
  type RoomSpace,
} from "@/lib/room-catalog";

export type CanvasSpace = RoomSpace;

export type AreaOption = {
  /** Stable id, also the preview asset key. */
  id: string;
  label: string;
  /** Lucide fallback used only while the preview is loading or failed. */
  icon: string;
  space: CanvasSpace;
};

const toArea = (r: RoomCatalogEntry): AreaOption => ({
  id: r.id,
  label: r.label,
  icon: r.icon,
  space: r.space,
});

export const interiorRoomTypes: AreaOption[] = roomsForSpace("interior").map(toArea);
export const exteriorAreaTypes: AreaOption[] = roomsForSpace("exterior").map(toArea);
export const gardenAreaTypes: AreaOption[] = roomsForSpace("garden").map(toArea);

/** The complete, authoritative list of choices for one space. */
export function areasForSpace(space: CanvasSpace): AreaOption[] {
  return roomsForSpace(space).map(toArea);
}

/** Section heading: an exterior photo never asks for a "Room". */
export function areaSectionLabel(space: CanvasSpace): string {
  return space === "interior" ? "Room" : "Area";
}

export function areaByLabel(label: string): AreaOption | null {
  const rec = resolveRoom(label);
  return rec ? toArea(rec) : null;
}

export function areaById(id: string): AreaOption | null {
  const rec = resolveRoom(id);
  return rec ? toArea(rec) : null;
}

/** True when a selected label still belongs to the active space. */
export function areaFitsSpace(label: string, space: CanvasSpace): boolean {
  const rec = resolveRoom(label);
  return !!rec && rec.space === space;
}

/** Durable preview image for a choice, or null when none is stored yet. */
export function areaPreview(id: string): string | null {
  return roomPreview(id);
}

export const ALL_AREAS: AreaOption[] = ROOM_CATALOG.map(toArea);
