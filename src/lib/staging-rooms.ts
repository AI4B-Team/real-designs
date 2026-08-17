/**
 * Room catalog for the multi-photo staging workflow.
 *
 * One list, one icon per room, one space type. The video builder's classifier
 * returns broad categories (Living Room, Other Interior, ...); this catalog is
 * finer grained because the Studio canvas prompts read the room name. Every
 * catalog entry maps back onto a classifier category so an AI guess can be
 * turned into a concrete selection, and any hand-typed label is preserved.
 */

import { normalizeCategory, type PhotoCategory } from "@/lib/photo-classify";

export type SpaceType = "interior" | "exterior" | "landscape";

export type RoomOption = {
  id: string;
  label: string;
  icon: string;
  space: SpaceType;
  group: string;
  /** Classifier categories that should resolve to this room. */
  from?: PhotoCategory[];
};

export const ROOM_GROUP_ORDER = ["Living Spaces", "Bedrooms & Baths", "Utility & Transition", "Exterior & Outdoor"] as const;

export const ROOM_OPTIONS: RoomOption[] = [
  /* Living spaces */
  { id: "living-room", label: "Living Room", icon: "sofa", space: "interior", group: "Living Spaces", from: ["Living Room"] },
  { id: "family-room", label: "Family Room", icon: "tv", space: "interior", group: "Living Spaces" },
  { id: "great-room", label: "Great Room", icon: "layout-dashboard", space: "interior", group: "Living Spaces" },
  { id: "kitchen", label: "Kitchen", icon: "cooking-pot", space: "interior", group: "Living Spaces", from: ["Kitchen"] },
  { id: "dining-room", label: "Dining Room", icon: "utensils", space: "interior", group: "Living Spaces", from: ["Dining Room"] },
  { id: "breakfast-nook", label: "Breakfast Nook", icon: "coffee", space: "interior", group: "Living Spaces" },
  { id: "home-office", label: "Home Office", icon: "laptop", space: "interior", group: "Living Spaces", from: ["Office"] },
  { id: "bonus-room", label: "Bonus Room", icon: "gamepad-2", space: "interior", group: "Living Spaces" },
  { id: "sunroom", label: "Sunroom", icon: "sun", space: "interior", group: "Living Spaces" },
  { id: "media-room", label: "Media Room", icon: "clapperboard", space: "interior", group: "Living Spaces" },
  { id: "gym", label: "Home Gym", icon: "dumbbell", space: "interior", group: "Living Spaces" },

  /* Bedrooms and baths */
  { id: "primary-bedroom", label: "Primary Bedroom", icon: "bed-double", space: "interior", group: "Bedrooms & Baths", from: ["Bedroom"] },
  { id: "bedroom", label: "Bedroom", icon: "bed", space: "interior", group: "Bedrooms & Baths" },
  { id: "guest-bedroom", label: "Guest Bedroom", icon: "bed-single", space: "interior", group: "Bedrooms & Baths" },
  { id: "nursery", label: "Nursery", icon: "baby", space: "interior", group: "Bedrooms & Baths" },
  { id: "primary-bath", label: "Primary Bath", icon: "bath", space: "interior", group: "Bedrooms & Baths", from: ["Bathroom"] },
  { id: "guest-bath", label: "Guest Bath", icon: "shower-head", space: "interior", group: "Bedrooms & Baths" },
  { id: "half-bath", label: "Half Bath", icon: "toilet", space: "interior", group: "Bedrooms & Baths" },
  { id: "walk-in-closet", label: "Walk In Closet", icon: "shirt", space: "interior", group: "Bedrooms & Baths" },

  /* Utility and transition */
  { id: "entry", label: "Entry", icon: "door-open", space: "interior", group: "Utility & Transition", from: ["Entry"] },
  { id: "hallway", label: "Hallway", icon: "move-horizontal", space: "interior", group: "Utility & Transition" },
  { id: "stairwell", label: "Stairwell", icon: "stretch-vertical", space: "interior", group: "Utility & Transition" },
  { id: "laundry", label: "Laundry", icon: "washing-machine", space: "interior", group: "Utility & Transition" },
  { id: "mudroom", label: "Mudroom", icon: "footprints", space: "interior", group: "Utility & Transition" },
  { id: "pantry", label: "Pantry", icon: "archive", space: "interior", group: "Utility & Transition" },
  { id: "basement", label: "Basement", icon: "layers", space: "interior", group: "Utility & Transition", from: ["Other Interior"] },
  { id: "attic", label: "Attic", icon: "triangle", space: "interior", group: "Utility & Transition" },
  { id: "garage", label: "Garage", icon: "car", space: "interior", group: "Utility & Transition", from: ["Garage"] },

  /* Exterior and outdoor */
  { id: "facade", label: "Front Exterior", icon: "home", space: "exterior", group: "Exterior & Outdoor", from: ["Front Exterior"] },
  { id: "rear-exterior", label: "Rear Exterior", icon: "house", space: "exterior", group: "Exterior & Outdoor", from: ["Rear Exterior", "Other Exterior"] },
  { id: "front-yard", label: "Front Yard", icon: "trees", space: "landscape", group: "Exterior & Outdoor" },
  { id: "backyard", label: "Backyard", icon: "tree-pine", space: "landscape", group: "Exterior & Outdoor", from: ["Yard"] },
  { id: "patio", label: "Patio", icon: "umbrella", space: "landscape", group: "Exterior & Outdoor" },
  { id: "deck", label: "Deck", icon: "grid-3x3", space: "landscape", group: "Exterior & Outdoor" },
  { id: "pool-area", label: "Pool Area", icon: "waves", space: "landscape", group: "Exterior & Outdoor", from: ["Pool"] },
  { id: "commercial-space", label: "Commercial Space", icon: "building-2", space: "interior", group: "Exterior & Outdoor" },
];

export const UNASSIGNED_LABEL = "Unassigned";

const BY_LABEL = new Map(ROOM_OPTIONS.map((r) => [r.label.toLowerCase(), r]));

export function roomByLabel(label: unknown): RoomOption | null {
  const raw = String(label ?? "").trim();
  if (!raw) return null;
  return BY_LABEL.get(raw.toLowerCase()) || null;
}

/** Turn a classifier category into the closest catalog room. */
export function roomFromCategory(label: unknown): RoomOption | null {
  const direct = roomByLabel(label);
  if (direct) return direct;
  const cat = normalizeCategory(label);
  if (!cat) return null;
  return ROOM_OPTIONS.find((r) => (r.from || []).includes(cat)) || null;
}

/** Icon for any label, including hand-typed ones. */
export function roomIcon(label: unknown): string {
  const r = roomByLabel(label) || roomFromCategory(label);
  return r ? r.icon : "image";
}

export function roomSpace(label: unknown): SpaceType {
  const r = roomByLabel(label) || roomFromCategory(label);
  return r ? r.space : "interior";
}

/** Search the catalog. An empty query returns everything, in catalog order. */
export function searchRooms(query: string): RoomOption[] {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return ROOM_OPTIONS.slice();
  const starts: RoomOption[] = [];
  const contains: RoomOption[] = [];
  for (const r of ROOM_OPTIONS) {
    const l = r.label.toLowerCase();
    if (l.startsWith(q)) starts.push(r);
    else if (l.includes(q) || r.group.toLowerCase().includes(q)) contains.push(r);
  }
  return starts.concat(contains);
}

/** Group an option list for rendering, keeping the catalog group order. */
export function groupRooms(list: RoomOption[]): Array<{ group: string; rooms: RoomOption[] }> {
  const out: Array<{ group: string; rooms: RoomOption[] }> = [];
  for (const g of ROOM_GROUP_ORDER) {
    const rooms = list.filter((r) => r.group === g);
    if (rooms.length) out.push({ group: g, rooms });
  }
  return out;
}

/** Sort rank so a reviewed set reads front-to-back through a house. */
export function roomRank(label: unknown): number {
  const r = roomByLabel(label) || roomFromCategory(label);
  if (!r) return ROOM_OPTIONS.length + 1;
  return ROOM_OPTIONS.indexOf(r);
}
