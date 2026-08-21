/**
 * Authoritative room / area datasets, one per space type.
 *
 * Interior, Exterior and Garden each own a separate list. Nothing filters a
 * single generic array by display name, so switching Space always loads the
 * right choices and never leaves an incompatible selection behind.
 */

import { ROOM_PHOTOS } from "@/content/rd-room-photos";

export type CanvasSpace = "interior" | "exterior" | "garden";

export type AreaOption = {
  /** Stable id, also the preview asset key. */
  id: string;
  label: string;
  /** Lucide fallback used only while the preview is loading or failed. */
  icon: string;
  space: CanvasSpace;
};

export const interiorRoomTypes: AreaOption[] = [
  { id: "i-living-room", label: "Living Room", icon: "sofa", space: "interior" },
  { id: "i-family-room", label: "Family Room", icon: "tv", space: "interior" },
  { id: "i-great-room", label: "Great Room", icon: "layout-dashboard", space: "interior" },
  { id: "i-kitchen", label: "Kitchen", icon: "cooking-pot", space: "interior" },
  { id: "i-dining-room", label: "Dining Room", icon: "utensils", space: "interior" },
  { id: "i-breakfast-nook", label: "Breakfast Nook", icon: "coffee", space: "interior" },
  { id: "i-bedroom", label: "Bedroom", icon: "bed-double", space: "interior" },
  { id: "i-bathroom", label: "Bathroom", icon: "bath", space: "interior" },
  { id: "i-home-office", label: "Office", icon: "briefcase", space: "interior" },
  { id: "i-bonus-room", label: "Bonus Room", icon: "shapes", space: "interior" },
  { id: "i-basement", label: "Basement", icon: "layers", space: "interior" },
  { id: "i-entry", label: "Entry", icon: "door-open", space: "interior" },
  { id: "i-laundry", label: "Laundry", icon: "washing-machine", space: "interior" },
];

export const exteriorAreaTypes: AreaOption[] = [
  { id: "e-front-of-house", label: "Front Of House", icon: "home", space: "exterior" },
  { id: "e-back-of-house", label: "Back Of House", icon: "house", space: "exterior" },
  { id: "e-side-of-house", label: "Side Of House", icon: "panel-left", space: "exterior" },
  { id: "e-porch", label: "Porch", icon: "door-closed", space: "exterior" },
  { id: "e-patio", label: "Patio", icon: "grid-3x3", space: "exterior" },
  { id: "e-deck", label: "Deck", icon: "rows-3", space: "exterior" },
  { id: "e-garage", label: "Garage", icon: "car", space: "exterior" },
  { id: "e-pool-exterior", label: "Pool Exterior", icon: "waves", space: "exterior" },
  { id: "e-other-exterior", label: "Other", icon: "more-horizontal", space: "exterior" },
];

export const gardenAreaTypes: AreaOption[] = [
  { id: "g-front-yard", label: "Front Yard", icon: "trees", space: "garden" },
  { id: "g-backyard", label: "Backyard", icon: "tree-pine", space: "garden" },
  { id: "g-side-yard", label: "Side Yard", icon: "route", space: "garden" },
  { id: "g-patio-garden", label: "Patio", icon: "grid-3x3", space: "garden" },
  { id: "g-terrace", label: "Terrace", icon: "layers", space: "garden" },
  { id: "g-pool-area", label: "Pool Area", icon: "waves", space: "garden" },
  { id: "g-courtyard", label: "Courtyard", icon: "square", space: "garden" },
  { id: "g-garden", label: "Garden", icon: "flower-2", space: "garden" },
  { id: "g-other-outdoor", label: "Other", icon: "more-horizontal", space: "garden" },
];

const BY_SPACE: Record<CanvasSpace, AreaOption[]> = {
  interior: interiorRoomTypes,
  exterior: exteriorAreaTypes,
  garden: gardenAreaTypes,
};

/** The complete, authoritative list of choices for one space. */
export function areasForSpace(space: CanvasSpace): AreaOption[] {
  return BY_SPACE[space] || interiorRoomTypes;
}

/** Section heading: an exterior photo never asks for a "Room". */
export function areaSectionLabel(space: CanvasSpace): string {
  return space === "interior" ? "Room" : "Area";
}

export function areaByLabel(label: string): AreaOption | null {
  const want = String(label || "").trim().toLowerCase();
  if (!want) return null;
  for (const list of [interiorRoomTypes, exteriorAreaTypes, gardenAreaTypes]) {
    const hit = list.find((a) => a.label.toLowerCase() === want);
    if (hit) return hit;
  }
  return null;
}

/** True when a selected label still belongs to the active space. */
export function areaFitsSpace(label: string, space: CanvasSpace): boolean {
  const rec = areaByLabel(label);
  return !!rec && rec.space === space;
}

/** Durable preview image for a choice, or null when none is stored yet. */
export function areaPreview(id: string): string | null {
  return ROOM_PHOTOS[id] || null;
}
