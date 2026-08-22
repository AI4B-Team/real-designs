/**
 * The one authoritative Room / Area catalog for the whole application.
 *
 * Every workflow — Canvas, Describe, Photo Design, Video Builder, Save Room,
 * Media and Properties — reads rooms from here. Entries own a stable id, one
 * display label, aliases for every legacy label that has ever been persisted,
 * a space category, a grouping used by list-style UIs, search terms, an icon
 * and a preview image key.
 *
 * Rooms are compared by id. Labels are display values only; `roomByAnyLabel`
 * exists so records saved before the consolidation still resolve to an id.
 */

import { ROOM_PHOTOS } from "@/content/rd-room-photos";
import { normalizeCategory, type PhotoCategory } from "@/lib/photo-classify";

export type RoomSpace = "interior" | "exterior" | "garden";

export type RoomGroup =
  | "Living Spaces"
  | "Bedrooms & Baths"
  | "Utility & Transition"
  | "Exterior & Outdoor";

export const ROOM_GROUPS: RoomGroup[] = [
  "Living Spaces",
  "Bedrooms & Baths",
  "Utility & Transition",
  "Exterior & Outdoor",
];

export type RoomCatalogEntry = {
  /** Stable id. Never derived from the label. */
  id: string;
  label: string;
  icon: string;
  space: RoomSpace;
  group: RoomGroup;
  /** Legacy or colloquial labels that resolve to this entry. */
  aliases?: string[];
  /** Extra words the search field should match. */
  terms?: string[];
  /** Classifier categories that resolve to this entry. */
  from?: PhotoCategory[];
  /** Preview asset key when the entry borrows another entry's photo. */
  previewId?: string;
};

const I = "interior" as const;
const E = "exterior" as const;
const G = "garden" as const;

export const ROOM_CATALOG: RoomCatalogEntry[] = [
  /* ---------------------------------------------------------- interior */
  { id: "i-living-room", label: "Living Room", icon: "sofa", space: I, group: "Living Spaces", from: ["Living Room"] },
  { id: "i-family-room", label: "Family Room", icon: "tv", space: I, group: "Living Spaces" },
  { id: "i-great-room", label: "Great Room", icon: "layout-dashboard", space: I, group: "Living Spaces" },
  { id: "i-kitchen", label: "Kitchen", icon: "cooking-pot", space: I, group: "Living Spaces", from: ["Kitchen"] },
  { id: "i-dining-room", label: "Dining Room", icon: "utensils", space: I, group: "Living Spaces", from: ["Dining Room"] },
  { id: "i-breakfast-nook", label: "Breakfast Nook", icon: "coffee", space: I, group: "Living Spaces" },
  {
    id: "i-home-office",
    label: "Office",
    icon: "briefcase",
    space: I,
    group: "Living Spaces",
    aliases: ["Home Office"],
    from: ["Office"],
  },
  { id: "i-bonus-room", label: "Bonus Room", icon: "shapes", space: I, group: "Living Spaces" },
  { id: "i-sunroom", label: "Sunroom", icon: "sun", space: I, group: "Living Spaces", previewId: "i-great-room" },
  { id: "i-media-room", label: "Media Room", icon: "clapperboard", space: I, group: "Living Spaces", previewId: "i-family-room" },
  { id: "i-gym", label: "Home Gym", icon: "dumbbell", space: I, group: "Living Spaces", previewId: "i-bonus-room" },
  {
    id: "i-commercial-space",
    label: "Commercial Space",
    icon: "building-2",
    space: I,
    group: "Living Spaces",
    previewId: "i-great-room",
  },

  {
    id: "i-primary-bedroom",
    label: "Primary Bedroom",
    icon: "bed-double",
    space: I,
    group: "Bedrooms & Baths",
    aliases: ["Master Bedroom"],
    from: ["Bedroom"],
    previewId: "i-bedroom",
  },
  { id: "i-bedroom", label: "Bedroom", icon: "bed", space: I, group: "Bedrooms & Baths" },
  { id: "i-guest-bedroom", label: "Guest Bedroom", icon: "bed-single", space: I, group: "Bedrooms & Baths", previewId: "i-bedroom" },
  { id: "i-nursery", label: "Nursery", icon: "baby", space: I, group: "Bedrooms & Baths", previewId: "i-bedroom" },
  {
    id: "i-bathroom",
    label: "Bathroom",
    icon: "bath",
    space: I,
    group: "Bedrooms & Baths",
    from: ["Bathroom"],
  },
  { id: "i-primary-bath", label: "Primary Bath", icon: "bath", space: I, group: "Bedrooms & Baths", previewId: "i-bathroom" },
  { id: "i-guest-bath", label: "Guest Bath", icon: "shower-head", space: I, group: "Bedrooms & Baths", previewId: "i-bathroom" },
  { id: "i-half-bath", label: "Half Bath", icon: "toilet", space: I, group: "Bedrooms & Baths", previewId: "i-bathroom" },
  { id: "i-walk-in-closet", label: "Walk In Closet", icon: "shirt", space: I, group: "Bedrooms & Baths", previewId: "i-bedroom" },

  { id: "i-entry", label: "Entry", icon: "door-open", space: I, group: "Utility & Transition", aliases: ["Foyer", "Entryway"], from: ["Entry"] },
  { id: "i-hallway", label: "Hallway", icon: "move-horizontal", space: I, group: "Utility & Transition", previewId: "i-entry" },
  { id: "i-stairwell", label: "Stairwell", icon: "chevrons-up", space: I, group: "Utility & Transition", previewId: "i-entry" },
  {
    id: "i-laundry",
    label: "Laundry Room",
    icon: "washing-machine",
    space: I,
    group: "Utility & Transition",
    aliases: ["Laundry"],
  },
  { id: "i-mudroom", label: "Mudroom", icon: "footprints", space: I, group: "Utility & Transition", previewId: "i-laundry" },
  { id: "i-pantry", label: "Pantry", icon: "package", space: I, group: "Utility & Transition", previewId: "i-kitchen" },
  { id: "i-basement", label: "Basement", icon: "layers", space: I, group: "Utility & Transition", from: ["Other Interior"] },
  { id: "i-attic", label: "Attic", icon: "triangle", space: I, group: "Utility & Transition", previewId: "i-basement" },

  /* ---------------------------------------------------------- exterior */
  {
    id: "e-front-of-house",
    label: "Front Exterior",
    icon: "home",
    space: E,
    group: "Exterior & Outdoor",
    aliases: ["Front Of House", "Facade"],
    from: ["Front Exterior"],
  },
  {
    id: "e-back-of-house",
    label: "Rear Exterior",
    icon: "house",
    space: E,
    group: "Exterior & Outdoor",
    aliases: ["Back Of House"],
    from: ["Rear Exterior", "Other Exterior"],
  },
  {
    id: "e-side-of-house",
    label: "Side Exterior",
    icon: "panel-left",
    space: E,
    group: "Exterior & Outdoor",
    aliases: ["Side Of House"],
  },
  { id: "e-porch", label: "Porch", icon: "door-closed", space: E, group: "Exterior & Outdoor" },
  { id: "e-patio", label: "Patio", icon: "grid-3x3", space: E, group: "Exterior & Outdoor" },
  { id: "e-balcony", label: "Balcony", icon: "rows-2", space: E, group: "Exterior & Outdoor", previewId: "e-patio" },
  { id: "e-deck", label: "Deck", icon: "rows-3", space: E, group: "Exterior & Outdoor" },
  { id: "e-driveway", label: "Driveway", icon: "milestone", space: E, group: "Exterior & Outdoor", previewId: "e-garage" },
  { id: "e-garage", label: "Garage", icon: "car", space: E, group: "Exterior & Outdoor", from: ["Garage"] },
  {
    id: "e-pool-exterior",
    label: "Pool Exterior",
    icon: "waves",
    space: E,
    group: "Exterior & Outdoor",
    terms: ["swimming", "pool"],
  },
  { id: "e-other-exterior", label: "Other Exterior", icon: "more-horizontal", space: E, group: "Exterior & Outdoor", aliases: ["Other"] },

  /* ------------------------------------------------------------ garden */
  {
    id: "g-front-yard",
    label: "Front Garden",
    icon: "trees",
    space: G,
    group: "Exterior & Outdoor",
    aliases: ["Front Yard"],
  },
  { id: "g-backyard", label: "Backyard", icon: "tree-pine", space: G, group: "Exterior & Outdoor", aliases: ["Back Yard"], from: ["Yard"] },
  { id: "g-side-yard", label: "Side Garden", icon: "route", space: G, group: "Exterior & Outdoor", aliases: ["Side Yard"] },
  { id: "g-courtyard", label: "Courtyard", icon: "square", space: G, group: "Exterior & Outdoor" },
  { id: "g-lawn", label: "Lawn", icon: "sprout", space: G, group: "Exterior & Outdoor", previewId: "g-backyard" },
  { id: "g-garden", label: "Garden", icon: "flower-2", space: G, group: "Exterior & Outdoor" },
  { id: "g-flower-garden", label: "Flower Garden", icon: "flower", space: G, group: "Exterior & Outdoor", previewId: "g-garden" },
  { id: "g-vegetable-garden", label: "Vegetable Garden", icon: "carrot", space: G, group: "Exterior & Outdoor", previewId: "g-garden" },
  { id: "g-terrace", label: "Terrace", icon: "layers", space: G, group: "Exterior & Outdoor" },
  {
    id: "g-outdoor-living",
    label: "Outdoor Living Area",
    icon: "armchair",
    space: G,
    group: "Exterior & Outdoor",
    aliases: ["Outdoor Living"],
    previewId: "g-patio-garden",
  },
  { id: "g-patio-garden", label: "Garden Patio", icon: "grid-3x3", space: G, group: "Exterior & Outdoor" },
  { id: "g-landscaping", label: "Landscaping", icon: "shovel", space: G, group: "Exterior & Outdoor", previewId: "g-garden" },
  { id: "g-pool-area", label: "Pool Area", icon: "waves", space: G, group: "Exterior & Outdoor", from: ["Pool"] },
  { id: "g-other-outdoor", label: "Other Outdoor", icon: "more-horizontal", space: G, group: "Exterior & Outdoor" },
];

/** Workflow-only states. They are never part of the catalog itself. */
export const UNASSIGNED_LABEL = "Unassigned";
export const NEEDS_REVIEW_LABEL = "Needs Review";

const BY_ID = new Map(ROOM_CATALOG.map((r) => [r.id, r]));
const BY_LABEL = new Map<string, RoomCatalogEntry>();
for (const r of ROOM_CATALOG) {
  const key = r.label.toLowerCase();
  if (!BY_LABEL.has(key)) BY_LABEL.set(key, r);
}
for (const r of ROOM_CATALOG) {
  for (const a of r.aliases || []) {
    const key = a.toLowerCase();
    if (!BY_LABEL.has(key)) BY_LABEL.set(key, r);
  }
}

export function roomById(id: unknown): RoomCatalogEntry | null {
  return BY_ID.get(String(id ?? "")) || null;
}

/** Resolve a current label, including every legacy alias. */
export function roomByAnyLabel(label: unknown): RoomCatalogEntry | null {
  const raw = String(label ?? "").trim();
  if (!raw) return null;
  return BY_LABEL.get(raw.toLowerCase()) || null;
}

/** Resolve either an id or a label to the catalog entry. */
export function resolveRoom(value: unknown): RoomCatalogEntry | null {
  return roomById(value) || roomByAnyLabel(value);
}

export function roomsForSpace(space: RoomSpace): RoomCatalogEntry[] {
  return ROOM_CATALOG.filter((r) => r.space === space);
}

export function roomPreview(idOrLabel: unknown): string | null {
  const rec = resolveRoom(idOrLabel);
  if (!rec) return null;
  return ROOM_PHOTOS[rec.previewId || rec.id] || ROOM_PHOTOS[rec.id] || null;
}

export function roomIconFor(idOrLabel: unknown): string {
  return resolveRoom(idOrLabel)?.icon || roomFromCategory(idOrLabel)?.icon || "image";
}

/** Turn a classifier category into the closest catalog room. */
export function roomFromCategory(value: unknown): RoomCatalogEntry | null {
  const direct = resolveRoom(value);
  if (direct) return direct;
  const cat = normalizeCategory(value);
  if (!cat) return null;
  return ROOM_CATALOG.find((r) => (r.from || []).includes(cat)) || null;
}

function haystack(r: RoomCatalogEntry): string {
  return [r.label, ...(r.aliases || []), ...(r.terms || []), r.group].join(" ").toLowerCase();
}

/**
 * One search implementation. Prefix matches on the label rank first, then any
 * other match on labels, aliases, search terms or the group name.
 */
export function searchRoomCatalog(query: string, list: RoomCatalogEntry[] = ROOM_CATALOG) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return list.slice();
  const starts: RoomCatalogEntry[] = [];
  const contains: RoomCatalogEntry[] = [];
  for (const r of list) {
    const label = r.label.toLowerCase();
    if (label.startsWith(q)) starts.push(r);
    else if (haystack(r).includes(q)) contains.push(r);
  }
  return starts.concat(contains);
}

export function groupRoomCatalog(list: RoomCatalogEntry[]): Array<{ group: RoomGroup; rooms: RoomCatalogEntry[] }> {
  const out: Array<{ group: RoomGroup; rooms: RoomCatalogEntry[] }> = [];
  for (const g of ROOM_GROUPS) {
    const rooms = list.filter((r) => r.group === g);
    if (rooms.length) out.push({ group: g, rooms });
  }
  return out;
}

/** Front-to-back-through-the-house ordering for reviewed sets. */
export function roomRankOf(value: unknown): number {
  const rec = resolveRoom(value) || roomFromCategory(value);
  if (!rec) return ROOM_CATALOG.length + 1;
  return ROOM_CATALOG.indexOf(rec);
}
