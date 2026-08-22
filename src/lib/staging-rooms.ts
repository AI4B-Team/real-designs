/**
 * Staging-facing view of the authoritative room catalog.
 *
 * The multi-photo staging workflow and the Video Builder classifier used to
 * carry their own room list. They now read the same catalog as everything
 * else; this module only adapts the shape (`RoomOption`, grouped lists,
 * classifier lookups) so existing call sites keep working.
 */

import {
  ROOM_CATALOG,
  ROOM_GROUPS,
  UNASSIGNED_LABEL as CATALOG_UNASSIGNED,
  groupRoomCatalog,
  resolveRoom,
  roomFromCategory as catalogRoomFromCategory,
  roomIconFor,
  roomRankOf,
  searchRoomCatalog,
  type RoomCatalogEntry,
} from "@/lib/room-catalog";
import type { PhotoCategory } from "@/lib/photo-classify";

/** Staging calls the garden space "landscape". */
export type SpaceType = "interior" | "exterior" | "landscape";

export type RoomOption = {
  id: string;
  label: string;
  icon: string;
  space: SpaceType;
  group: string;
  from?: PhotoCategory[];
};

export const ROOM_GROUP_ORDER = ROOM_GROUPS;

const toOption = (r: RoomCatalogEntry): RoomOption => ({
  id: r.id,
  label: r.label,
  icon: r.icon,
  space: r.space === "garden" ? "landscape" : r.space,
  group: r.group,
  ...(r.from ? { from: r.from } : {}),
});

export const ROOM_OPTIONS: RoomOption[] = ROOM_CATALOG.map(toOption);

export const UNASSIGNED_LABEL = CATALOG_UNASSIGNED;

export function roomByLabel(label: unknown): RoomOption | null {
  const rec = resolveRoom(label);
  return rec ? toOption(rec) : null;
}

/** Turn a classifier category into the closest catalog room. */
export function roomFromCategory(label: unknown): RoomOption | null {
  const rec = catalogRoomFromCategory(label);
  return rec ? toOption(rec) : null;
}

/** Icon for any label, including hand-typed ones. */
export function roomIcon(label: unknown): string {
  return roomIconFor(label);
}

export function roomSpace(label: unknown): SpaceType {
  const rec = resolveRoom(label) || catalogRoomFromCategory(label);
  return rec ? (rec.space === "garden" ? "landscape" : rec.space) : "interior";
}

/** Search the catalog. An empty query returns everything, in catalog order. */
export function searchRooms(query: string): RoomOption[] {
  return searchRoomCatalog(query).map(toOption);
}

/** Group an option list for rendering, keeping the catalog group order. */
export function groupRooms(list: RoomOption[]): Array<{ group: string; rooms: RoomOption[] }> {
  const ids = new Set(list.map((r) => r.id));
  return groupRoomCatalog(ROOM_CATALOG.filter((r) => ids.has(r.id))).map((g) => ({
    group: g.group,
    rooms: g.rooms.map(toOption),
  }));
}

/** Sort rank so a reviewed set reads front-to-back through a house. */
export function roomRank(label: unknown): number {
  return roomRankOf(label);
}
